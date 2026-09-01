/**
 * What opening and closing a Season ask for, and what the admin area says when
 * either cannot happen.
 *
 * Shared for the same reason `shared/signUp.ts` is: the server sends the
 * sentence the form would have shown, and `test/unit/vocabulary.test.ts` holds
 * all of it to `CONTEXT.md` at once.
 */
import { STARTING_BALANCE, coinsLabel } from "./coins";

/**
 * How long a Season's name may be.
 *
 * A name is how a fan tells last Season's standings from this one's long after
 * both are over, so it has to be typed rather than generated — and short
 * enough to sit in a leaderboard heading.
 */
export const SEASON_NAME_LENGTH = { minimum: 3, maximum: 60 } as const;

/** Everything opening a Season says to the admin doing it. */
export const SEASON_MESSAGES = {
  name:
    `Give the Season a name of ${SEASON_NAME_LENGTH.minimum} to ` +
    `${SEASON_NAME_LENGTH.maximum} characters. Fans see it on the leaderboard, ` +
    "and on their Entry history for years afterwards.",
  nameTaken:
    "A Season already has that name. Two Seasons with one name make every " +
    "standing either of them left behind unreadable.",
  alreadyOpen:
    "A Season is already open. Close it before opening the next one — opening " +
    "a second would start every fan on a new Balance while the first was still " +
    "being played.",
} as const satisfies Record<string, string>;

/**
 * A Bout on one of the Season's cards that has not settled, as the refusal to
 * close names it.
 *
 * Enough for an admin to go and find it and nothing else: which card, where on
 * it, who is fighting, and which of the two states it is stuck in. There is no
 * id here on purpose — this is a sentence somebody reads, not a link something
 * follows.
 */
export interface OutstandingBout {
  /** The Event it is on, which is what tells two cards apart. */
  event: string;
  /** Where it sits on that card, 1 being fought first. */
  cardOrder: number;
  /** The red corner, as the Bout was imported. */
  red: string;
  /** And the blue. */
  blue: string;
  /**
   * Open, so still taking Predictions, or locked and waiting on a result.
   *
   * A Bout still `closed` is not outstanding and is never in this list: it took
   * no Predictions and holds nobody's Coins, and it can never settle at all —
   * entering a result on one is refused by `RESULT_MESSAGES.boutNotOpened` in
   * `shared/results.ts`.
   */
  status: "open" | "locked";
}

/** One outstanding Bout, written the way the refusal lists it. */
export function outstandingBoutLabel(bout: OutstandingBout): string {
  return `${bout.event} Bout ${bout.cardOrder}, ${bout.red} vs ${bout.blue} (${bout.status})`;
}

/** Everything closing a Season says to the admin doing it. */
export const CLOSE_MESSAGES = {
  notFound: "There is no Season with that id.",
  notOpen:
    "That Season is not the one being played. A Season is closed once, and " +
    "what it finished as is frozen from that moment.",
  outstanding: (bouts: readonly OutstandingBout[]) =>
    `${bouts.length} ${bouts.length === 1 ? "Bout is" : "Bouts are"} still waiting ` +
    "on a Result, and a Season's final standings are the Coins every fan " +
    "finished it on. Enter how each of these ended first: " +
    `${bouts.map(outstandingBoutLabel).join("; ")}.`,
  closed: (season: string, fans: number) =>
    `${season} is closed. Its final standings are frozen for ${fans} ` +
    `${fans === 1 ? "fan" : "fans"}, and the next Season starts every one of ` +
    `them on ${coinsLabel(STARTING_BALANCE)} again.`,
  /** What the admin area says beside the button, before it is pressed. */
  what:
    "Closing a Season freezes what every fan finished on — their Coins and " +
    "their place — as the record TFC decides Prizes from. It cannot be " +
    "undone, and a Season with a Bout still open or still waiting on a Result " +
    "will not close at all.",
} as const;

/** A name a Season can be opened under, or the reason it cannot be. */
export type ParsedSeasonName =
  | { name: string; problem?: undefined }
  | { name?: undefined; problem: string };

/**
 * Reads what an admin typed into the name a Season is opened under.
 *
 * Only the shape of the name is decided here. Whether it is already some other
 * Season's, and whether a Season is open already, are questions only the
 * database can answer.
 */
export function parseSeasonName(value: unknown): ParsedSeasonName {
  const name = typeof value === "string" ? value.trim() : "";

  if (name.length < SEASON_NAME_LENGTH.minimum || name.length > SEASON_NAME_LENGTH.maximum) {
    return { problem: SEASON_MESSAGES.name };
  }

  return { name };
}
