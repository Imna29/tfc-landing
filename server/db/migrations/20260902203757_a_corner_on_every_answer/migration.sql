-- Every Outcome and every Prediction names the corner it is about (ADR-0015).
--
-- `corner` becomes `not null` on both tables, so the method and round Questions
-- stop being asked of the Bout and start being asked of a fighter: "Tsiklauri
-- by KO/TKO", "Tsiklauri in round 2". Both `…_answers_its_question` checks
-- collapse to the same smaller rule — a corner always, plus exactly one of
-- `method` and `round`, decided by `question` — which says everything the
-- "exactly one of three" it replaces said, and one thing it could not.
--
-- **Nothing is converted, and this migration will stop on a database that has
-- ever imported a card** — `alter column "corner" set not null` on `outcomes`
-- is what stops it, because every method and round row written under the old
-- shape carries a null corner. That is deliberate: which fighter a Bout-level
-- "KO/TKO" was about is not a fact anybody recorded, and picking one would be
-- inventing an answer nobody was offered. The project is pre-launch, so the
-- database is wiped rather than backfilled, and one that still holds rows is
-- one somebody has to look at rather than one this file should guess about.
--
-- **The three `outcomes_one_per_*` unique indexes are the part worth reading
-- twice.** They worked by NULL-distinctness: a method row had a null corner, so
-- `(bout_id, corner)` never collided with a winner row. With a corner on every
-- row that pair collides across the Questions, so each index becomes
-- corner-inclusive — `(bout_id, corner)` partial on the winner Question, then
-- `(bout_id, corner, method)` and `(bout_id, corner, round)`. The last two stay
-- unique over the whole table, because a foreign key can only reference an
-- index that is.
--
-- Which is why `predictions_winner_is_offered` is dropped and not replaced.
-- `(bout_id, corner)` is now unique among winner rows and nowhere else,
-- Postgres will not point a foreign key at a partial unique index, and no other
-- column set is both unique across `outcomes` and non-null on a winner
-- Prediction — so there is no widening that saves it.
--
-- What holds the winner answer to the card instead is a chain rather than one
-- key: the Bout key and the `predictions_corner_known` check, and then a
-- Prediction only being writable on an open Bout
-- (`predictions_are_made_on_open_bouts`), which was only openable once every
-- Outcome on it was priced (`bouts_are_opened_only_when_priced`) — so both
-- winner Outcomes exist before any fan can answer. What is given up is
-- narrower than the key was: nothing now refuses deleting a winner Outcome
-- that committed Predictions point at.
--
-- The other two keys widen and hold more than they did: "round 4 of a
-- three-rounder" and "Beridze by Submission on a Bout offering it only to
-- Tsiklauri" are both refusals from the database rather than only from a
-- route. What they hold is which answer was offered, not what it pays — the
-- Multiplier is in no constraint, and `priceOf` is what copies the right
-- number onto the right answer.
--
-- `bout_results_round_was_offered` widens with the index it points at, to
-- `(bout_id, winner, round)`. It reaches exactly as far as it did: a round is
-- impossible without a method (`bout_results_a_round_is_a_finish`) and a method
-- impossible without a winner (`bout_results_is_a_result_or_no_result`), so the
-- two columns are non-null together or the key is not checked at all.
--
-- Untouched, and deliberately: `predictions_one_per_bout_in_an_entry`, which is
-- load-bearing in a way it was not — "Fighter A by Decision" says everything
-- "Fighter A wins" says and more, and it is the only thing standing between the
-- game and paying a fan twice for nearly one claim. `predictions_by_bout` as
-- well, and the `predictions_are_made_on_open_bouts` trigger, the
-- `entries_hold_one_to_ten_predictions` constraint trigger and the
-- `bouts_are_opened_only_when_priced` trigger, none of which is in the snapshot.

-- The keys first: an index a foreign key depends on cannot be dropped.
ALTER TABLE "predictions" DROP CONSTRAINT "predictions_winner_is_offered";--> statement-breakpoint
ALTER TABLE "predictions" DROP CONSTRAINT "predictions_method_is_offered";--> statement-breakpoint
ALTER TABLE "predictions" DROP CONSTRAINT "predictions_round_is_offered";--> statement-breakpoint
ALTER TABLE "bout_results" DROP CONSTRAINT "bout_results_round_was_offered";--> statement-breakpoint
ALTER TABLE "outcomes" ALTER COLUMN "corner" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "predictions" ALTER COLUMN "corner" SET NOT NULL;--> statement-breakpoint
DROP INDEX "outcomes_one_per_corner";--> statement-breakpoint
CREATE UNIQUE INDEX "outcomes_one_per_corner" ON "outcomes" ("bout_id","corner") WHERE "question" = 'winner';--> statement-breakpoint
DROP INDEX "outcomes_one_per_method";--> statement-breakpoint
CREATE UNIQUE INDEX "outcomes_one_per_method" ON "outcomes" ("bout_id","corner","method");--> statement-breakpoint
DROP INDEX "outcomes_one_per_round";--> statement-breakpoint
CREATE UNIQUE INDEX "outcomes_one_per_round" ON "outcomes" ("bout_id","corner","round");--> statement-breakpoint
ALTER TABLE "bout_results" ADD CONSTRAINT "bout_results_round_was_offered" FOREIGN KEY ("bout_id","winner","round") REFERENCES "outcomes"("bout_id","corner","round");--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_method_is_offered" FOREIGN KEY ("bout_id","corner","method") REFERENCES "outcomes"("bout_id","corner","method");--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_round_is_offered" FOREIGN KEY ("bout_id","corner","round") REFERENCES "outcomes"("bout_id","corner","round");--> statement-breakpoint
ALTER TABLE "outcomes" DROP CONSTRAINT "outcomes_corner_known", ADD CONSTRAINT "outcomes_corner_known" CHECK ("corner" in ('red', 'blue'));--> statement-breakpoint
ALTER TABLE "outcomes" DROP CONSTRAINT "outcomes_answers_its_question", ADD CONSTRAINT "outcomes_answers_its_question" CHECK ("corner" is not null
        and (("question" = 'winner'
              and "method" is null and "round" is null)
          or ("question" = 'method' and "method" is not null
              and "round" is null)
          or ("question" = 'round' and "round" is not null
              and "method" is null)));--> statement-breakpoint
ALTER TABLE "predictions" DROP CONSTRAINT "predictions_corner_known", ADD CONSTRAINT "predictions_corner_known" CHECK ("corner" in ('red', 'blue'));--> statement-breakpoint
ALTER TABLE "predictions" DROP CONSTRAINT "predictions_answers_its_question", ADD CONSTRAINT "predictions_answers_its_question" CHECK ("corner" is not null
        and (("question" = 'winner'
              and "method" is null and "round" is null)
          or ("question" = 'method' and "method" is not null
              and "round" is null)
          or ("question" = 'round' and "round" is not null
              and "method" is null)));
