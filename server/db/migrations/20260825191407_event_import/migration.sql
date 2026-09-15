CREATE TABLE "bouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"card_order" integer NOT NULL,
	"status" text DEFAULT 'closed' NOT NULL,
	"red_name" text NOT NULL,
	"red_fighter_id" text,
	"red_fighter_uid" text,
	"red_image_url" text,
	"blue_name" text NOT NULL,
	"blue_fighter_id" text,
	"blue_fighter_uid" text,
	"blue_image_url" text,
	"division" text NOT NULL,
	"scheduled_rounds" integer NOT NULL,
	"main_event" boolean DEFAULT false NOT NULL,
	"title_fight" boolean DEFAULT false NOT NULL,
	CONSTRAINT "bouts_status_known" CHECK ("bouts"."status" in ('closed', 'open')),
	CONSTRAINT "bouts_card_order_is_a_place" CHECK ("bouts"."card_order" >= 1),
	CONSTRAINT "bouts_rounds_are_scheduled" CHECK ("bouts"."scheduled_rounds" between 1 and 12),
	CONSTRAINT "bouts_corners_are_named" CHECK (length(trim("bouts"."red_name")) > 0 and length(trim("bouts"."blue_name")) > 0),
	CONSTRAINT "bouts_corners_are_two_fighters" CHECK ("bouts"."red_fighter_id" is null or "bouts"."red_fighter_id" <> "bouts"."blue_fighter_id"),
	CONSTRAINT "bouts_division_is_written" CHECK (length(trim("bouts"."division")) > 0)
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"prismic_id" text NOT NULL,
	"title" text NOT NULL,
	"scheduled_start" timestamp with time zone NOT NULL,
	"venue" text NOT NULL,
	"poster_url" text,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"imported_by" uuid NOT NULL,
	CONSTRAINT "events_title_is_written" CHECK (length(trim("events"."title")) > 0),
	CONSTRAINT "events_venue_is_written" CHECK (length(trim("events"."venue")) > 0)
);
--> statement-breakpoint
ALTER TABLE "bouts" ADD CONSTRAINT "bouts_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_imported_by_users_id_fk" FOREIGN KEY ("imported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bouts_one_per_place_on_the_card" ON "bouts" USING btree ("event_id","card_order");--> statement-breakpoint
CREATE UNIQUE INDEX "bouts_one_main_event" ON "bouts" USING btree ("event_id") WHERE "bouts"."main_event";--> statement-breakpoint
CREATE UNIQUE INDEX "events_one_per_prismic_document" ON "events" USING btree ("prismic_id");--> statement-breakpoint
CREATE INDEX "events_by_scheduled_start" ON "events" USING btree ("scheduled_start");--> statement-breakpoint
-- A Bout that has been opened is never replaced, held by Postgres rather than
-- by the route that asks first (ADR-0001).
--
-- Re-importing a card deletes its Bouts and writes them again, which is how a
-- lineup change gets pulled through. Once a Bout is open, fans hold Coins
-- against that row, and deleting it would leave their Predictions pointing at
-- a fight that no longer exists.
--
-- Written by hand because Drizzle does not model triggers; it is not in the
-- snapshot beside this file and `drizzle-kit generate` will never notice it is
-- missing.
--
-- `delete` only, deliberately. An `update` guard would refuse #12 locking a
-- Bout and #14 settling one, which are exactly what an open Bout is for.
-- Row-level, so `truncate` does not fire it and the test suite can still empty
-- the database between tests.
--
-- The message opens with the trigger's own name so that the route can
-- recognise its question coming back as a refusal, the way `refusedByConstraint`
-- in `server/utils/db.ts` recognises a named index.
CREATE FUNCTION refuse_to_replace_an_opened_bout() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'bouts_are_replaced_only_while_closed: bout % is %', old.id, old.status
    USING ERRCODE = 'restrict_violation',
          HINT = 'Re-import a card only while every Bout on it is still closed.';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER bouts_are_replaced_only_while_closed
  BEFORE DELETE ON "bouts"
  FOR EACH ROW WHEN (old.status <> 'closed')
  EXECUTE FUNCTION refuse_to_replace_an_opened_bout();
