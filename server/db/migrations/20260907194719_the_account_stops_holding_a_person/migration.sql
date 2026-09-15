-- The account stops holding a person, and starts holding a phone number
-- (ADR-0018).
--
-- Prizes are no longer part of TFC Predictions, and three columns on `users`
-- existed only because they were. `first_name` and `last_name` were held so a
-- Prize could be matched to a person and were never returned by any endpoint;
-- `date_of_birth` was the only evidence of the 18+ gate, and that gate was
-- published under ADR-0007 as a constraint of a contest awarding Prizes. With
-- the contest gone there is nothing left for any of the three to be evidence
-- of, so this drops them rather than leaving personal data on the table with
-- no purpose to point at.
--
-- **The three drops are irreversible and the data is not recoverable from
-- anywhere else.** Nothing else in this schema ever held a real name or a date
-- of birth — that was the point of them being `returned: false` — so there is
-- no join that could reconstruct these columns after this runs. That is
-- intended: an account that no longer needs a fan's legal name should not
-- still be storing one.
--
-- **`phone` arrives nullable, unlike `discipline` in
-- `20260904163914_the_discipline_a_bout_is_fought_in`.** That migration
-- backfilled every Bout with `'mma'` because it was what those rows already
-- were. Nothing of the sort is true here: an account created before this
-- migration has no phone number, and any value written into it would be a
-- number that reaches nobody. So the gap is left visible instead —
-- `select id, email from users where phone is null` is the list of fans TFC
-- has to ask — and requiredness is enforced at the only place a new account is
-- created, `parseSignUpDetails` in `shared/signUp.ts` and the `required` field
-- in `server/utils/auth.ts`.
--
-- **`users_phone_unique` is the whole of "one account per person"** now that
-- ADR-0018 has retired the email confirmation that used to be it. Postgres
-- treats nulls as distinct in a unique index, so the accounts left null above
-- neither collide with each other nor weaken the rule for anyone who does
-- carry a number. It is a plain index rather than a lower-cased one, unlike
-- `users_username_unique`: a phone number has no case, and `normalisePhone`
-- has already reduced the one stored here to a single E.164 spelling — without
-- that normalisation this index would happily hold `+995 555 123456` beside
-- `+995555123456` and call them two people. The `user.create.before` hook in
-- `server/utils/auth.ts` is what guarantees it runs on every route rather than
-- only on the form, which is what makes this index worth having.
--
-- `email_verified` is deliberately untouched. It is `better-auth`'s own column
-- and its user model requires it; what changed is that nothing in this
-- application reads it any more.

ALTER TABLE "users" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "first_name";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "last_name";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "date_of_birth";--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_unique" ON "users" ("phone");
