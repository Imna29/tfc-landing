CREATE TABLE "bout_result_corrections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bout_id" uuid NOT NULL,
	"winner" text,
	"method" text,
	"round" integer,
	"no_result" text,
	"entered_at" timestamp with time zone NOT NULL,
	"entered_by" uuid NOT NULL,
	"corrected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"corrected_by" uuid NOT NULL,
	CONSTRAINT "bout_result_corrections_winner_known" CHECK ("bout_result_corrections"."winner" is null
        or "bout_result_corrections"."winner" in ('red', 'blue')),
	CONSTRAINT "bout_result_corrections_method_known" CHECK ("bout_result_corrections"."method" is null
        or "bout_result_corrections"."method" in ('ko_tko', 'submission', 'decision', 'disqualification')),
	CONSTRAINT "bout_result_corrections_no_result_known" CHECK ("bout_result_corrections"."no_result" is null
        or "bout_result_corrections"."no_result" in ('cancelled', 'withdrawal', 'draw', 'no_contest')),
	CONSTRAINT "bout_result_corrections_is_a_result_or_no_result" CHECK (("bout_result_corrections"."no_result" is null) = ("bout_result_corrections"."winner" is not null
        and "bout_result_corrections"."method" is not null)),
	CONSTRAINT "bout_result_corrections_a_round_is_a_finish" CHECK (("bout_result_corrections"."round" is not null) = ("bout_result_corrections"."method" is not null
        and "bout_result_corrections"."method" in ('ko_tko', 'submission')))
);
--> statement-breakpoint
ALTER TABLE "coin_transactions" DROP CONSTRAINT "coin_transactions_kind_known";--> statement-breakpoint
DROP INDEX "coin_transactions_one_reward_per_entry";--> statement-breakpoint
DROP INDEX "coin_transactions_one_refund_per_entry";--> statement-breakpoint
ALTER TABLE "coin_transactions" ADD COLUMN "reverses" uuid;--> statement-breakpoint
ALTER TABLE "bout_result_corrections" ADD CONSTRAINT "bout_result_corrections_bout_id_bouts_id_fk" FOREIGN KEY ("bout_id") REFERENCES "public"."bouts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bout_result_corrections" ADD CONSTRAINT "bout_result_corrections_entered_by_users_id_fk" FOREIGN KEY ("entered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bout_result_corrections" ADD CONSTRAINT "bout_result_corrections_corrected_by_users_id_fk" FOREIGN KEY ("corrected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bout_result_corrections_by_bout" ON "bout_result_corrections" USING btree ("bout_id","corrected_at");--> statement-breakpoint
ALTER TABLE "coin_transactions" ADD CONSTRAINT "coin_transactions_reverses_coin_transactions_id_fk" FOREIGN KEY ("reverses") REFERENCES "public"."coin_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "coin_transactions_one_reversal_per_row" ON "coin_transactions" USING btree ("reverses");--> statement-breakpoint
CREATE INDEX "coin_transactions_by_cause" ON "coin_transactions" USING btree ("cause_id");--> statement-breakpoint
ALTER TABLE "coin_transactions" ADD CONSTRAINT "coin_transactions_a_reversal_names_what_it_undoes" CHECK (("coin_transactions"."kind" = 'entry_reversal') = ("coin_transactions"."reverses" is not null));--> statement-breakpoint
ALTER TABLE "coin_transactions" ADD CONSTRAINT "coin_transactions_reversal_takes_coins_back" CHECK ("coin_transactions"."kind" <> 'entry_reversal'
        or ("coin_transactions"."amount" < 0 and "coin_transactions"."cause" = 'entry'));--> statement-breakpoint
ALTER TABLE "coin_transactions" ADD CONSTRAINT "coin_transactions_kind_known" CHECK ("coin_transactions"."kind" in ('season_grant', 'entry_commitment', 'entry_reward', 'entry_refund',
        'entry_reversal'));--> statement-breakpoint
-- A reversal is worth exactly the movement it names, and undoes a movement
-- that can be undone.
--
-- The reversal is the one row in this ledger written *about* another row, and
-- it is the row a correction moves real Coins with: everything else here takes
-- an Amount a fan typed or grants a fixed hundred, and this takes back a
-- Reward a fan has already seen in their Balance. So it is held to the row it
-- names in every respect that could make it a Coin printer instead — the same
-- fan, the same Season, the same Entry, and the exact negative of the amount.
-- A reversal of −80 against a Reward of 40 is 40 Coins destroyed with no error
-- anywhere, which is the failure ADR-0003 is written against.
--
-- Only a Reward and a refund can be reversed, and that is the whole list. A
-- commitment reversed would be an Entry a fan is holding for nothing; a Season
-- grant reversed would be a fan playing a Season without its hundred Coins;
-- and a reversal reversed would be a Reward quietly restored by a second row
-- nobody would read as restoring it — a correction that re-pays a Reward pays
-- a *new* one, which is what the ledger then says happened.
--
-- Immediate rather than deferred, unlike the two below: the row it reads was
-- committed by an earlier transaction — the settlement being corrected — so
-- there is nothing here that is written second.
CREATE FUNCTION refuse_a_reversal_that_does_not_undo_its_row() RETURNS trigger AS $$
DECLARE
  undone coin_transactions%ROWTYPE;
BEGIN
  SELECT * INTO undone FROM coin_transactions WHERE id = new.reverses;

  IF undone.id IS NOT NULL
     AND undone.kind IN ('entry_reward', 'entry_refund')
     AND undone.season_id = new.season_id
     AND undone.user_id = new.user_id
     AND undone.cause = new.cause
     AND undone.cause_id = new.cause_id
     AND new.amount = -undone.amount THEN
    RETURN new;
  END IF;

  RAISE EXCEPTION 'a_reversal_undoes_the_row_it_names: % of % Coins does not undo % (%, % Coins)',
    new.kind, new.amount, new.reverses, coalesce(undone.kind, 'no such row'), undone.amount
    USING ERRCODE = 'restrict_violation',
          HINT = 'A reversal takes back one Reward or one refund, for the same fan and the same Entry, in full.';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER a_reversal_undoes_the_row_it_names
  BEFORE INSERT ON "coin_transactions"
  FOR EACH ROW WHEN (new.kind = 'entry_reversal')
  EXECUTE FUNCTION refuse_a_reversal_that_does_not_undo_its_row();--> statement-breakpoint
-- An Entry that has Won holds one Reward standing, and an Entry that has not
-- holds none.
--
-- #14 held half of this as `coin_transactions_one_reward_per_entry`, a partial
-- unique index on `cause_id`: the last line of "settling the same Bout twice
-- does not pay anybody twice". A correction meets that index the moment it
-- re-grades an Entry it has just reversed the Reward of, and the choice the
-- ticket has to make is which of the two things the index was doing to keep.
--
-- What it was actually for is that an Entry cannot end up holding two Rewards.
-- "Two rows exist" was only ever a proxy for that, and it is the wrong one now
-- that a row can be taken back: the property is one Reward *standing*, and a
-- standing Reward is one no reversal names. An index cannot ask that, because
-- it is a row in another place not existing, so this asks it — and asks the
-- other direction too, which the index never could: an Entry that is not Won
-- holds no Reward at all. A Reward standing against an Entry that lost is
-- Coins nobody can explain from the rows that moved them, and it is exactly
-- what a correction that reversed the status and forgot the Coins would leave
-- behind.
--
-- The Reward's *amount* is deliberately not checked here, unlike the refund's
-- below. What a winning Entry returns is its Multiplier at the cap of the day
-- (ADR-0013), worked out by `potentialReward` from the Multipliers frozen onto
-- its Predictions — arithmetic no trigger should be a second copy of. What is
-- checkable is that there is one of them, and this is that.
--
-- A constraint trigger, deferred to the end of the transaction, because the
-- status and the Reward are two writes and one of them is second — and, in a
-- correction, because the reversal that makes room for the new Reward is a
-- third.
CREATE FUNCTION refuse_a_reward_beside_an_entry_that_did_not_win() RETURNS trigger AS $$
DECLARE
  entry uuid;
  state text;
  standing integer;
BEGIN
  -- Two statements rather than one expression choosing between them, for the
  -- reason `refuse_an_entry_returned_apart_from_its_refund` gives: plpgsql
  -- resolves every field of `new` an expression mentions before it runs.
  IF tg_table_name = 'entries' THEN
    entry := new.id;
  ELSE
    entry := new.cause_id;
  END IF;

  SELECT status INTO state FROM entries WHERE id = entry;

  SELECT count(*) INTO standing
    FROM coin_transactions AS reward
    WHERE reward.kind = 'entry_reward' AND reward.cause_id = entry
      AND NOT EXISTS (
        SELECT 1 FROM coin_transactions AS reversal WHERE reversal.reverses = reward.id
      );

  -- A Reward pointing at no Entry at all falls through to the exception rather
  -- than being waved past: `cause_id` is polymorphic, so there is no foreign
  -- key underneath this to catch it, and the comparison below is null for it.
  IF (state = 'won') = (standing = 1) THEN
    RETURN null;
  END IF;

  RAISE EXCEPTION 'won_entries_are_rewarded_once: entry % is % and holds % standing Reward(s)',
    entry, coalesce(state, 'not an Entry'), standing
    USING ERRCODE = 'restrict_violation',
          HINT = 'An Entry is marked Won and paid its one Reward in one transaction, or neither.';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
-- No `when` clause on the `entries` side, unlike every other rule of this
-- shape in this schema, and it is not an oversight. What has to be asked about
-- is the Entry that has just stopped being Won — a correction that moved the
-- status and forgot the Coins is exactly the bug this exists to catch — and
-- that is a condition on `old`, which Postgres does not allow in the `when` of
-- a trigger that also fires on insert. One trigger per name per table, so the
-- choice is this or leaving the case unasked, and the cost is two indexed
-- lookups on rows that are nearly always trivially fine.
CREATE CONSTRAINT TRIGGER won_entries_are_rewarded_once
  AFTER INSERT OR UPDATE ON "entries"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION refuse_a_reward_beside_an_entry_that_did_not_win();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER won_entries_are_rewarded_once
  AFTER INSERT ON "coin_transactions"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW WHEN (new.kind IN ('entry_reward', 'entry_reversal'))
  EXECUTE FUNCTION refuse_a_reward_beside_an_entry_that_did_not_win();--> statement-breakpoint
-- An Entry whose Amount has come back has been cancelled or refunded, and one
-- that has not, has not — for the whole Amount, once.
--
-- #13 wrote this rule and #15 widened it to the second status that returns an
-- Amount. What #16 changes is the word "has": a refund can now be taken back,
-- so the question is whether one is *standing* — a refund row no reversal
-- names — rather than whether one was ever written. An Entry revived from
-- Refunded by a correction has a refund row in its ledger for ever, because
-- the Coins really did go back that day, and it holds none standing because
-- they have since been taken away again.
--
-- Everything else about it is #13's and #15's, and worth restating: the Amount
-- is checked here rather than in a check constraint because it lives on
-- another table, and a partial refund is the failure worth naming — nothing
-- writes one today, and the day something does, it is this that says so rather
-- than a fan counting their Coins.
CREATE OR REPLACE FUNCTION refuse_an_entry_returned_apart_from_its_refund() RETURNS trigger AS $$
DECLARE
  entry uuid;
  state text;
  committed integer;
  refunds integer;
  returned integer;
BEGIN
  IF tg_table_name = 'entries' THEN
    entry := new.id;
  ELSE
    entry := new.cause_id;
  END IF;

  SELECT status, amount INTO state, committed FROM entries WHERE id = entry;

  SELECT count(*), coalesce(sum(refund.amount), 0) INTO refunds, returned
    FROM coin_transactions AS refund
    WHERE refund.kind = 'entry_refund' AND refund.cause_id = entry
      AND NOT EXISTS (
        SELECT 1 FROM coin_transactions AS reversal WHERE reversal.reverses = refund.id
      );

  IF (state IN ('cancelled', 'refunded')) = (refunds = 1)
     AND (state NOT IN ('cancelled', 'refunded') OR returned = committed) THEN
    RETURN null;
  END IF;

  RAISE EXCEPTION 'entries_are_refunded_in_full: entry % is %, committed % Coins and is standing % across % refund(s)',
    entry, coalesce(state, 'not an Entry'), committed, returned, refunds
    USING ERRCODE = 'restrict_violation',
          HINT = 'An Entry is cancelled or refunded and its Amount returned in one transaction, or neither.';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
-- The `when` clause on the `entries` side goes, for the reason
-- `won_entries_are_rewarded_once` has none: what has to be asked about now is
-- the Entry a correction has moved *off* Refunded, still holding the refund it
-- was given, and "off" is a condition on `old` that a trigger firing on insert
-- as well may not carry.
DROP TRIGGER entries_are_refunded_in_full ON "entries";--> statement-breakpoint
DROP TRIGGER entries_are_refunded_in_full ON "coin_transactions";--> statement-breakpoint
CREATE CONSTRAINT TRIGGER entries_are_refunded_in_full
  AFTER INSERT OR UPDATE ON "entries"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION refuse_an_entry_returned_apart_from_its_refund();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER entries_are_refunded_in_full
  AFTER INSERT ON "coin_transactions"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW WHEN (new.kind IN ('entry_refund', 'entry_reversal'))
  EXECUTE FUNCTION refuse_an_entry_returned_apart_from_its_refund();--> statement-breakpoint
-- An Entry is cancelled once, out of Open, and stays cancelled.
--
-- #13 wrote this of `cancelled` and #15 widened it to `refunded`, which was
-- right while a graded Entry was graded for ever: both statuses returned an
-- Amount, and neither had any business being reached from a settled Entry or
-- left afterwards.
--
-- A correction is what makes the second half of that wrong. An Entry whose
-- every Prediction turned out to be a No Result is Refunded, and if the result
-- that made it so was itself entered wrong, that Entry has to be able to come
-- back to Won, Lost or Open — with its refund reversed in the same transaction
-- (ADR-0003). So the rule narrows to the status it was written for.
--
-- What holds `refunded` afterwards is not this but
-- `entries_are_refunded_in_full`, and it holds it better: the status and the
-- standing refund are true together or neither is, whatever moved which. A
-- status rule would have said an Entry may not go from Refunded to Won; the
-- money rule says it may not go there carrying Coins it has already been given
-- back, which is the thing anybody actually cares about.
--
-- Cancelled keeps both directions and keeps them absolutely. It is the fan's
-- own decision, taken while every Bout in the Entry was still open, and it is
-- the one status no result can reach into: an Entry taken back before the card
-- started is never graded against anything, so a correction has nothing to say
-- about it.
DROP TRIGGER an_entry_returns_its_coins_once_out_of_open ON "entries";--> statement-breakpoint
DROP FUNCTION refuse_a_return_that_is_not_out_of_open();--> statement-breakpoint
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
-- A Result that was changed says what it used to say.
--
-- `bout_results` holds one row per Bout and a correction updates it, because
-- it is what every Prediction on that Bout is graded against wherever one is
-- shown, and there is no version of "the current Result" that can be two rows.
-- The one it replaced is not thrown away for that: it goes to
-- `bout_result_corrections`, which is append-only, and this is what makes
-- writing it something other than a thing a writer has to remember.
--
-- Shaped like `locked_bouts_are_recorded` and for the same reason — a record
-- and the thing it records, written in one transaction or neither — with one
-- difference: a Lock is one row and this is a history, so what is checked is
-- that the *superseded* statement is in it, matched field for field, including
-- who made it and when. A correction that logged the new Result, or logged the
-- right Bout with the wrong ending, is a log that disagrees with the ledger
-- rows beside it, and the fan reading both is the person it disagrees in front
-- of.
--
-- `is not distinct from` rather than `=` throughout, because half of these
-- columns are null on any given row: a No Result has no winner, a Decision has
-- no round, and `null = null` is null, which would refuse every correction of
-- either.
CREATE FUNCTION refuse_a_correction_nobody_recorded() RETURNS trigger AS $$
DECLARE
  recorded integer;
BEGIN
  SELECT count(*) INTO recorded
    FROM bout_result_corrections
    WHERE bout_id = old.bout_id
      AND winner IS NOT DISTINCT FROM old.winner
      AND method IS NOT DISTINCT FROM old.method
      AND round IS NOT DISTINCT FROM old.round
      AND no_result IS NOT DISTINCT FROM old.no_result
      AND entered_at = old.entered_at
      AND entered_by = old.entered_by;

  IF recorded > 0 THEN
    RETURN null;
  END IF;

  RAISE EXCEPTION 'corrected_results_are_recorded: bout % was corrected with nothing recording what it said before',
    old.bout_id
    USING ERRCODE = 'restrict_violation',
          HINT = 'A Result is corrected and the one it replaced recorded in one transaction, or neither.';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER corrected_results_are_recorded
  AFTER UPDATE ON "bout_results"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION refuse_a_correction_nobody_recorded();--> statement-breakpoint
-- The Result audit log is append-only, like the Lock log and the Coin ledger
-- and for the same reason: the question it answers — "what was my Entry graded
-- against before, and who said so?" — is asked after the fact by somebody who
-- is unhappy, and an answer that could have been tidied up in between is not
-- one.
--
-- Deliberately row-level: `truncate` does not fire it, so the test suite can
-- still empty the database between tests, and no ordinary statement can get
-- past it.
CREATE FUNCTION refuse_to_rewrite_a_correction() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'bout_result_corrections_are_append_only: % is refused', lower(tg_op)
    USING ERRCODE = 'restrict_violation',
          HINT = 'A correction is what somebody said and then changed. Correct a Result again rather than editing this.';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER bout_result_corrections_are_append_only
  BEFORE UPDATE OR DELETE ON "bout_result_corrections"
  FOR EACH ROW EXECUTE FUNCTION refuse_to_rewrite_a_correction();
