ALTER TABLE "coin_transactions" DROP CONSTRAINT "coin_transactions_kind_known";--> statement-breakpoint
ALTER TABLE "entries" DROP CONSTRAINT "entries_status_known";--> statement-breakpoint
CREATE UNIQUE INDEX "coin_transactions_one_refund_per_entry" ON "coin_transactions" USING btree ("cause_id") WHERE "coin_transactions"."kind" = 'entry_refund';--> statement-breakpoint
ALTER TABLE "coin_transactions" ADD CONSTRAINT "coin_transactions_refund_returns_coins" CHECK ("coin_transactions"."kind" <> 'entry_refund'
        or ("coin_transactions"."amount" > 0 and "coin_transactions"."cause" = 'entry'));--> statement-breakpoint
ALTER TABLE "coin_transactions" ADD CONSTRAINT "coin_transactions_kind_known" CHECK ("coin_transactions"."kind" in ('season_grant', 'entry_commitment', 'entry_reward', 'entry_refund'));--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_status_known" CHECK ("entries"."status" in ('open', 'won', 'lost', 'cancelled'));--> statement-breakpoint
-- An Entry is cancelled once, out of Open, and stays cancelled.
--
-- Both directions of the same rule, in the shape `a_locked_bout_is_never_reopened`
-- uses, because they are two ways for the same Coins to move twice. An Entry
-- that reached `cancelled` from anywhere but `open` is a fan taking back an
-- Entry a Result has already paid or ended — the Amount returned on top of a
-- Reward, or returned on an Entry that lost. An Entry moved off `cancelled` is
-- one whose Coins are already back in the Balance being graded against a card
-- as though they were still committed.
--
-- The refusal a fan actually meets is in `cancelEntry` in
-- `server/utils/cancellation.ts`, which reads the row under a lock and says
-- which of the two it was. This is what is true regardless — of a second
-- request arriving in the same moment, and of a hand-written `update`.
CREATE FUNCTION refuse_a_cancellation_that_is_not_out_of_open() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'an_entry_is_cancelled_once_out_of_open: entry % is % and was asked to become %',
    old.id, old.status, new.status
    USING ERRCODE = 'restrict_violation',
          HINT = 'An Entry is cancelled while it is still Open, and a cancelled Entry stays cancelled.';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER an_entry_is_cancelled_once_out_of_open
  BEFORE UPDATE ON "entries"
  FOR EACH ROW WHEN (
    (new.status = 'cancelled' AND old.status <> 'open')
    OR (old.status = 'cancelled' AND new.status <> 'cancelled')
  )
  EXECUTE FUNCTION refuse_a_cancellation_that_is_not_out_of_open();--> statement-breakpoint
-- An Entry is only cancelled while every Bout in it is still open.
--
-- This is the rule the whole ticket is about, and it is here for the reason
-- `predictions_are_made_on_open_bouts` is: it is the one an exploit would go
-- through. Multipliers are frozen at submission (ADR-0002), so an Entry that
-- could be withdrawn after a Bout closed could be withdrawn knowing how that
-- Bout was going, which is a fan deciding whether to keep an Entry after part
-- of it has been decided. Asked of every Bout in the Entry rather than the
-- earliest, because the Bouts of a Chained Entry lock one at a time as the
-- card is fought (ADR-0006).
--
-- What it deliberately cannot see is the Lock that has fallen due with nobody
-- yet having written a row for it — the same blind spot
-- `predictions_are_made_on_open_bouts` has, and closed the same way: the route
-- runs `applyAutomaticLocks` before it asks anything, so the column is right
-- by the time this reads it.
CREATE FUNCTION refuse_a_cancellation_on_a_card_that_has_started() RETURNS trigger AS $$
DECLARE
  closed integer;
BEGIN
  SELECT count(*) INTO closed
    FROM predictions
    JOIN bouts ON bouts.id = predictions.bout_id
    WHERE predictions.entry_id = new.id AND bouts.status <> 'open';

  IF closed = 0 THEN
    RETURN new;
  END IF;

  RAISE EXCEPTION 'entries_are_cancelled_while_every_bout_is_open: entry % holds % Bout(s) that are not open',
    new.id, closed
    USING ERRCODE = 'restrict_violation',
          HINT = 'An Entry is cancelled while every Bout in it is still taking Predictions, and not afterwards.';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER entries_are_cancelled_while_every_bout_is_open
  BEFORE UPDATE ON "entries"
  FOR EACH ROW WHEN (new.status = 'cancelled' AND old.status <> 'cancelled')
  EXECUTE FUNCTION refuse_a_cancellation_on_a_card_that_has_started();--> statement-breakpoint
-- A cancelled Entry has been refunded, and a refund belongs to a cancelled
-- Entry — for the whole Amount, once.
--
-- The same shape as `results_are_entered_on_settled_bouts`, and the same kind
-- of promise: a status and a Coin movement that are only ever true together.
-- An Entry marked cancelled with no refund row is Coins destroyed with no
-- error anywhere; a refund row on an Entry that is not cancelled is Coins
-- created the same way. Both directions, because either one alone would leave
-- the other reachable.
--
-- The Amount is checked here rather than in a check constraint because it
-- lives on another table: "refunds in full" is a fact about the Entry and the
-- ledger row together, and this is the only place that can see both. A partial
-- refund is the failure worth naming — nothing writes one today, and the day
-- something does, it is this that says so rather than a fan counting their
-- Coins.
--
-- A constraint trigger, deferred to the end of the transaction, because
-- neither end can be checked while it is being written: the status and the
-- refund are two writes and one of them is second.
--
-- On `insert` as well as `update`, unlike the two triggers above. Nothing
-- writes an Entry that is already cancelled and nothing ever should, which is
-- exactly why the rule has to hold there too: a row inserted straight into
-- `cancelled` would otherwise carry no refund and meet no rule saying so.
--
-- One more status returns an Amount in full, and it is not written yet: #15's
-- Refunded, for an Entry whose every Prediction was a No Result. It widens
-- `entries_status_known` and this condition together, in a migration somebody
-- reads — the same discipline every other status has been added under.
CREATE FUNCTION refuse_a_cancellation_apart_from_its_refund() RETURNS trigger AS $$
DECLARE
  entry uuid;
  state text;
  committed integer;
  refunds integer;
  returned integer;
BEGIN
  -- Two statements rather than one expression choosing between them: plpgsql
  -- resolves every field of `new` an expression mentions before it runs, so a
  -- `case` naming `new.cause_id` fails on the `entries` row it was not meant
  -- to read it from.
  IF tg_table_name = 'entries' THEN
    entry := new.id;
  ELSE
    entry := new.cause_id;
  END IF;

  SELECT status, amount INTO state, committed FROM entries WHERE id = entry;

  SELECT count(*), coalesce(sum(amount), 0) INTO refunds, returned
    FROM coin_transactions
    WHERE kind = 'entry_refund' AND cause_id = entry;

  -- A refund pointing at no Entry at all falls through to the exception rather
  -- than being waved past: `cause_id` is polymorphic, so there is no foreign
  -- key underneath this to catch it.
  IF (state = 'cancelled') = (refunds = 1) AND (state <> 'cancelled' OR returned = committed) THEN
    RETURN null;
  END IF;

  RAISE EXCEPTION 'cancelled_entries_are_refunded: entry % is %, committed % Coins and has been returned % across % refund(s)',
    entry, coalesce(state, 'not an Entry'), committed, returned, refunds
    USING ERRCODE = 'restrict_violation',
          HINT = 'An Entry is cancelled and its Amount returned in one transaction, or neither.';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER cancelled_entries_are_refunded
  AFTER INSERT OR UPDATE ON "entries"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW WHEN (new.status = 'cancelled')
  EXECUTE FUNCTION refuse_a_cancellation_apart_from_its_refund();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER cancelled_entries_are_refunded
  AFTER INSERT ON "coin_transactions"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW WHEN (new.kind = 'entry_refund')
  EXECUTE FUNCTION refuse_a_cancellation_apart_from_its_refund();
