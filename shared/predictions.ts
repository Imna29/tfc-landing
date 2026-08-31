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
import type { OutcomeAnswer } from "./pricing";

/**
 * Where a Bout is, as a fan reads it.
 *
 * The same three values `bouts.status` holds, and for two of them this is only
 * reading the column back. The third is the one worth having: a Bout locks at
 * a moment the card decides, and the row saying so is written by the next
 * request to arrive (`applyAutomaticLocks` in `server/utils/locks.ts`) — so
 * between those two instants the column still says `open`. Working the state
 * out here rather than trusting the column means a countdown reaching zero and
 * the words beside it can never disagree.
 */
export type BoutState = "closed" | "open" | "locked";

/** What each state is called wherever a fan reads one. */
export const BOUT_STATE_LABELS = {
  closed: "Not open yet",
  open: "Open for predictions",
  locked: "Locked",
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
 * The Lock a fan is counted down to, or null on a Bout an admin advances.
 *
 * ADR-0006: the Bout fought first locks automatically at the card's scheduled
 * start, and the rest are locked by an admin as the card progresses — so it is
 * the only Bout on a card with a moment a fan can watch arrive.
 *
 * Deliberately not the sweep that stands behind every other Bout
 * (`automaticLock` in `shared/locks.ts`). That moment is hours out and will
 * almost never be the one: an admin locks Bout 6 when Bout 6 is fought, long
 * before its backstop. Counting a fan down to a moment that is not going to be
 * the moment is worse than telling them an admin decides it, so what the rest
 * of the card gets is `PREDICTION_MESSAGES.locksWhenReached`.
 */
export function locksAt(bout: FightCardBout, card: FightCard): string | null {
  const first = Math.min(...card.bouts.map((one) => one.cardOrder));

  return bout.cardOrder === first ? card.scheduledStart : null;
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
  /** The Lock a fan can watch arrive, or null on one an admin advances. */
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
   * A countdown has to start somewhere, and starting it at the browser's clock
   * would render one number on the server and a different one a moment later
   * in the browser — a hydration mismatch, and a page that disagrees with
   * itself about whether a Bout has locked. The page counts from here until it
   * is mounted, and from the browser's own clock afterwards.
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
  locksWhenReached: "This Bout locks when the card reaches it.",
  locked: "This Bout has locked. Nothing further can be predicted on it.",
} as const satisfies Record<string, string>;
