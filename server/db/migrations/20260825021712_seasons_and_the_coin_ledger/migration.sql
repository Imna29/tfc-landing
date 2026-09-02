CREATE TABLE "balance_cache" (
	"season_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"balance" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "balance_cache_season_id_user_id_pk" PRIMARY KEY("season_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "coin_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"amount" integer NOT NULL,
	"reason" text NOT NULL,
	"cause" text NOT NULL,
	"cause_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coin_transactions_kind_known" CHECK ("coin_transactions"."kind" in ('season_grant')),
	CONSTRAINT "coin_transactions_cause_known" CHECK ("coin_transactions"."cause" in ('season')),
	CONSTRAINT "coin_transactions_moves_coins" CHECK ("coin_transactions"."amount" <> 0),
	CONSTRAINT "coin_transactions_reason_is_written" CHECK (length(trim("coin_transactions"."reason")) > 0),
	CONSTRAINT "coin_transactions_grant_is_the_starting_balance" CHECK ("coin_transactions"."kind" <> 'season_grant' or ("coin_transactions"."amount" = 100
        and "coin_transactions"."cause" = 'season' and "coin_transactions"."cause_id" = "coin_transactions"."season_id"))
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"opened_by" uuid NOT NULL,
	"closed_at" timestamp with time zone,
	CONSTRAINT "seasons_status_known" CHECK ("seasons"."status" in ('open', 'closed')),
	CONSTRAINT "seasons_closed_is_dated" CHECK (("seasons"."status" = 'closed') = ("seasons"."closed_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "balance_cache" ADD CONSTRAINT "balance_cache_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "balance_cache" ADD CONSTRAINT "balance_cache_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coin_transactions" ADD CONSTRAINT "coin_transactions_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coin_transactions" ADD CONSTRAINT "coin_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_opened_by_users_id_fk" FOREIGN KEY ("opened_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "coin_transactions_one_grant_per_fan" ON "coin_transactions" USING btree ("user_id","season_id") WHERE "coin_transactions"."kind" = 'season_grant';--> statement-breakpoint
CREATE INDEX "coin_transactions_by_fan" ON "coin_transactions" USING btree ("season_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "seasons_name_unique" ON "seasons" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "seasons_one_open" ON "seasons" USING btree ("status") WHERE "seasons"."status" = 'open';--> statement-breakpoint
-- Append-only, held by Postgres rather than by convention (ADR-0003).
--
-- Written by hand because Drizzle does not model triggers; it is not in the
-- snapshot beside this file and `drizzle-kit generate` will never notice it is
-- missing, so nothing but `test/server/coins.test.ts` proves it is still here.
--
-- Deliberately row-level: `truncate` does not fire it, so the test suite can
-- still empty the database between tests, and no ordinary statement can get
-- past it.
CREATE FUNCTION refuse_to_rewrite_the_coin_ledger() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'the Coin ledger is append-only: % is refused', lower(tg_op)
    USING ERRCODE = 'restrict_violation',
          HINT = 'Correct a Coin Transaction by writing a reversing one.';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER coin_transactions_are_append_only
  BEFORE UPDATE OR DELETE ON "coin_transactions"
  FOR EACH ROW EXECUTE FUNCTION refuse_to_rewrite_the_coin_ledger();
