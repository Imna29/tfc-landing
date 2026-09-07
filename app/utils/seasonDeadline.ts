import { asDate } from "@prismicio/client";
import type { TimestampField } from "@prismicio/client";
import { CONTEST_TIME_ZONE } from "./moments";

/**
 * TFC runs from Georgia, so a Season closes at a Tbilisi wall-clock time and
 * every fan is held to that one instant.
 *
 * Naming the zone is also what keeps the string stable between the server and
 * the browser. The leaderboard this appears on is server-rendered and then
 * hydrated (ADR-0008), so a format that followed whatever zone the rendering
 * process happened to be in would render one deadline on the server and a
 * different one in the browser — a hydration mismatch as well as a wrong
 * answer to the only question the panel exists to answer.
 *
 * The same reasoning as {@link inTbilisi}, which is why the zone is shared with
 * it rather than written down twice.
 */
const deadlineFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: CONTEST_TIME_ZONE,
  timeZoneName: "short",
});

export interface SeasonDeadline {
  /** The instant itself, for a `<time datetime>` attribute. */
  iso: string;
  /** What a fan reads: `31 December 2026 at 23:59 GMT+4`. */
  display: string;
}

/**
 * The end of the current Season, as authored in Prismic.
 *
 * Returns `null` for a Season with no end set and for a value that is not a
 * date at all — `asDate` hands back an Invalid Date rather than nothing, and
 * rendering "Invalid Date" as a deadline is worse than rendering none.
 */
export function formatSeasonDeadline(
  endsAt: TimestampField | null | undefined,
): SeasonDeadline | null {
  const date = endsAt ? asDate(endsAt) : null;

  if (!date || Number.isNaN(date.getTime())) {
    return null;
  }

  return { iso: date.toISOString(), display: deadlineFormat.format(date) };
}
