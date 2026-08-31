/**
 * Locking Bouts in Postgres: the admin's own Locks, and the backstops that
 * lock a card nobody is watching over.
 *
 * `shared/locks.ts` decides *when* a Bout locks by itself and what a Lock is
 * called; this is what writes one down. Two rules are worth knowing before
 * changing anything here:
 *
 * - **A Lock and its record are one write.** Every statement below sets the
 *   status and inserts the audit row in a single statement, so there is no
 *   moment in which a Bout has locked and nobody knows who did it. The
 *   `locked_bouts_are_recorded` constraint trigger refuses the transaction
 *   that tries.
 * - **A Lock is dated at the moment the Bout stopped taking Predictions**, not
 *   at the moment a row was written. An automatic Lock falls due while nobody
 *   is looking and is applied by whichever request arrives next; dating it at
 *   the second of those would answer a fan's "why did my Bout close?" with a
 *   moment that has nothing to do with them.
 *
 * There is no unlocking here, and there is nowhere else either: ADR-0006 makes
 * a Lock final, and `a_locked_bout_is_never_reopened` is what holds it.
 */
import { type BoutLock, type LockKind, SWEEP_AFTER } from "#shared/locks";
import { eq, inArray, sql } from "drizzle-orm";
import type { DatabaseConnection } from "../db/client";
import { boutLocks, bouts, events, users } from "../db/schema";
import { useDatabase } from "./db";

/** The name of the trigger that refuses to reopen a Bout that has locked. */
export const A_LOCKED_BOUT_IS_NEVER_REOPENED = "a_locked_bout_is_never_reopened";

/** The name of the constraint trigger that holds every Lock to a record. */
export const LOCKED_BOUTS_ARE_RECORDED = "locked_bouts_are_recorded";

/** The name of the trigger that refuses to rewrite the Lock audit log. */
export const BOUT_LOCKS_ARE_APPEND_ONLY = "bout_locks_are_append_only";

/**
 * How long after a card's scheduled start every Bout still open is locked
 * regardless, in milliseconds.
 *
 * `LOCK_SWEEP_HOURS` over the six hours `SWEEP_AFTER` defaults to, so that TFC
 * can shorten the last backstop for a card format that runs differently
 * without a deploy. Read on every call rather than once, because the tests
 * that prove the sweep works cannot wait six hours for it.
 *
 * A misspelled setting throws rather than falling back to the default. A
 * backstop that silently reverted to six hours because somebody typed
 * `LOCK_SWEEP_HOURS="4h"` would be found the night it mattered.
 */
export function sweepWindow(): number {
  const setting = process.env.LOCK_SWEEP_HOURS;

  if (!setting) return SWEEP_AFTER;

  const hours = Number(setting);

  if (!Number.isFinite(hours) || hours <= 0) {
    throw new Error(`LOCK_SWEEP_HOURS must be a positive number of hours, not "${setting}".`);
  }

  return hours * 60 * 60 * 1000;
}

/** A Bout the game has locked, and the record it left behind. */
export interface LockedBout {
  boutId: string;
  kind: LockKind;
  at: Date;
}

/**
 * Locks one Bout and records who locked it, answering whether this call is
 * what locked it.
 *
 * `false` is not a failure. It is a Bout that was not open when this ran: one
 * already locked by an admin a second earlier, one nobody had opened, or one a
 * re-import has taken away. The caller asked first and can say which, and this
 * is what makes two admins pressing the button at the same moment harmless —
 * `status = 'open'` in the `where` is the whole of it, because the loser of
 * that race re-reads the row and finds it locked.
 *
 * Takes the connection to run on rather than reaching for one, so that
 * settlement (#14) can lock a Bout in the same transaction it grades and pays
 * from — a result entered and a Bout still taking Predictions afterwards is
 * exactly the gap ADR-0006 asks for backstops against, and on a serverless
 * function there is no second connection to reach for anyway (ADR-0010).
 */
export async function lockBout(
  on: DatabaseConnection,
  lock: { boutId: string; kind: LockKind; by: string | null },
): Promise<boolean> {
  const locked = await on.execute<{ bout_id: string }>(sql`
    with locked as (
      update ${bouts} set status = 'locked'
      where ${bouts.id} = ${lock.boutId}::uuid and ${bouts.status} = 'open'
      returning ${bouts.id}
    )
    insert into ${boutLocks} (bout_id, kind, locked_by)
    select locked.id, ${lock.kind}, ${lock.by}::uuid from locked
    returning bout_id
  `);

  return locked.length > 0;
}

/**
 * Locks every Bout whose own Lock moment has passed, and answers with what it
 * locked.
 *
 * These are the two backstops ADR-0006 calls mandatory rather than optional:
 * the Bout fought first locks when the card starts, and everything still open
 * locks a window after that whatever an admin remembered to do. Between them
 * they mean that forgetting to lock a Bout costs a Bout predictable for
 * minutes rather than one predictable while it is being fought — which is the
 * one failure that lets a fan win with certainty.
 *
 * Nothing schedules this. The deployment target is a serverless function with
 * no cron beside it (ADR-0009, ADR-0010), so it is run by the requests that
 * care what a Bout's state is: the public card, an Entry being submitted, and
 * the admin area. A card nobody is looking at locks the moment somebody looks,
 * and the Lock is still dated at the moment it fell due — so the log says what
 * happened rather than when it was noticed.
 *
 * The refusal a fan meets does not depend on this having run. `automaticLock`
 * is asked directly while an Entry is being priced, so a Bout whose moment has
 * passed is refused whether or not a row has been written yet. This is what
 * makes the state a fact, and the audit log an answer.
 *
 * One statement, so that the whole sweep is atomic and two requests arriving
 * together cannot both lock the same Bout: the second finds the row already
 * locked and writes nothing.
 */
export async function applyAutomaticLocks(
  now: Date = new Date(),
  on: DatabaseConnection = useDatabase(),
): Promise<LockedBout[]> {
  const seconds = sweepWindow() / 1000;

  const locked = await on.execute<{ bout_id: string; kind: LockKind; locked_at: Date }>(sql`
    with still_open as (
      select
        bout.id,
        card.scheduled_start,
        bout.card_order = (
          select min(place.card_order) from ${bouts} as place where place.event_id = bout.event_id
        ) as first_on_the_card
      from ${bouts} as bout
      join ${events} as card on card.id = bout.event_id
      where bout.status = 'open'
    ),
    due as (
      select
        id,
        case when first_on_the_card then 'scheduled' else 'sweep' end as kind,
        case
          when first_on_the_card then scheduled_start
          else scheduled_start + make_interval(secs => ${seconds}::double precision)
        end as locked_at
      from still_open
    ),
    overdue as (
      select id, kind, locked_at from due where locked_at <= ${now.toISOString()}::timestamptz
    ),
    locked as (
      update ${bouts} set status = 'locked'
      from overdue
      where ${bouts.id} = overdue.id and ${bouts.status} = 'open'
      returning ${bouts.id}
    )
    insert into ${boutLocks} (bout_id, kind, locked_at)
    select overdue.id, overdue.kind, overdue.locked_at
    from overdue join locked on locked.id = overdue.id
    returning bout_id, kind, locked_at
  `);

  return locked.map((row) => ({ boutId: row.bout_id, kind: row.kind, at: row.locked_at }));
}

/**
 * The Lock on each of these Bouts, by Bout id, for the ones that have locked.
 *
 * The admin area's answer to "why did this Bout close when it did?", which is
 * the question the log exists for. Read for a whole card at once rather than a
 * Bout at a time, because that is how an admin looks at it: down the card,
 * after the event, with a fan's complaint in hand.
 */
export async function locksOn(boutIds: readonly string[]): Promise<Map<string, BoutLock>> {
  if (boutIds.length === 0) return new Map();

  const recorded = await useDatabase()
    .select({
      boutId: boutLocks.boutId,
      kind: boutLocks.kind,
      lockedAt: boutLocks.lockedAt,
      by: users.username,
    })
    .from(boutLocks)
    .leftJoin(users, eq(users.id, boutLocks.lockedBy))
    .where(inArray(boutLocks.boutId, boutIds));

  return new Map(
    recorded.map((lock) => [
      lock.boutId,
      { kind: lock.kind, at: lock.lockedAt.toISOString(), by: lock.by },
    ]),
  );
}
