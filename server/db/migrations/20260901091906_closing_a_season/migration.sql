CREATE TABLE "final_standings" (
	"season_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"rank" integer NOT NULL,
	"balance" integer NOT NULL,
	"entries_played" integer NOT NULL,
	"frozen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "final_standings_season_id_user_id_pk" PRIMARY KEY("season_id","user_id"),
	CONSTRAINT "final_standings_rank_is_a_place" CHECK ("final_standings"."rank" >= 1),
	CONSTRAINT "final_standings_entries_played_is_counted" CHECK ("final_standings"."entries_played" >= 0)
);
--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "closed_by" uuid;--> statement-breakpoint
ALTER TABLE "final_standings" ADD CONSTRAINT "final_standings_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "final_standings" ADD CONSTRAINT "final_standings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "final_standings_one_fan_per_place" ON "final_standings" USING btree ("season_id","rank");--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- `add constraint ... check` validates the rows already in the table, so this
-- fails loudly on any Season that is already closed and carries no admin. No
-- such row can exist: until this migration there was no route, and no way at
-- all, to close a Season. If one does, it was hand-written, and failing here is
-- the right outcome — a frozen standing with nobody's name against the decision
-- is exactly the row a disputed Prize cannot be traced back through.
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_closing_is_recorded" CHECK (("seasons"."status" = 'closed') = ("seasons"."closed_by" is not null));--> statement-breakpoint
-- Write-once, held by Postgres rather than by convention.
--
-- The final standings are the evidence behind every Prize awarded under
-- ADR-0007, and evidence that can be edited afterwards is not evidence. The
-- same shape as `coin_transactions_are_append_only` in
-- `0003_seasons_and_the_coin_ledger.sql` and hand-written for the same reason:
-- Drizzle does not model triggers, it is not in the snapshot beside this file,
-- and nothing but `test/server/seasons.test.ts` proves it is still here.
--
-- Row-level, so `truncate` does not fire it and the test suite can still empty
-- the database between tests.
CREATE FUNCTION refuse_to_rewrite_the_final_standings() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'the final standings of a Season are frozen: % is refused', lower(tg_op)
    USING ERRCODE = 'restrict_violation',
          HINT = 'What a Season finished as is a record of a moment. Correct the Coin ledger instead.';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER final_standings_are_frozen
  BEFORE UPDATE OR DELETE ON "final_standings"
  FOR EACH ROW EXECUTE FUNCTION refuse_to_rewrite_the_final_standings();--> statement-breakpoint
-- A closed Season is never reopened, for the reason ADR-0006 makes a Lock
-- final: its standings are frozen and Prizes are decided on them, so a Season
-- that could be reopened is a record that could be made to say something else
-- afterwards. There is no route that tries; this is what makes that true of a
-- hand-typed `update` as well.
CREATE FUNCTION refuse_to_reopen_a_closed_season() RETURNS trigger AS $$
BEGIN
  IF old.status = 'closed' AND new.status <> 'closed' THEN
    RAISE EXCEPTION 'the Season "%" has closed and its final standings are frozen', old.name
      USING ERRCODE = 'restrict_violation',
            HINT = 'Open the next Season instead. Every fan starts it on the same 100 Coins.';
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER a_closed_season_is_never_reopened
  BEFORE UPDATE ON "seasons"
  FOR EACH ROW EXECUTE FUNCTION refuse_to_reopen_a_closed_season();
