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
import {
  type AttributedLockKind,
  automaticLock,
  type AutomaticLock,
  type BoutLock,
  type CardLockKind,
  SWEEP_AFTER,
} from "#shared/locks";
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
 * A misspelled setting throws rather than falling back to the default, which
 * takes the card and every submission with it until somebody fixes the
 * environment. That is the intended blast radius, and it is the shape
 * `useDatabase` already refuses a missing `DATABASE_URL` with: a typo is found
 * in the first minute by whoever deployed it, rather than six hours into a
 * live card by a backstop that quietly went back to being six hours long.
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

/**
 * The moment a card is read against, and how long its last backstop is.
 *
 * The two travel together everywhere a Bout's state is worked out, and they
 * are separate answers to the same question — when is this Lock due? `now` is
 * one moment for a whole request, so a Bout cannot be open for the first
 * Prediction of an Entry and locked for the fourth. `sweepAfter` is
 * configuration, read from {@link sweepWindow} at the edge and passed inwards,
 * so that the modules deciding what a fan is told do not read the environment.
 */
export interface AsAt {
  now: Date;
  sweepAfter: number;
}

/**
 * The smallest card order on the Bout's own card, which is what
 * {@link automaticLock} compares a Bout against.
 *
 * A fragment rather than three copies of the same correlated subquery: every
 * reader of a Bout's Lock moment needs it, and it is the kind of SQL that goes
 * subtly wrong when it is retyped. The inner `bouts` is aliased so the
 * `event_id` in its `where` is unmistakably its own, and `events.id` is the
 * outer row it is correlated against — so a query using this must have joined
 * `events`.
 */
export const firstOnTheCard = sql<number>`(
  select min(place.card_order) from ${bouts} as place where place.event_id = ${events.id}
)`.mapWith(Number);

/**
 * When this Bout locks by itself, from the three columns every reader of one
 * selects.
 *
 * `automaticLock` in `shared/locks.ts` is the rule; this is the shape it is
 * asked in on the server, where a Bout arrives as rows rather than as a card.
 */
export function lockMomentOf(
  bout: { cardOrder: number; firstOnTheCard: number; scheduledStart: Date },
  sweepAfter: number,
): AutomaticLock {
  return automaticLock(
    bout.cardOrder,
    bout.firstOnTheCard,
    bout.scheduledStart.toISOString(),
    sweepAfter,
  );
}

/** A Bout the card locked on its own, and the record it left behind. */
export interface LockedBout {
  boutId: string;
  kind: CardLockKind;
  /** The moment it fell due, which is the moment it is recorded at. */
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
 *
 * Only the two attributed kinds can be written here, because those are the
 * only two anybody performs: the clock's own Locks are
 * {@link applyAutomaticLocks}'s to write, and it dates them at the moment they
 * fell due rather than at now. The type is what says so, so that
 * `bout_locks_manual_is_attributed` is a rule this module cannot reach.
 */
export async function lockBout(
  on: DatabaseConnection,
  lock: { boutId: string; kind: AttributedLockKind; by: string },
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
 * care what a Bout's state is: the public card, an Entry being submitted or
 * cancelled, the listing a fan reads their Entries in, and the admin area. A
 * card nobody is looking at locks the moment somebody looks, and the Lock is
 * still dated at the moment it fell due — so the log says what happened rather
 * than when it was noticed.
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

  const locked = await on.execute<{ bout_id: string; kind: CardLockKind; locked_at: Date }>(sql`
    with still_open as (
      -- Every open Bout in the game rather than one card's, deliberately: the
      -- backstop a card most needs is the one on the card nobody is looking
      -- at. There are a dozen Bouts to a card and a handful of cards, so this
      -- is a small scan on a small table, not a query to be careful of.
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
