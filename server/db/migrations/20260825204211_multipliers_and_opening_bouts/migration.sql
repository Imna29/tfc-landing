CREATE TABLE "outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bout_id" uuid NOT NULL,
	"question" text NOT NULL,
	"corner" text,
	"method" text,
	"round" integer,
	"multiplier" numeric(5, 2) NOT NULL,
	"priced_at" timestamp with time zone,
	"priced_by" uuid,
	CONSTRAINT "outcomes_question_known" CHECK ("outcomes"."question" in ('winner', 'method', 'round')),
	CONSTRAINT "outcomes_corner_known" CHECK ("outcomes"."corner" is null or "outcomes"."corner" in ('red', 'blue')),
	CONSTRAINT "outcomes_method_known" CHECK ("outcomes"."method" is null or "outcomes"."method" in ('ko_tko', 'submission', 'decision')),
	CONSTRAINT "outcomes_round_is_a_round" CHECK ("outcomes"."round" is null or "outcomes"."round" between 1 and 12),
	CONSTRAINT "outcomes_answers_its_question" CHECK (("outcomes"."question" = 'winner' and "outcomes"."corner" is not null
            and "outcomes"."method" is null and "outcomes"."round" is null)
        or ("outcomes"."question" = 'method' and "outcomes"."method" is not null
            and "outcomes"."corner" is null and "outcomes"."round" is null)
        or ("outcomes"."question" = 'round' and "outcomes"."round" is not null
            and "outcomes"."corner" is null and "outcomes"."method" is null)),
	CONSTRAINT "outcomes_multiplier_pays" CHECK ("outcomes"."multiplier" > 1 and "outcomes"."multiplier" <= 100),
	CONSTRAINT "outcomes_priced_is_attributed" CHECK (("outcomes"."priced_at" is null) = ("outcomes"."priced_by" is null))
);
--> statement-breakpoint
ALTER TABLE "outcomes" ADD CONSTRAINT "outcomes_bout_id_bouts_id_fk" FOREIGN KEY ("bout_id") REFERENCES "public"."bouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcomes" ADD CONSTRAINT "outcomes_priced_by_users_id_fk" FOREIGN KEY ("priced_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "outcomes_one_per_corner" ON "outcomes" USING btree ("bout_id","corner");--> statement-breakpoint
CREATE UNIQUE INDEX "outcomes_one_per_method" ON "outcomes" USING btree ("bout_id","method");--> statement-breakpoint
CREATE UNIQUE INDEX "outcomes_one_per_round" ON "outcomes" USING btree ("bout_id","round");--> statement-breakpoint
-- A Bout is opened only once every Outcome on it has been priced, held by
-- Postgres rather than by the route that asks first (ADR-0002).
--
-- Import seeds a Multiplier on every Outcome so that pricing a card is eight
-- numbers adjusted rather than eight authored from blank. Those seeded numbers
-- are deliberately not a price: nothing in the table that produced them knows
-- which fighter is favoured, and ADR-0002 has no pool to self-correct a
-- mispriced Outcome — only the ×100 combined cap, which bounds the damage
-- rather than preventing it. So the last thing between a default and a fan's
-- Coins is somebody at TFC having looked at the number, and that is this.
--
-- A Bout with no Outcomes at all is refused by the same rule. That is the case
-- a card imported before this migration is in: re-import it, which is allowed
-- while every Bout on it is still closed, and it comes back seeded.
--
-- Written by hand because Drizzle does not model triggers; it is not in the
-- snapshot beside this file and `drizzle-kit generate` will never notice it is
-- missing.
--
-- Fires on leaving `closed` rather than on arriving at `open`, so that the
-- `locked` #12 adds and the `settled` #14 adds are covered by it without being
-- named here.
--
-- The message opens with the trigger's own name so that the route can
-- recognise its question coming back as a refusal, the way `refusedByConstraint`
-- in `server/utils/db.ts` recognises a named index.
CREATE FUNCTION refuse_to_open_an_unpriced_bout() RETURNS trigger AS $$
DECLARE
  outcomes_on_the_bout integer;
  unpriced integer;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE priced_at IS NULL)
    INTO outcomes_on_the_bout, unpriced
    FROM outcomes WHERE bout_id = new.id;

  IF outcomes_on_the_bout > 0 AND unpriced = 0 THEN
    RETURN new;
  END IF;

  RAISE EXCEPTION 'bouts_are_opened_only_when_priced: bout % has % Outcomes, % of them unpriced',
    new.id, outcomes_on_the_bout, unpriced
    USING ERRCODE = 'restrict_violation',
          HINT = 'Price every Outcome on a Bout before opening it for predictions.';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER bouts_are_opened_only_when_priced
  BEFORE UPDATE ON "bouts"
  FOR EACH ROW WHEN (old.status = 'closed' AND new.status <> 'closed')
  EXECUTE FUNCTION refuse_to_open_an_unpriced_bout();--> statement-breakpoint
-- And a Bout cannot be born open, which is the same rule reached by the other
-- door: its Outcomes are written after it, so a Bout inserted open has none at
-- all. Import writes every Bout `closed` and this never fires for it.
CREATE TRIGGER bouts_are_inserted_only_closed
  BEFORE INSERT ON "bouts"
  FOR EACH ROW WHEN (new.status <> 'closed')
  EXECUTE FUNCTION refuse_to_open_an_unpriced_bout();
