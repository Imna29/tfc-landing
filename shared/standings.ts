/**
 * Where a fan stands in the Season being played: what they hold, and where
 * that puts them.
 *
 * A Rank is an ordering of the materialised Balance and nothing else, so
 * almost all of it belongs to Postgres — `server/utils/standings.ts` is the
 * query. What is here is the shape it comes back in and the words it is read
 * in, shared for the reason `shared/seasons.ts` is: the profile says them, the
 * leaderboard says the same ones, and `test/unit/vocabulary.test.ts` holds
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

/**
 * How many places the Season's leaderboard lists before the fan's own row.
 *
 * Ten because that is what the Season is played for — a Prize is decided on
 * the top of it — and because a scoreboard a fan has to scroll is one they
 * read once. Every fan below it reads their own place instead:
 * {@link whereYouStand} is what pins it there, and the profile answers the
 * same question at length.
 *
 * {@link LEADERBOARD_MESSAGES}`.what` says this number in words, because copy
 * that reads "the 10 fans" is copy nobody wrote. Moving it means moving that
 * sentence too.
 */
export const LEADERBOARD_PLACES = 10;

/**
 * One fan's place on the leaderboard, as a row of it reads across.
 *
 * A username, never a name: this is the one page where fans read each other,
 * and the only identifier TFC ever shows publicly is the one they chose
 * (ADR-0007).
 */
export interface LeaderboardPlace {
  /** Where they sit in the Season, 1 being the top. */
  rank: number;
  username: string;
  /** The Coins they hold, which is what the Rank is an ordering of. */
  balance: number;
  /**
   * The Entries they have played, which is not the Entries they have
   * submitted: an Entry taken back was never played (`CONTEXT.md`), and its
   * Coins are back in the Balance beside it.
   */
  entriesPlayed: number;
  /** Whether this row is the fan reading it. */
  you: boolean;
}

/**
 * The Season's scoreboard: the top of it, and the fan reading it.
 *
 * `you` is their own row **and only when it is not in {@link top} already** —
 * a fan inside the top ten is marked there rather than listed twice, and one
 * outside it is pinned below by the page. That the two cannot both hold the
 * same fan is the shape of this type rather than a rule the page has to
 * remember.
 *
 * Null on `you` is therefore three different things — a visitor with no
 * account, a fan in the top ten, and a fan holding no Coins in the Season at
 * all — and {@link whereYouStand} is where they are told apart.
 */
export interface Leaderboard {
  /** The Season being played, or null when none is. */
  season: { name: string } | null;
  /** The top of it, best first, at most {@link LEADERBOARD_PLACES} of them. */
  top: LeaderboardPlace[];
  /** The fan's own row, when it is not in {@link top}. */
  you: LeaderboardPlace | null;
  /** How many fans are ranked, so a Rank reads as "12th of 340". */
  fans: number;
}

/** Everything the leaderboard says beside the names on it. */
export const LEADERBOARD_MESSAGES = {
  what:
    "The ten fans holding the most Coins this Season. Where two hold the " +
    "same, the one who got there first is ahead — so nobody moves down a " +
    "place without somebody's Coins moving.",
  signedOut:
    "Sign in to see where you stand. Every fan has a place in the Season, " +
    "however far down it they are.",
  nobodyYet:
    "Nobody holds Coins in this Season yet. The standings fill up as fans " +
    "join and Bouts settle.",
  yourRow: "Your place in the Season",
} as const;

/** What the leaderboard says about the fan reading it, under the top ten. */
export interface YourStanding {
  /** Their own row, to pin below the top ten, or null when there is none. */
  pinned: LeaderboardPlace | null;
  /** What to say about it, which is a different sentence in each case. */
  note: string;
}

/**
 * Where the fan reading the leaderboard stands on it.
 *
 * Four different answers wear the same empty `you`, and only one of them is a
 * row to pin. A visitor with no account is invited to get one; a fan already
 * in the top ten is told where they are without being shown twice; a fan
 * holding no Coins in the Season is told they are not in it *yet*, which is
 * the sentence the profile gives them too; and between Seasons there is
 * nothing to be ranked among, which the page says once at the top rather than
 * twice.
 *
 * **The Rank is always said in words, even for a fan whose row is already on
 * the screen.** "42nd of 340" is the number the leaderboard exists to give a
 * fan who will never be in the top ten, and a highlighted row three places
 * down still leaves "of how many?" unanswered.
 */
export function whereYouStand(board: Leaderboard, signedIn: boolean): YourStanding {
  if (!signedIn) return { pinned: null, note: LEADERBOARD_MESSAGES.signedOut };
  if (!board.season) return { pinned: null, note: "" };

  const listed = board.you ?? board.top.find((place) => place.you);

  if (!listed) return { pinned: null, note: STANDING_MESSAGES.unranked };

  return {
    pinned: board.you,
    note: STANDING_MESSAGES.ranked(listed.rank, board.fans),
  };
}
