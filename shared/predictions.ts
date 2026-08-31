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
 * The first two are the `bouts.status` Postgres holds. The third is not a
 * status at all today — it is what the passing of a Lock moment makes of an
 * open Bout, worked out wherever the card is being read, so a countdown
 * reaching zero and the words beside it can never disagree. #12 gives a locked
 * Bout a status of its own, and this keeps saying the same thing when it does.
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
 * When a Bout locks without anybody doing anything, or null for one an admin
 * advances by hand.
 *
 * ADR-0006: the Bout fought first locks automatically at the card's scheduled
 * start, and the rest are locked as the card progresses — so it is the only
 * Bout on a card with a Lock a fan can be counted down to. Answering null for
 * the others is the honest thing: a countdown to a moment nobody has committed
 * to would be a promise the game does not make.
 */
export function locksAt(bout: FightCardBout, card: FightCard): string | null {
  const first = Math.min(...card.bouts.map((one) => one.cardOrder));

  return locksWithTheCard(bout.cardOrder, first) ? card.scheduledStart : null;
}

/**
 * Whether the Bout in this place on the card is the one that locks with the
 * card itself.
 *
 * The same rule {@link locksAt} states, for the callers that hold one Bout and
 * the card's first place rather than the whole card — a submission names Bouts,
 * not a card, and asks of each one whether it is still taking Predictions.
 */
export function locksWithTheCard(cardOrder: number, firstOnTheCard: number): boolean {
  return cardOrder === firstOnTheCard;
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
  /** When it locks by itself, or null for one an admin advances. */
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
