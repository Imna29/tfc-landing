-- A fan judges a matchup on the two records beside the two names (#10), and
-- the card they read has to render from one query — so a record is copied out
-- of the `fighter` document at import, the way the image already is, rather
-- than fetched from Prismic while a page is being rendered.
--
-- Nullable, and deliberately: a fallback name has no document to take one
-- from, and a published fighter may simply not have had it filled in. Neither
-- is a reason a card cannot be imported.
ALTER TABLE "bouts" ADD COLUMN "red_record" text;--> statement-breakpoint
ALTER TABLE "bouts" ADD COLUMN "blue_record" text;
