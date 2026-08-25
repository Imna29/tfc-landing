/**
 * What opening a Season asks for, and what the admin area says when it cannot.
 *
 * Shared for the same reason `shared/signUp.ts` is: the server sends the
 * sentence the form would have shown, and `test/unit/vocabulary.test.ts` holds
 * all of it to `CONTEXT.md` at once.
 */

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
