/**
 * What TFC Predictions adds to a fight card: what each answer pays, whether a
 * Bout is still taking answers, and when it stops.
 *
 * `shared/fightCard.ts` is the card itself and knows none of this. The two are
 * apart on purpose — a card is worth showing wherever a lineup is, and only
 * this half is about the game — and they meet in one place, as the optional
 * prop `app/components/FightCard.vue` takes.
 *
 * Shared for the same reason `shared/pricing.ts` is: the server decides what a
 * fan is shown and the page says it in these words, and
 * `test/unit/vocabulary.test.ts` holds all of it to `CONTEXT.md` at once.
 */
import type { BoutStatus } from "./events";
import type { FightCard, FightCardBout } from "./fightCard";
import { firstFought } from "./locks";
import type { OutcomeAnswer } from "./pricing";

/**
 * Where a Bout is, as a fan reads it.
 *
 * The same values `bouts.status` holds, and for three of them this is only
 * reading the column back. The other is the one worth having: a Bout locks at
 * a moment the card decides, and the row saying so is written by the next
 * request to arrive (`applyAutomaticLocks` in `server/utils/locks.ts`) — so
 * between those two instants the column still says `open`. Working the state
 * out here rather than trusting the column means a card cannot offer answers on
 * a Bout that is already being fought.
 *
 * `settled` is told apart from `locked` for the same reason: they are two
 * different pieces of news. A locked Bout is being fought, and a fan is waiting
 * to find out; a settled Bout is over and their Entry has been graded against
 * what happened.
 */
export type BoutState = "closed" | "open" | "locked" | "settled";

/** What each state is called wherever a fan reads one. */
export const BOUT_STATE_LABELS = {
  closed: "Not open yet",
  open: "Open for predictions",
  locked: "Locked",
  settled: "Result in",
} as const satisfies Record<BoutState, string>;

/**
 * Where a Bout is at a given moment.
 *
 * A Bout nobody has opened stays closed however late it gets: a Lock is the
 * moment a Bout stops accepting Predictions, and one that never started
 * accepting them has nothing to stop.
 */
export function boutState(
  bout: { status: BoutStatus; locksAt: string | null },
  now: number,
): BoutState {
  if (bout.status !== "open") return bout.status;

  if (bout.locksAt !== null && Date.parse(bout.locksAt) <= now) return "locked";

  return "open";
}

/**
 * The moment a Bout locks by itself, or null on one an admin advances.
 *
 * ADR-0006: the Bout fought first locks automatically at the card's scheduled
 * start, and the rest are locked by an admin as the card progresses — so it is
 * the only Bout on a card whose Lock is a moment rather than a decision. It is
 * what {@link boutState} reads to call that Bout locked the instant it is,
 * without waiting for the row to be written.
 *
 * Deliberately not the sweep that stands behind every other Bout
 * (`automaticLock` in `shared/locks.ts`). That moment is hours out and will
 * almost never be the one: an admin locks Bout 6 when Bout 6 is fought, long
 * before its backstop. Answering "this locks at 23:40" for a Bout that will
 * lock at 21:15 is worse than saying nothing, so the rest of the card says
 * nothing — and the card no longer counts any of them down at all.
 */
export function locksAt(bout: FightCardBout, card: FightCard): string | null {
  return bout.cardOrder === firstFought(card.bouts) ? card.scheduledStart : null;
}

/** One answer a fan can give, and what it pays. */
export interface OfferedOutcome extends OutcomeAnswer {
  id: string;
  multiplier: number;
}

/** What the game holds against one Bout of the card being shown. */
export interface BoutPredictions {
  /** The row a Prediction points at, and an Entry is submitted against. */
  boutId: string;
  status: BoutStatus;
  /** The moment it locks by itself, or null on one an admin advances. */
  locksAt: string | null;
  /**
   * Every answer offered, in the order they are asked.
   *
   * Empty until the Bout is open, deliberately. Every Outcome arrives from
   * import carrying a Multiplier seeded from a fixed table, and ADR-0002 is
   * emphatic that a seeded number is not a price — nothing that wrote it knows
   * which fighter is favoured. A Bout cannot be opened until an admin has
   * priced every Outcome on it, so showing them from the moment it opens is
   * showing only numbers somebody chose.
   */
  outcomes: OfferedOutcome[];
}

/** A card as TFC Predictions holds it, beside the card itself. */
export interface CardPredictions {
  /**
   * The server's clock when it answered.
   *
   * Which moment a Bout's state is read against has to be the same number on
   * both sides of hydration: starting from the browser's own clock would render
   * one answer on the server and a different one a moment later in the browser
   * — a mismatch Vue warns about, and a page that disagrees with itself about
   * whether a Bout has locked. The page reads from here until it is mounted,
   * and from the browser's clock afterwards. See `useNow`.
   */
  answeredAt: string;
  /** What the game holds against each Bout, by its place on the card. */
  bouts: Record<number, BoutPredictions>;
}

/** What one answer pays, written the way a fan reads it: `×1.90`. */
export function multiplierLabel(multiplier: number): string {
  return `×${multiplier.toFixed(2)}`;
}

/** What the public card says to whoever is reading it. */
export const PREDICTION_MESSAGES = {
  noCard:
    "There is no fight card in TFC Predictions yet. The next one appears here " +
    "as soon as TFC has priced it.",
  notOpenYet:
    "What each answer pays is set before a Bout opens, so there is nothing to " +
    "weigh up on this one yet.",
  locked: "This Bout has locked. Nothing further can be predicted on it.",
  settled:
    "This Bout has been settled. Every Entry holding a Prediction on it has " +
    "been graded against what happened.",
} as const satisfies Record<string, string>;
