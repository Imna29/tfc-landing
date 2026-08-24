import { asDate } from "@prismicio/client";
import type { TimestampField } from "@prismicio/client";

/**
 * TFC runs the contest from Georgia (ADR-0007), so the Season closes at a
 * Tbilisi wall-clock time and every fan is held to that one instant.
 *
 * Pinning it also keeps the page correct in the edge cache. The prizes page is
 * anonymous marketing HTML and is cached for ten minutes (ADR-0008), so
 * whatever time zone the rendering machine happened to be in would be baked in
 * and served to everyone — and the same string re-rendered in the browser
 * would disagree with it, which is a hydration mismatch as well as a wrong
 * deadline.
 */
const CONTEST_TIME_ZONE = "Asia/Tbilisi";

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
