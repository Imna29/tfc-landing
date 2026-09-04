-- What a Bout offers is decided by the discipline it is fought in (ADR-0017).
--
-- TFC books three formats on one card and they are not three names for one
-- sport. An MMA Bout ends by KO/TKO, Submission or Decision; a CageBox Bout
-- is boxing and cannot end in a Submission; a Cage Grappling Bout has no
-- method of victory at all and is settled on its winner. So a Bout carries
-- what it is fought under, offers the Outcomes that discipline asks — eight,
-- six or two — and records a Result made of what it was asked.
--
-- **This migration converts rather than stopping**, which is what makes it
-- different from `20260902203757_a_corner_on_every_answer` and
-- `20260904154156_the_round_question_retired` before it. Every Bout imported
-- until now was imported with the eight answers MMA asks and priced and graded
-- as one, so `discipline = 'mma'` is not a guess about those rows: it is what
-- they already were. Nothing a fan committed Coins to changes meaning, and no
-- Outcome or Prediction is added, removed or repriced by any of this. The
-- column arrives nullable, is filled in, and is only then made `not null` —
-- adding it `not null` in one statement is what would have stopped on a
-- database holding any card at all.
--
-- **`bout_results_is_a_result_or_no_result` is loosened in one direction and
-- tightened in another.** It said a row names a winner *and a method*, or the
-- reason there is neither. A Cage Grappling Result names a winner and no
-- method, so the method comes out of the first half — and, so that the check
-- still says as much as it did, a No Result is now held to naming no method
-- either, which the old form allowed by accident. The same edit is made to
-- `bout_result_corrections`, which logs superseded Results and could otherwise
-- not hold one of the rows it is a log of.
--
-- **Which methods a Bout may record is a fact about another table**, so it
-- cannot be a check constraint: it is
-- `a_result_records_the_method_its_discipline_asks`, at the end of this file.
-- It is what stops a Submission being recorded on a CageBox Bout — a method
-- the game knows and that Bout could never have produced, and one no fan on it
-- was ever offered. `parseEnding` in `shared/results.ts` refuses the same thing
-- first, so an admin is told which answer is wrong rather than handed the
-- database's opinion; this is the copy that survives a refactor.
--
-- Untouched, and deliberately: `outcomes_answers_its_question` and
-- `predictions_answers_its_question`, because a narrower set of answers is
-- still the same shape of answer; `outcomes_method_known` and
-- `predictions_method_known`, which are about the words the game knows rather
-- than about which of them one Bout uses; `bout_results_method_known`, still
-- one value wider than those two because of the disqualification (ADR-0005);
-- and `refuse_a_correction_nobody_recorded`, which matches a superseded Result
-- against the log field by field and gains no field here.

-- Nullable, filled in, then held. Every Bout that exists was an MMA Bout.
ALTER TABLE "bouts" ADD COLUMN "discipline" text;--> statement-breakpoint
UPDATE "bouts" SET "discipline" = 'mma' WHERE "discipline" IS NULL;--> statement-breakpoint
ALTER TABLE "bouts" ALTER COLUMN "discipline" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bouts" ADD CONSTRAINT "bouts_discipline_known" CHECK ("discipline" in ('mma', 'cagebox', 'cage_grappling'));--> statement-breakpoint
ALTER TABLE "bout_result_corrections" DROP CONSTRAINT "bout_result_corrections_is_a_result_or_no_result", ADD CONSTRAINT "bout_result_corrections_is_a_result_or_no_result" CHECK (("no_result" is null) = ("winner" is not null)
        and ("no_result" is null or "method" is null));--> statement-breakpoint
ALTER TABLE "bout_results" DROP CONSTRAINT "bout_results_is_a_result_or_no_result", ADD CONSTRAINT "bout_results_is_a_result_or_no_result" CHECK (("no_result" is null) = ("winner" is not null)
        and ("no_result" is null or "method" is null));--> statement-breakpoint

-- A Result records the methods its Bout's discipline asks about, and only
-- those.
--
-- A trigger rather than a check because the answer is on another row: which
-- endings exist is a fact about the Bout, and a check constraint cannot read
-- one. The list is spelled out here rather than derived, the same way
-- `outcomes_question_known` spells out the Questions — a constraint built from
-- a lookup is a constraint that is only as true as whatever last wrote the
-- lookup. `methodsAsked` in `shared/pricing.ts` is the other place it is said,
-- and "holds the trigger's own list of endings to the one the game asks" in
-- `test/server/settlement.test.ts` is what stops the two drifting apart: it
-- puts every discipline against every ending the game knows, both ways round.
--
-- Fires on update as well as insert, because a correction rewrites this row in
-- place (ADR-0003) and a correction is exactly where somebody re-enters a
-- fight from memory.
--
-- **Only a row that is a Result is judged here**, which is any row naming a
-- winner. A No Result records no method whatever the discipline, and a row
-- naming neither is not an account of a fight at all — both are
-- `bout_results_is_a_result_or_no_result`'s to refuse, and it says so in words
-- about what is missing rather than in words about a method.
CREATE FUNCTION refuse_a_method_its_bout_was_never_asked_about() RETURNS trigger AS $$
DECLARE
  fought text;
  asked text[];
BEGIN
  IF new.winner IS NULL THEN
    RETURN new;
  END IF;

  SELECT discipline INTO fought FROM bouts WHERE id = new.bout_id;

  -- The disqualification is on every list that has anything on it: it is how a
  -- Bout ends rather than an answer the game offers, and it is recorded so that
  -- the method Question can become a No Result (ADR-0005). A discipline with no
  -- method Question has no Question for it to neutralise, so it is not on that
  -- list either.
  asked := CASE fought
    WHEN 'mma' THEN ARRAY['ko_tko', 'submission', 'decision', 'disqualification']
    WHEN 'cagebox' THEN ARRAY['ko_tko', 'decision', 'disqualification']
    WHEN 'cage_grappling' THEN ARRAY[]::text[]
    ELSE NULL
  END;

  IF new.method IS NULL AND cardinality(asked) = 0 THEN
    RETURN new;
  END IF;

  IF new.method = ANY (asked) THEN
    RETURN new;
  END IF;

  RAISE EXCEPTION 'a_result_records_the_method_its_discipline_asks: bout % is fought in % and was recorded as ending %',
    new.bout_id, coalesce(fought, 'no discipline'), coalesce(new.method, 'with no method')
    USING ERRCODE = 'restrict_violation',
          HINT = 'A Result records the methods its discipline asks about. A Cage Grappling Bout is settled on its winner and records none.';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER a_result_records_the_method_its_discipline_asks
  BEFORE INSERT OR UPDATE ON "bout_results"
  FOR EACH ROW EXECUTE FUNCTION refuse_a_method_its_bout_was_never_asked_about();
