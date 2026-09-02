CREATE TABLE "entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entries_status_known" CHECK ("entries"."status" in ('open')),
	CONSTRAINT "entries_amount_is_committed" CHECK ("entries"."amount" >= 1)
);
--> statement-breakpoint
CREATE TABLE "predictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"bout_id" uuid NOT NULL,
	"corner" text NOT NULL,
	"method" text,
	"round" integer,
	"winner_multiplier" numeric(5, 2) NOT NULL,
	"method_multiplier" numeric(5, 2),
	"round_multiplier" numeric(5, 2),
	CONSTRAINT "predictions_corner_known" CHECK ("predictions"."corner" in ('red', 'blue')),
	CONSTRAINT "predictions_method_known" CHECK ("predictions"."method" is null or "predictions"."method" in ('ko_tko', 'submission', 'decision')),
	CONSTRAINT "predictions_round_is_a_round" CHECK ("predictions"."round" is null or "predictions"."round" between 1 and 12),
	CONSTRAINT "predictions_a_round_needs_a_finish" CHECK ("predictions"."round" is null or "predictions"."method" in ('ko_tko', 'submission')),
	CONSTRAINT "predictions_answers_are_priced" CHECK (("predictions"."method" is null) = ("predictions"."method_multiplier" is null)
        and ("predictions"."round" is null) = ("predictions"."round_multiplier" is null)),
	CONSTRAINT "predictions_multipliers_pay" CHECK ("predictions"."winner_multiplier" > 1 and "predictions"."winner_multiplier" <= 100
        and ("predictions"."method_multiplier" is null
          or ("predictions"."method_multiplier" > 1 and "predictions"."method_multiplier" <= 100))
        and ("predictions"."round_multiplier" is null
          or ("predictions"."round_multiplier" > 1 and "predictions"."round_multiplier" <= 100)))
);
--> statement-breakpoint
ALTER TABLE "coin_transactions" DROP CONSTRAINT "coin_transactions_kind_known";--> statement-breakpoint
ALTER TABLE "coin_transactions" DROP CONSTRAINT "coin_transactions_cause_known";--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_bout_id_bouts_id_fk" FOREIGN KEY ("bout_id") REFERENCES "public"."bouts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_winner_is_offered" FOREIGN KEY ("bout_id","corner") REFERENCES "public"."outcomes"("bout_id","corner") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_method_is_offered" FOREIGN KEY ("bout_id","method") REFERENCES "public"."outcomes"("bout_id","method") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_round_is_offered" FOREIGN KEY ("bout_id","round") REFERENCES "public"."outcomes"("bout_id","round") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entries_by_fan" ON "entries" USING btree ("season_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "predictions_one_per_bout_in_an_entry" ON "predictions" USING btree ("entry_id","bout_id");--> statement-breakpoint
CREATE INDEX "predictions_by_bout" ON "predictions" USING btree ("bout_id");--> statement-breakpoint
CREATE UNIQUE INDEX "coin_transactions_one_commitment_per_entry" ON "coin_transactions" USING btree ("cause_id") WHERE "coin_transactions"."kind" = 'entry_commitment';--> statement-breakpoint
ALTER TABLE "coin_transactions" ADD CONSTRAINT "coin_transactions_commitment_leaves_the_balance" CHECK ("coin_transactions"."kind" <> 'entry_commitment'
        or ("coin_transactions"."amount" < 0 and "coin_transactions"."cause" = 'entry'));--> statement-breakpoint
ALTER TABLE "coin_transactions" ADD CONSTRAINT "coin_transactions_kind_known" CHECK ("coin_transactions"."kind" in ('season_grant', 'entry_commitment'));--> statement-breakpoint
ALTER TABLE "coin_transactions" ADD CONSTRAINT "coin_transactions_cause_known" CHECK ("coin_transactions"."cause" in ('season', 'entry'));--> statement-breakpoint
-- A Prediction is only ever made on a Bout that is open, held by Postgres
-- rather than by the route that asks first (ADR-0006).
--
-- This is the rule with the most riding on it in the whole product: a Bout
-- still taking Predictions while it is being fought is the one failure that
-- lets a fan win with certainty. The route asks first so that a fan is told
-- which Bout and why; this is what is true regardless — of a second request
-- arriving in the same moment as the lock, and of a hand-written `insert`.
--
-- `closed` is refused by the same rule, and is the other half of it: nothing
-- has been priced on a Bout nobody has opened, so a Prediction on one would be
-- a Prediction at no Multiplier at all.
--
-- Written by hand because Drizzle does not model triggers; it is not in the
-- snapshot beside this file and `drizzle-kit generate` will never notice it is
-- missing, so nothing but `test/server/entries.test.ts` proves it is still
-- here.
--
-- What it deliberately does not know about is the Lock a card reaches on its
-- own — the first Bout of a card locks at the scheduled start (ADR-0006) with
-- nothing writing a row to say so, and `boutState` in `shared/predictions.ts`
-- is what the route reads it from. #12 makes that a status of its own, and
-- this refuses it the day it does, because it asks whether a Bout is open
-- rather than whether it is locked.
--
-- The message opens with the trigger's own name so that the route can
-- recognise its question coming back as a refusal, the way `refusedByConstraint`
-- in `server/utils/db.ts` recognises a named index.
CREATE FUNCTION refuse_a_prediction_on_a_bout_that_is_not_open() RETURNS trigger AS $$
DECLARE
  state text;
BEGIN
  SELECT status INTO state FROM bouts WHERE id = new.bout_id;

  IF state = 'open' THEN
    RETURN new;
  END IF;

  RAISE EXCEPTION 'predictions_are_made_on_open_bouts: bout % is %',
    new.bout_id, coalesce(state, 'not on the card')
    USING ERRCODE = 'restrict_violation',
          HINT = 'Coins are committed to a Bout only while it is open for predictions.';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER predictions_are_made_on_open_bouts
  BEFORE INSERT ON "predictions"
  FOR EACH ROW EXECUTE FUNCTION refuse_a_prediction_on_a_bout_that_is_not_open();--> statement-breakpoint
-- An Entry holds between one and ten Predictions (ADR-0002, ADR-0004).
--
-- The floor is what an Entry is: Coins committed to nothing is not a
-- prediction, and an Entry with no Predictions would sit in a fan's history
-- forever with nothing to settle it. The ceiling bounds what a mispriced
-- Outcome can cost — nothing self-corrects one (ADR-0002), so the ×100 cap and
-- these ten links are what stand between a pricing mistake and a Balance
-- nobody can explain.
--
-- A constraint trigger, deferred to the end of the transaction, because
-- neither end of the rule can be checked while it is being written: an Entry
-- is inserted before the Predictions it holds, and the tenth Prediction is
-- written before the eleventh makes it wrong. Both tables carry it, so that an
-- Entry written with no Predictions at all is refused as well as an Entry
-- given an eleventh later.
--
-- Spelled out again in `ENTRY_PREDICTIONS` in `shared/entries.ts`, which is
-- what the page and the route refuse with.
CREATE FUNCTION refuse_an_entry_that_is_not_one_to_ten_predictions() RETURNS trigger AS $$
DECLARE
  entry uuid;
  held integer;
BEGIN
  -- Two statements rather than one expression choosing between them: plpgsql
  -- resolves every field of `new` an expression mentions before it runs, so a
  -- `case` naming `new.entry_id` fails on the `entries` row it was not meant
  -- to read it from.
  IF tg_table_name = 'entries' THEN
    entry := new.id;
  ELSE
    entry := new.entry_id;
  END IF;

  SELECT count(*) INTO held FROM predictions WHERE entry_id = entry;

  IF held BETWEEN 1 AND 10 THEN
    RETURN null;
  END IF;

  RAISE EXCEPTION 'entries_hold_one_to_ten_predictions: entry % holds % Predictions', entry, held
    USING ERRCODE = 'restrict_violation',
          HINT = 'An Entry is between one and ten Predictions, one per Bout.';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER entries_hold_one_to_ten_predictions
  AFTER INSERT ON "entries"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION refuse_an_entry_that_is_not_one_to_ten_predictions();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER entries_hold_one_to_ten_predictions
  AFTER INSERT ON "predictions"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION refuse_an_entry_that_is_not_one_to_ten_predictions();--> statement-breakpoint
-- No fan commits Coins they do not hold.
--
-- Asked of the ledger rather than of `balance_cache`, because the ledger is
-- the Balance (ADR-0003) and the cache is a copy of it that a repair could be
-- halfway through rebuilding.
--
-- Only a commitment is held to this. A Balance is allowed below zero — ADR-0003
-- is explicit that reversing a Reward a fan has already committed elsewhere
-- takes them under, and that is a correction working rather than a bug — so
-- this asks about the one kind of row that must never be the thing that does
-- it.
--
-- What this cannot do on its own is stop two submissions in the same
-- millisecond each finding enough Coins: neither transaction can see the
-- other's uncommitted row. That is what the `for update` in
-- `balanceToCommitFrom` in `server/utils/coins.ts` is for, and this is what
-- holds for everything that never went through it.
CREATE FUNCTION refuse_a_commitment_beyond_the_balance() RETURNS trigger AS $$
DECLARE
  held integer;
BEGIN
  SELECT coalesce(sum(amount), 0) INTO held
    FROM coin_transactions
    WHERE season_id = new.season_id AND user_id = new.user_id;

  IF held + new.amount >= 0 THEN
    RETURN new;
  END IF;

  RAISE EXCEPTION 'entry_commitments_are_within_the_balance: % holds % Coins and committed %',
    new.user_id, held, -new.amount
    USING ERRCODE = 'restrict_violation',
          HINT = 'A fan commits Coins they hold; there are no top-ups inside a Season.';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER entry_commitments_are_within_the_balance
  BEFORE INSERT ON "coin_transactions"
  FOR EACH ROW WHEN (new.kind = 'entry_commitment')
  EXECUTE FUNCTION refuse_a_commitment_beyond_the_balance();
