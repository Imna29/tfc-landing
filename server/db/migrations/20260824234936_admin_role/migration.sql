ALTER TABLE "users" ADD COLUMN "role" text DEFAULT 'fan' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_known" CHECK ("users"."role" in ('fan', 'admin'));