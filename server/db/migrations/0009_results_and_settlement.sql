CREATE TABLE "bout_results" (
	"bout_id" uuid PRIMARY KEY NOT NULL,
	"winner" text NOT NULL,
	"method" text NOT NULL,
	"round" integer,
	"entered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"entered_by" uuid NOT NULL,
	CONSTRAINT "bout_results_winner_known" CHECK ("bout_results"."winner" in ('red', 'blue')),
	CONSTRAINT "bout_results_method_known" CHECK ("bout_results"."method" in ('ko_tko', 'submission', 'decision')),
	CONSTRAINT "bout_results_a_round_is_a_finish" CHECK (("bout_results"."round" is null) = ("bout_results"."method" = 'decision'))
);
--> statement-breakpoint
ALTER TABLE "bouts" DROP CONSTRAINT "bouts_status_known";--> statement-breakpoint
ALTER TABLE "coin_transactions" DROP CONSTRAINT "coin_transactions_kind_known";--> statement-breakpoint
ALTER TABLE "entries" DROP CONSTRAINT "entries_status_known";--> statement-breakpoint
ALTER TABLE "bout_results" ADD CONSTRAINT "bout_results_bout_id_bouts_id_fk" FOREIGN KEY ("bout_id") REFERENCES "public"."bouts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bout_results" ADD CONSTRAINT "bout_results_entered_by_users_id_fk" FOREIGN KEY ("entered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bout_results" ADD CONSTRAINT "bout_results_round_was_offered" FOREIGN KEY ("bout_id","round") REFERENCES "public"."outcomes"("bout_id","round") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "coin_transactions_one_reward_per_entry" ON "coin_transactions" USING btree ("cause_id") WHERE "coin_transactions"."kind" = 'entry_reward';--> statement-breakpoint
ALTER TABLE "bouts" ADD CONSTRAINT "bouts_status_known" CHECK ("bouts"."status" in ('closed', 'open', 'locked', 'settled'));--> statement-breakpoint
ALTER TABLE "coin_transactions" ADD CONSTRAINT "coin_transactions_reward_returns_coins" CHECK ("coin_transactions"."kind" <> 'entry_reward'
        or ("coin_transactions"."amount" > 0 and "coin_transactions"."cause" = 'entry'));--> statement-breakpoint
ALTER TABLE "coin_transactions" ADD CONSTRAINT "coin_transactions_kind_known" CHECK ("coin_transactions"."kind" in ('season_grant', 'entry_commitment', 'entry_reward'));--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_status_known" CHECK ("entries"."status" in ('open', 'won', 'lost'));--> statement-breakpoint
-- A Lock is still final, and settling is not reopening.
--
-- #12 wrote this rule when `locked` was the end of the road: any move off it
-- was a Bout somebody could commit Coins to knowing how the fight went. There
-- is now one move off it that is not that — `settled`, which is the Result
-- being entered and the Coins moving — and it goes one way only. Every other
-- move off `locked` is refused exactly as before, and `settled` itself is
-- refused every move at all: a Bout whose Entries have been graded and paid
-- cannot go back to taking Predictions by any route, including this one being
-- widened again by somebody who reads only the trigger name.
--
-- Replaced rather than added beside, so there is one trigger answering "may
-- this Bout's status move?" instead of two that have to be read together.
CREATE OR REPLACE FUNCTION refuse_to_reopen_a_locked_bout() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'a_locked_bout_is_never_reopened: bout % is % and was asked to become %',
    old.id, old.status, new.status
    USING ERRCODE = 'restrict_violation',
          HINT = 'A Lock is the moment a Bout stopped taking Predictions. It is never taken back.';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER a_locked_bout_is_never_reopened ON "bouts";--> statement-breakpoint
CREATE TRIGGER a_locked_bout_is_never_reopened
  BEFORE UPDATE ON "bouts"
  FOR EACH ROW WHEN (
    (old.status = 'locked' AND new.status NOT IN ('locked', 'settled'))
    OR (old.status = 'settled' AND new.status <> 'settled')
  )
  EXECUTE FUNCTION refuse_to_reopen_a_locked_bout();--> statement-breakpoint
-- Every Lock is still recorded, including on the Bouts that have moved past it.
--
-- The rule #12 wrote is "a Bout that has locked has exactly one Lock record",
-- and it asked that as `status = 'locked'` because that was the only way a
-- Bout could have locked. A settled Bout has locked too — it is the only place
-- `settled` is reachable from — so without this it would be a Bout with a Lock
-- record and no Lock, and the constraint trigger would refuse the transaction
-- that settled it.
--
-- The trigger on `bouts` is widened for the same reason it exists: a Bout that
-- reached `settled` without ever being recorded as locked is the gap, and
-- firing only on `locked` would leave a hand-written update straight there
-- unasked.
CREATE OR REPLACE FUNCTION refuse_a_lock_nobody_recorded() RETURNS trigger AS $$
DECLARE
  bout uuid;
  state text;
  recorded integer;
BEGIN
  -- Two statements rather than one expression choosing between them: plpgsql
  -- resolves every field of `new` an expression mentions before it runs, so a
  -- `case` naming `new.bout_id` fails on the `bouts` row it was not meant to
  -- read it from.
  IF tg_table_name = 'bouts' THEN
    bout := new.id;
  ELSE
    bout := new.bout_id;
  END IF;

  SELECT status INTO state FROM bouts WHERE id = bout;

  -- The Bout is gone by the time this is checked, which the foreign key on
  -- `bout_locks` has its own opinion about. There is no Lock left to hold to a
  -- record, and nothing this can usefully say.
  IF state IS NULL THEN
    RETURN null;
  END IF;

  SELECT count(*) INTO recorded FROM bout_locks WHERE bout_id = bout;

  IF (state IN ('locked', 'settled')) = (recorded = 1) THEN
    RETURN null;
  END IF;

  RAISE EXCEPTION 'locked_bouts_are_recorded: bout % is % and has % Lock record(s)',
    bout, state, recorded
    USING ERRCODE = 'restrict_violation',
          HINT = 'A Bout is locked and recorded as locked in one transaction, or neither.';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER locked_bouts_are_recorded ON "bouts";--> statement-breakpoint
CREATE CONSTRAINT TRIGGER locked_bouts_are_recorded
  AFTER UPDATE ON "bouts"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW WHEN (new.status IN ('locked', 'settled'))
  EXECUTE FUNCTION refuse_a_lock_nobody_recorded();--> statement-breakpoint
-- A Bout with a Result is settled, and a settled Bout has a Result.
--
-- This is the one that matters most in this migration, and it is the shape
-- `locked_bouts_are_recorded` uses because it is the same kind of promise. A
-- Result sitting beside a Bout that is still `open` would be Coins moving on a
-- fight whose ending is on the row next to it — the gap ADR-0006's backstops
-- exist for, reached through the one door those backstops do not watch. Tying
-- the two together closes it, because `predictions_are_made_on_open_bouts`
-- refuses a Prediction on anything that is not `open`, and a Bout carrying a
-- Result is `settled` by the time the transaction commits.
--
-- Both directions, because a Bout marked settled with nothing saying what
-- happened is an Entry graded against a Result nobody can produce.
--
-- A constraint trigger, deferred to the end of the transaction, because
-- neither end can be checked while it is being written: the status and the
-- Result are two writes and one of them is second.
--
-- Line for line the same shape as `refuse_a_lock_nobody_recorded` above, and
-- deliberately a copy rather than one function taught to do both. Sharing it
-- would mean passing the table and the status in and reaching them through
-- `execute format(...)`: dynamic SQL, in the two triggers that stand between a
-- fight being over and a fan being paid for it. These are read by somebody
-- checking whether the rule is right, and each of them should be readable
-- without holding the other in their head.
CREATE FUNCTION refuse_a_result_apart_from_its_bout() RETURNS trigger AS $$
DECLARE
  bout uuid;
  state text;
  recorded integer;
BEGIN
  IF tg_table_name = 'bouts' THEN
    bout := new.id;
  ELSE
    bout := new.bout_id;
  END IF;

  SELECT status INTO state FROM bouts WHERE id = bout;

  IF state IS NULL THEN
    RETURN null;
  END IF;

  SELECT count(*) INTO recorded FROM bout_results WHERE bout_id = bout;

  IF (state = 'settled') = (recorded = 1) THEN
    RETURN null;
  END IF;

  RAISE EXCEPTION 'results_are_entered_on_settled_bouts: bout % is % and has % Result(s)',
    bout, state, recorded
    USING ERRCODE = 'restrict_violation',
          HINT = 'A Result is entered and its Bout settled in one transaction, or neither.';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER results_are_entered_on_settled_bouts
  AFTER UPDATE ON "bouts"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW WHEN (new.status = 'settled')
  EXECUTE FUNCTION refuse_a_result_apart_from_its_bout();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER results_are_entered_on_settled_bouts
  AFTER INSERT ON "bout_results"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION refuse_a_result_apart_from_its_bout();--> statement-breakpoint
-- A Result is only ever entered on a Bout that took Predictions.
--
-- The one thing the pair of rules above cannot say on its own: they hold a
-- Result and a settled Bout together, and say nothing about where that Bout
-- came from. `a_locked_bout_is_never_reopened` only watches Bouts that have
-- already locked, so a Bout nobody opened could be settled straight out of
-- `closed` — a fight nobody was offered, marked graded, and never openable
-- again afterwards.
--
-- Written as a check on the Result rather than as another status rule, because
-- it is a fact about the Result: there is nothing to grade on a Bout the game
-- never took a Prediction on, and entering one there is somebody working down
-- a card past the Bouts that were actually in the game.
CREATE FUNCTION refuse_a_result_on_a_bout_nobody_opened() RETURNS trigger AS $$
DECLARE
  locked integer;
BEGIN
  SELECT count(*) INTO locked FROM bout_locks WHERE bout_id = new.bout_id;

  IF locked = 1 THEN
    RETURN new;
  END IF;

  RAISE EXCEPTION 'results_are_entered_on_bouts_that_locked: bout % has never locked',
    new.bout_id
    USING ERRCODE = 'restrict_violation',
          HINT = 'A Bout takes Predictions from the moment it is opened until it locks. Only then is there something to settle.';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER results_are_entered_on_bouts_that_locked
  BEFORE INSERT ON "bout_results"
  FOR EACH ROW EXECUTE FUNCTION refuse_a_result_on_a_bout_nobody_opened();
