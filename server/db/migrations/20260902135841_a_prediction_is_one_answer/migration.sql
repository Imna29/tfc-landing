-- A Prediction becomes one answer to one Question on one Bout (ADR-0014).
--
-- The compound row goes: a required corner, an optional method, an optional
-- round and three Multipliers become a Question, exactly one non-null answer,
-- and the one Multiplier that answer pays. `predictions_answers_its_question`
-- is the rule holding it to that, and it is the same rule
-- `outcomes_answers_its_question` holds the Outcome this is a copy of to.
--
-- **Nothing is converted, and this migration will stop on a table that still
-- holds rows** — `add column "question" text not null` is what stops it. That
-- is deliberate: a compound answer is not one answer, and picking which of its
-- three to keep would be inventing a Prediction nobody made. The project is
-- pre-launch, so the database is wiped rather than backfilled, and a database
-- that still holds Predictions is one somebody has to look at rather than one
-- this file should guess about.
--
-- What is kept is everything the model rests on:
--   * `predictions_one_per_bout_in_an_entry`, the index ADR-0014 calls the
--     rule that makes this shape safe to multiply. It is untouched below,
--     which is the point — it must not survive only in a route.
--   * the three `predictions_…_is_offered` foreign keys, which are what prove
--     an answer was one the Bout was actually offering.
--   * the `predictions_are_made_on_open_bouts` trigger and the deferred
--     `entries_hold_one_to_ten_predictions` constraint trigger, neither of
--     which is in the snapshot and neither of which this touches.
--
-- What goes is `predictions_a_round_needs_a_finish` — a round Prediction
-- stands on its own now, and is graded wrong rather than refused on a Bout
-- that went the distance — and `predictions_answers_are_priced`, which paired
-- each of three answers with its own Multiplier where there is now one of
-- each.

ALTER TABLE "predictions" RENAME COLUMN "winner_multiplier" TO "multiplier";--> statement-breakpoint
ALTER TABLE "predictions" DROP CONSTRAINT "predictions_a_round_needs_a_finish";--> statement-breakpoint
ALTER TABLE "predictions" DROP CONSTRAINT "predictions_answers_are_priced";--> statement-breakpoint
ALTER TABLE "predictions" DROP CONSTRAINT "predictions_multipliers_pay";--> statement-breakpoint
ALTER TABLE "predictions" ADD COLUMN "question" text NOT NULL;--> statement-breakpoint
ALTER TABLE "predictions" DROP COLUMN "method_multiplier";--> statement-breakpoint
ALTER TABLE "predictions" DROP COLUMN "round_multiplier";--> statement-breakpoint
ALTER TABLE "predictions" ALTER COLUMN "corner" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_question_known" CHECK ("question" in ('winner', 'method', 'round'));--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_answers_its_question" CHECK (("question" = 'winner' and "corner" is not null
            and "method" is null and "round" is null)
        or ("question" = 'method' and "method" is not null
            and "corner" is null and "round" is null)
        or ("question" = 'round' and "round" is not null
            and "corner" is null and "method" is null));--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_multiplier_pays" CHECK ("multiplier" > 1 and "multiplier" <= 100);--> statement-breakpoint
ALTER TABLE "predictions" DROP CONSTRAINT "predictions_corner_known", ADD CONSTRAINT "predictions_corner_known" CHECK ("corner" is null or "corner" in ('red', 'blue'));