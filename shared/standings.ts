/**
 * Where a fan stands in the Season being played: what they hold, and where
 * that puts them.
 *
 * A Rank is an ordering of the materialised Balance and nothing else, so
 * almost all of it belongs to Postgres — `server/utils/standings.ts` is the
 * query. What is here is the shape it comes back in and the words it is read
 * in, shared for the reason `shared/seasons.ts` is: the profile says them, the
 * leaderboard will say the same ones, and `test/unit/vocabulary.test.ts` holds
 * all of it to `CONTEXT.md` at once.
 */
import { coinsLabel } from "./coins";

/**
 * A fan's own place in the Season being played, as their profile reads it.
 *
 * Every field is nullable together and for one reason: between Seasons there
 * is no Balance, no Rank and nothing to be ranked among — which is a different
 * thing from holding no Coins, and from being last. {@link STANDING_MESSAGES}
 * is where each of those is a sentence rather than a zero.
 */
export interface FanStanding {
  /** The Season being played, or null when none is. */
  season: { name: string } | null;
  /** The Coins the fan holds in it, or null when no Season is being played. */
  balance: number | null;
  /**
   * Their place in it, 1 being the top, or null where they hold no Balance row
   * in the Season at all — a fan whose account was created while none was open
   * and who has not been granted anything since.
   */
  rank: number | null;
  /** How many fans are ranked, so a Rank reads as "12th of 340". */
  fans: number;
}

/**
 * A Rank the way it is written beside a name: `1st`, `2nd`, `13th`, `21st`.
 *
 * The teens are the exception every implementation of this gets wrong once:
 * eleventh, twelfth and thirteenth take `th` despite ending in 1, 2 and 3, and
 * the hundreds start the pattern over — 111th, but 121st.
 */
export function rankLabel(rank: number): string {
  const lastTwo = rank % 100;
  const suffix =
    lastTwo >= 11 && lastTwo <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[rank % 10] ?? "th");

  return `${rank}${suffix}`;
}

/** Everything a fan's own standing says to them. */
export const STANDING_MESSAGES = {
  ranked: (rank: number, fans: number) =>
    `${rankLabel(rank)} of ${fans} ${fans === 1 ? "fan" : "fans"} this Season.`,
  unranked:
    "You are not in this Season's standings yet. Every fan starts a Season " +
    "on the same hundred Coins, and yours arrive the moment TFC grants them.",
  noSeason:
    "No Season is being played, so there is nothing to rank. Every fan starts " +
    "the next one on the same hundred Coins.",
  balance: (coins: number) => `${coinsLabel(coins)} to commit to an Entry.`,
} as const;
