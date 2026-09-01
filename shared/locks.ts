/**
 * The Lock: the moment a Bout stops taking Predictions, and the record it
 * leaves behind.
 *
 * ADR-0006 locks Bouts one at a time as a card is fought, so that a fan can
 * still predict the main event while the opener is under way. That is the
 * engagement case for the whole product, and it is bought with an admin at a
 * keyboard for the length of every event — someone who is also watching the
 * fights. The three automatic backstops here are not enhancements to that.
 * They are what makes it survivable: a Bout left open while it is being fought
 * is the one failure that lets a fan win with certainty.
 *
 * Shared for the same reason `shared/pricing.ts` is: the server refuses with
 * the sentence the admin area shows, and `test/unit/vocabulary.test.ts` holds
 * all of it to `CONTEXT.md` at once.
 */

/**
 * How a Bout came to be locked, which is the "who did this, and when" a Lock
 * has to be able to answer.
 *
 * One of them is a person and three are the clock. `manual` is an admin
 * pressing the button — advancing the lock as the card progresses, or closing
 * one Bout early. The others are the backstops ADR-0006 calls mandatory:
 * `scheduled` is the card reaching its start with the first Bout still open,
 * `sweep` is the window afterwards passing with anything still open, and
 * `result` is a result being entered on a Bout nobody remembered to lock.
 *
 * Spelled out again in the `bout_locks_kind_known` check constraint, for the
 * reason given on `Role` in `server/db/schema.ts`.
 */
export type LockKind = "manual" | "scheduled" | "sweep" | "result";

/** Every kind of Lock, in the order an admin meets them on a live card. */
export const LOCK_KINDS = [
  "manual",
  "scheduled",
  "sweep",
  "result",
] as const satisfies readonly LockKind[];

/**
 * The two a card performs on itself, which is what {@link automaticLock}
 * answers with.
 *
 * Deliberately not "the automatic ones": a `result` Lock is nobody's decision
 * to lock that Bout either, and calling this subset automatic would leave the
 * word meaning two things a hundred lines apart. These two are the ones no
 * request and no person is behind — only the card reaching a moment.
 */
export type CardLockKind = Extract<LockKind, "scheduled" | "sweep">;

/**
 * The two that happen because somebody did something, and so are recorded
 * against them.
 *
 * `bout_locks_manual_is_attributed` says the same thing in SQL, and this is
 * what stops `lockBout` in `server/utils/locks.ts` writing a Lock that breaks
 * it: the admin is required by the type rather than discovered as a 500.
 */
export type AttributedLockKind = Extract<LockKind, "manual" | "result">;

/**
 * What each kind is called where an admin reads one.
 *
 * Written without apostrophes, deliberately. These are rendered into a page as
 * text, where Vue escapes one to `&#39;` — which is invisible to a reader and
 * highly visible to the test that checks the log is on the page.
 */
export const LOCK_KIND_LABELS = {
  manual: "Locked by an admin",
  scheduled: "Locked automatically when the card started",
  sweep: "Locked automatically by the backstop behind a live card",
  result: "Locked automatically when the result was entered",
} as const satisfies Record<LockKind, string>;

/**
 * How long after a card's scheduled start every Bout still open is locked
 * regardless.
 *
 * Six hours is an evening of fights: long enough that it never lands on a card
 * running late, short enough that a card nobody locked is closed the same
 * night. It is the last backstop of the three — reaching it means an admin
 * stopped advancing the lock partway through an event — so it is deliberately
 * generous rather than tight.
 *
 * A default rather than a constant: `sweepWindow` in `server/utils/locks.ts`
 * reads `LOCK_SWEEP_HOURS` over it, so TFC can shorten it for a card format
 * that runs differently without a deploy.
 */
export const SWEEP_AFTER = 6 * 60 * 60 * 1000;

/**
 * Where a card starts: the smallest card order on it, which is the Bout fought
 * first.
 *
 * Said here because three readers ask it and they must never disagree — the
 * card a fan is counted down on (`locksAt` in `shared/predictions.ts`), the
 * console working out which Lock each Bout is waiting on, and, in SQL because
 * it has to be, `firstOnTheCard` in `server/utils/locks.ts`.
 *
 * Not the number 1: a Bout dropped from a lineup leaves the place it had.
 *
 * A card is in hand wherever this is asked, so a card with no Bouts is not a
 * case worth answering — `Math.min()` of nothing is `Infinity`, and a card with
 * no Bouts has nothing to lock or to count down either.
 */
export function firstFought(bouts: readonly { cardOrder: number }[]): number {
  return Math.min(...bouts.map((bout) => bout.cardOrder));
}

/** When a Bout locks with nobody doing anything, and what that Lock is. */
export interface AutomaticLock {
  /** The moment itself, which is what a Lock record is dated with. */
  at: string;
  kind: CardLockKind;
}

/**
 * When this Bout locks by itself.
 *
 * Every Bout has one. The Bout fought first locks at the card's scheduled
 * start, which is the Lock ADR-0006 promises a fan a countdown to; every other
 * Bout is an admin's to advance, with the sweep behind it for the evening they
 * do not.
 *
 * Said once here because three things ask it and they must never disagree: the
 * statement that writes the Locks, the refusal a fan gets for submitting into
 * one, and the moment the audit log dates it at. A Lock recorded at the moment
 * a sweep happened to run rather than the moment it fell due would be an
 * answer nobody could give a fan asking why their Bout closed.
 *
 * `firstOnTheCard` is the smallest card order on the card, not the number 1: a
 * Bout dropped from a lineup leaves the place it had.
 */
export function automaticLock(
  cardOrder: number,
  firstOnTheCard: number,
  scheduledStart: string,
  sweepAfter: number,
): AutomaticLock {
  if (cardOrder === firstOnTheCard) return { at: scheduledStart, kind: "scheduled" };

  return {
    at: new Date(Date.parse(scheduledStart) + sweepAfter).toISOString(),
    kind: "sweep",
  };
}

/** One Lock, as the admin area shows it. */
export interface BoutLock {
  kind: LockKind;
  /** The moment the Bout stopped taking Predictions. */
  at: string;
  /**
   * The username of the admin whose action locked it, or null where the clock
   * did. A username rather than an id: it is the only name TFC shows for
   * anybody, admins included (`CONTEXT.md`).
   */
  by: string | null;
}

/** What locking a Bout says to the admin doing it. */
export const LOCK_MESSAGES = {
  alreadyLocked:
    "This Bout has already locked, and a Lock is never taken back. Whatever " +
    "was predicted on it before it locked is what settles against the result.",
  notOpen:
    "This Bout is not open for predictions, so there is nothing to lock. Open " +
    "it first — a Bout nobody has opened has taken nothing to stop taking.",
} as const satisfies Record<string, string>;
