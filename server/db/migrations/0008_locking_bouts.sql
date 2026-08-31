CREATE TABLE "bout_locks" (
	"bout_id" uuid PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"locked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_by" uuid,
	CONSTRAINT "bout_locks_kind_known" CHECK ("bout_locks"."kind" in ('manual', 'scheduled', 'sweep', 'result')),
	CONSTRAINT "bout_locks_manual_is_attributed" CHECK (("bout_locks"."locked_by" is not null) = ("bout_locks"."kind" in ('manual', 'result')))
);
--> statement-breakpoint
ALTER TABLE "bouts" DROP CONSTRAINT "bouts_status_known";--> statement-breakpoint
ALTER TABLE "bout_locks" ADD CONSTRAINT "bout_locks_bout_id_bouts_id_fk" FOREIGN KEY ("bout_id") REFERENCES "public"."bouts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bout_locks" ADD CONSTRAINT "bout_locks_locked_by_users_id_fk" FOREIGN KEY ("locked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bouts" ADD CONSTRAINT "bouts_status_known" CHECK ("bouts"."status" in ('closed', 'open', 'locked'));--> statement-breakpoint
-- A Lock is final: a Bout that has locked is never reopened (ADR-0006).
--
-- The whole point of locking a Bout is that it stops being predictable while
-- it is being fought. A Bout reopened afterwards — by a second press of a
-- button, by a route added later, by somebody correcting a mistake in SQL at
-- three in the morning — is a Bout somebody can commit Coins to knowing how it
-- went. There is no correction worth that, and the correction the domain
-- actually has is a No Result (ADR-0005), which does not need the Bout open.
--
-- Written by hand because Drizzle does not model triggers; it is not in the
-- snapshot beside this file and `drizzle-kit generate` will never notice it is
-- missing, so nothing but `test/server/bouts.test.ts` proves it is still here.
--
-- The message opens with the trigger's own name so that the route can
-- recognise its question coming back as a refusal, the way `refusedByConstraint`
-- in `server/utils/db.ts` recognises a named index.
CREATE FUNCTION refuse_to_reopen_a_locked_bout() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'a_locked_bout_is_never_reopened: bout % is locked and was asked to become %',
    old.id, new.status
    USING ERRCODE = 'restrict_violation',
          HINT = 'A Lock is the moment a Bout stopped taking Predictions. It is never taken back.';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER a_locked_bout_is_never_reopened
  BEFORE UPDATE ON "bouts"
  FOR EACH ROW WHEN (old.status = 'locked' AND new.status <> 'locked')
  EXECUTE FUNCTION refuse_to_reopen_a_locked_bout();--> statement-breakpoint
-- Every Lock is recorded, and every record is of a Lock.
--
-- The ticket asks for "who did it and when" on every Lock, and a log with a
-- gap in it is not one: the Bout a fan is complaining about is exactly the
-- Bout whose row somebody forgot to write. So it is not left to whichever
-- statement locks a Bout to remember — a Bout that is locked without a row in
-- `bout_locks` does not commit, whatever locked it.
--
-- Both directions, because a record of a Lock that did not happen is the same
-- lie told backwards: a row here for a Bout still taking Predictions would
-- answer a fan with a moment that never came.
--
-- A constraint trigger, deferred to the end of the transaction, because
-- neither end can be checked while it is being written — the status and the
-- record are two writes and one of them is second. Both tables carry it, so
-- that either written alone is refused.
CREATE FUNCTION refuse_a_lock_nobody_recorded() RETURNS trigger AS $$
DECLARE
  bout uuid;
  state text;
  recorded integer;
BEGIN
  -- Two statements rather than one expression choosing between them: plpgsql
  -- resolves every field of `new` an expression mentions before it runs, so a
  -- `case` naming `new.bout_id` fails on the `bouts` row it was not meant to
  -- read it from.
  IF tg_table_name = 'bouts' THEN
    bout := new.id;
  ELSE
    bout := new.bout_id;
  END IF;

  SELECT status INTO state FROM bouts WHERE id = bout;

  -- The Bout is gone by the time this is checked, which the foreign key on
  -- `bout_locks` has its own opinion about. There is no Lock left to hold to a
  -- record, and nothing this can usefully say.
  IF state IS NULL THEN
    RETURN null;
  END IF;

  SELECT count(*) INTO recorded FROM bout_locks WHERE bout_id = bout;

  IF (state = 'locked') = (recorded = 1) THEN
    RETURN null;
  END IF;

  RAISE EXCEPTION 'locked_bouts_are_recorded: bout % is % and has % Lock record(s)',
    bout, state, recorded
    USING ERRCODE = 'restrict_violation',
          HINT = 'A Bout is locked and recorded as locked in one transaction, or neither.';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER locked_bouts_are_recorded
  AFTER UPDATE ON "bouts"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW WHEN (new.status = 'locked')
  EXECUTE FUNCTION refuse_a_lock_nobody_recorded();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER locked_bouts_are_recorded
  AFTER INSERT ON "bout_locks"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION refuse_a_lock_nobody_recorded();--> statement-breakpoint
-- The Lock audit log is append-only, for the reason ADR-0003 gives about the
-- Coin ledger: a log somebody can edit answers nothing. The question it exists
-- to answer — "why did my Bout lock when it did?" — is asked after the fact,
-- by a fan who is unhappy, and an answer that could have been tidied up in
-- between is not one.
--
-- Deliberately row-level: `truncate` does not fire it, so the test suite can
-- still empty the database between tests, and no ordinary statement can get
-- past it.
CREATE FUNCTION refuse_to_rewrite_a_lock_record() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'bout_locks_are_append_only: % is refused', lower(tg_op)
    USING ERRCODE = 'restrict_violation',
          HINT = 'A Lock is what happened. It is not corrected, because it is never undone.';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER bout_locks_are_append_only
  BEFORE UPDATE OR DELETE ON "bout_locks"
  FOR EACH ROW EXECUTE FUNCTION refuse_to_rewrite_a_lock_record();
