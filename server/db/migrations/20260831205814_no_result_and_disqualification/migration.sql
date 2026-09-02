ALTER TABLE "bout_results" DROP CONSTRAINT "bout_results_winner_known";--> statement-breakpoint
ALTER TABLE "bout_results" DROP CONSTRAINT "bout_results_method_known";--> statement-breakpoint
ALTER TABLE "bout_results" DROP CONSTRAINT "bout_results_a_round_is_a_finish";--> statement-breakpoint
ALTER TABLE "entries" DROP CONSTRAINT "entries_status_known";--> statement-breakpoint
ALTER TABLE "bout_results" ALTER COLUMN "winner" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bout_results" ALTER COLUMN "method" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bout_results" ADD COLUMN "no_result" text;--> statement-breakpoint
ALTER TABLE "bout_results" ADD CONSTRAINT "bout_results_no_result_known" CHECK ("bout_results"."no_result" is null
        or "bout_results"."no_result" in ('cancelled', 'withdrawal', 'draw', 'no_contest'));--> statement-breakpoint
ALTER TABLE "bout_results" ADD CONSTRAINT "bout_results_is_a_result_or_no_result" CHECK (("bout_results"."no_result" is null) = ("bout_results"."winner" is not null
        and "bout_results"."method" is not null));--> statement-breakpoint
ALTER TABLE "bout_results" ADD CONSTRAINT "bout_results_winner_known" CHECK ("bout_results"."winner" is null
        or "bout_results"."winner" in ('red', 'blue'));--> statement-breakpoint
ALTER TABLE "bout_results" ADD CONSTRAINT "bout_results_method_known" CHECK ("bout_results"."method" is null
        or "bout_results"."method" in ('ko_tko', 'submission', 'decision', 'disqualification'));--> statement-breakpoint
ALTER TABLE "bout_results" ADD CONSTRAINT "bout_results_a_round_is_a_finish" CHECK (("bout_results"."round" is not null) = ("bout_results"."method" is not null
        and "bout_results"."method" in ('ko_tko', 'submission')));--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_status_known" CHECK ("entries"."status" in ('open', 'won', 'lost', 'cancelled', 'refunded'));--> statement-breakpoint
-- An Entry returns its Amount once, out of Open, and stays where that left it.
--
-- #13 wrote this rule for `cancelled`, when that was the only status that gave
-- an Amount back. ADR-0005 adds a second, `refunded`, and it is the same rule
-- about the same Coins: an Entry that reached either from anywhere but `open`
-- is an Amount returned on top of a Reward, or returned on an Entry that lost,
-- and an Entry moved off either is Coins already back in a Balance being graded
-- against a card as though they were still committed.
--
-- Widened rather than copied, because there is one question here — may this
-- Entry's Coins go back? — and two triggers answering it would be two places
-- for the answer to drift. Both statuses are named in both directions.
--
-- The refusal a fan actually meets is in `cancelEntry` in
-- `server/utils/cancellation.ts`, which reads the row under a lock and says
-- which of the two it was. This is what is true regardless — of a second
-- request arriving in the same moment, and of a hand-written `update`.
DROP TRIGGER an_entry_is_cancelled_once_out_of_open ON "entries";--> statement-breakpoint
DROP FUNCTION refuse_a_cancellation_that_is_not_out_of_open();--> statement-breakpoint
CREATE FUNCTION refuse_a_return_that_is_not_out_of_open() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'an_entry_returns_its_coins_once_out_of_open: entry % is % and was asked to become %',
    old.id, old.status, new.status
    USING ERRCODE = 'restrict_violation',
          HINT = 'An Entry returns its Amount while it is still Open, and stays where that left it.';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER an_entry_returns_its_coins_once_out_of_open
  BEFORE UPDATE ON "entries"
  FOR EACH ROW WHEN (
    (new.status IN ('cancelled', 'refunded') AND old.status <> 'open')
    OR (old.status IN ('cancelled', 'refunded') AND new.status <> old.status)
  )
  EXECUTE FUNCTION refuse_a_return_that_is_not_out_of_open();--> statement-breakpoint
-- An Entry whose Amount came back has been refunded, and a refund belongs to
-- an Entry whose Amount came back — for the whole Amount, once.
--
-- #13 wrote this as `cancelled_entries_are_refunded`, and named the rule after
-- the one status that could reach it. There are two now: a Cancellation is the
-- fan's decision and a Refund is the game's, and the ledger cannot tell them
-- apart because the Coins did exactly the same thing (ADR-0005). So the rule
-- is renamed for what it actually holds — an Entry marked either with no
-- refund row is Coins destroyed with no error anywhere, and a refund row on an
-- Entry marked neither is Coins created the same way.
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
-- On `insert` as well as `update`, for the reason #13 gave: nothing writes an
-- Entry that is already cancelled or already refunded and nothing ever should,
-- which is exactly why the rule has to hold there too.
DROP TRIGGER cancelled_entries_are_refunded ON "entries";--> statement-breakpoint
DROP TRIGGER cancelled_entries_are_refunded ON "coin_transactions";--> statement-breakpoint
DROP FUNCTION refuse_a_cancellation_apart_from_its_refund();--> statement-breakpoint
CREATE FUNCTION refuse_an_entry_returned_apart_from_its_refund() RETURNS trigger AS $$
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
  -- key underneath this to catch it, and every comparison below is null for it.
  IF (state IN ('cancelled', 'refunded')) = (refunds = 1)
     AND (state NOT IN ('cancelled', 'refunded') OR returned = committed) THEN
    RETURN null;
  END IF;

  RAISE EXCEPTION 'entries_are_refunded_in_full: entry % is %, committed % Coins and has been returned % across % refund(s)',
    entry, coalesce(state, 'not an Entry'), committed, returned, refunds
    USING ERRCODE = 'restrict_violation',
          HINT = 'An Entry is cancelled or refunded and its Amount returned in one transaction, or neither.';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER entries_are_refunded_in_full
  AFTER INSERT OR UPDATE ON "entries"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW WHEN (new.status IN ('cancelled', 'refunded'))
  EXECUTE FUNCTION refuse_an_entry_returned_apart_from_its_refund();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER entries_are_refunded_in_full
  AFTER INSERT ON "coin_transactions"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW WHEN (new.kind = 'entry_refund')
  EXECUTE FUNCTION refuse_an_entry_returned_apart_from_its_refund();
