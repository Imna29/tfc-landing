-- The round of victory stops being a Question the game asks (ADR-0016).
--
-- A Bout offered two winner answers, six method answers and two for each round
-- it was scheduled for; it offers eight answers now, and the same eight
-- whatever format it is booked in. `round` goes from all four tables that
-- carried one — the Outcomes a Bout offers, the Predictions copied from them,
-- the Result an admin records and the log of the Results corrections replaced.
--
-- **Nothing is converted, and this migration will stop on a database that has
-- ever imported a card.** `outcomes_question_known` is what stops it: every
-- round Outcome an import wrote carries `question = 'round'`, and Postgres
-- validates a new check against the rows already there.
-- `predictions_question_known` would stop it a moment later on any Entry that
-- answered one. That is deliberate, and it is the same call
-- `20260902203757_a_corner_on_every_answer` made: a round Prediction is an
-- answer a fan committed Coins to, and there is no honest thing to convert it
-- into — refunding it is a decision about somebody's Balance rather than a
-- decision about a schema. The project is pre-launch, so the database is wiped
-- rather than migrated, and one that still holds rows is one somebody has to
-- look at rather than one this file should guess about.
--
-- **The Result loses its round as well**, which is the half of this that is not
-- about what a fan is offered. It was there to grade round answers and nothing
-- else — `bout_results_round_was_offered` pointed at the round Outcomes
-- themselves, and `bout_results_a_round_is_a_finish` existed to keep it
-- alongside a KO/TKO or a Submission. With no round Question there is nothing
-- left to read it, so recording it would be asking an admin at cageside for a
-- number the game never uses.
--
-- `outcomes_one_per_round` goes with the column, and the two keys that pointed
-- at it go first: an index a foreign key depends on cannot be dropped.
-- `predictions_method_is_offered` is untouched and is now the only key holding
-- an answer to the card — see the note on `predictions` in
-- `server/db/schema.ts` for why the winner Question has none.
--
-- **The two `…_answers_its_question` checks are replaced before the column is
-- dropped, and the order is load-bearing.** Each of them names `round`, so
-- Postgres takes them with the column — and the `alter … drop constraint` that
-- follows would then be dropping a constraint that no longer exists. Replaced
-- first, they never mention the column and never notice it going.
--
-- **One function body has to be replaced by hand**, and nothing in the
-- generated diff would have said so. `refuse_a_correction_nobody_recorded` is
-- what `corrected_results_are_recorded` calls, and it matches the superseded
-- Result against the correction log field by field — the round being one of
-- those fields. A function body is not a dependency Postgres tracks, so the
-- column drop leaves it naming a column that is gone and every correction fails
-- at runtime. It is replaced at the end of this file, unchanged but for that
-- one line. The trigger itself is not touched.
--
-- Untouched, and deliberately: `outcomes_one_per_corner` and
-- `outcomes_one_per_method`, which still hold a Bout to one Multiplier per
-- answer; `predictions_one_per_bout_in_an_entry`, which is what stops "Fighter
-- A wins" and "Fighter A by Decision" being chained in one Entry;
-- `bouts_rounds_are_scheduled` and `bouts.scheduled_rounds`, because how long a
-- Bout is booked for is still a fact a fan reads on the card. Every trigger is
-- untouched as well — `predictions_are_made_on_open_bouts`,
-- `bouts_are_opened_only_when_priced`, `entries_hold_one_to_ten_predictions`
-- and `corrected_results_are_recorded`, none of which is in the snapshot. What
-- changes is one function body a trigger calls, immediately above.

-- The keys first: an index a foreign key depends on cannot be dropped.
ALTER TABLE "bout_results" DROP CONSTRAINT "bout_results_round_was_offered";--> statement-breakpoint
ALTER TABLE "predictions" DROP CONSTRAINT "predictions_round_is_offered";--> statement-breakpoint
ALTER TABLE "bout_result_corrections" DROP CONSTRAINT "bout_result_corrections_a_round_is_a_finish";--> statement-breakpoint
ALTER TABLE "bout_results" DROP CONSTRAINT "bout_results_a_round_is_a_finish";--> statement-breakpoint
ALTER TABLE "outcomes" DROP CONSTRAINT "outcomes_round_is_a_round";--> statement-breakpoint
ALTER TABLE "predictions" DROP CONSTRAINT "predictions_round_is_a_round";--> statement-breakpoint
ALTER TABLE "outcomes" DROP CONSTRAINT "outcomes_question_known", ADD CONSTRAINT "outcomes_question_known" CHECK ("question" in ('winner', 'method'));--> statement-breakpoint
ALTER TABLE "predictions" DROP CONSTRAINT "predictions_question_known", ADD CONSTRAINT "predictions_question_known" CHECK ("question" in ('winner', 'method'));--> statement-breakpoint
ALTER TABLE "outcomes" DROP CONSTRAINT "outcomes_answers_its_question", ADD CONSTRAINT "outcomes_answers_its_question" CHECK ("corner" is not null
        and (("question" = 'winner' and "method" is null)
          or ("question" = 'method' and "method" is not null)));--> statement-breakpoint
ALTER TABLE "predictions" DROP CONSTRAINT "predictions_answers_its_question", ADD CONSTRAINT "predictions_answers_its_question" CHECK ("corner" is not null
        and (("question" = 'winner' and "method" is null)
          or ("question" = 'method' and "method" is not null)));--> statement-breakpoint
DROP INDEX "outcomes_one_per_round";--> statement-breakpoint
ALTER TABLE "bout_result_corrections" DROP COLUMN "round";--> statement-breakpoint
ALTER TABLE "bout_results" DROP COLUMN "round";--> statement-breakpoint
ALTER TABLE "outcomes" DROP COLUMN "round";--> statement-breakpoint
ALTER TABLE "predictions" DROP COLUMN "round";--> statement-breakpoint

-- `refuse_a_correction_nobody_recorded` compared the superseded Result to the
-- log field by field, and one of those fields was the round. A function body is
-- not a constraint, so nothing dropped it with the column: it is replaced here,
-- and without this every correction fails on a column that no longer exists.
-- The `corrected_results_are_recorded` trigger that calls it is unchanged.
--
-- Everything else about it is unchanged, `is not distinct from` included —
-- half of these columns are null on any given row, a No Result has no winner,
-- and `null = null` is null.
CREATE OR REPLACE FUNCTION refuse_a_correction_nobody_recorded() RETURNS trigger AS $$
DECLARE
  recorded integer;
BEGIN
  SELECT count(*) INTO recorded
    FROM bout_result_corrections
    WHERE bout_id = old.bout_id
      AND winner IS NOT DISTINCT FROM old.winner
      AND method IS NOT DISTINCT FROM old.method
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
$$ LANGUAGE plpgsql;
