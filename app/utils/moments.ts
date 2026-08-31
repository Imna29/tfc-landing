import { CONTEST_TIME_ZONE } from "#shared/signUp";

/**
 * A moment as it is read in Georgia, where the promotion is.
 *
 * The time zone is named rather than left to the reader's. These pages are
 * server-rendered and then hydrated, so a format that followed whatever zone
 * the process happens to be in would render one string on the server and a
 * different one in the browser — and a card starts when it starts in Tbilisi,
 * which is the time on the poster and the time the first Bout locks at.
 */
const MOMENT = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: CONTEST_TIME_ZONE,
});

/** The moment, or an em dash for the ones that have not happened. */
export function inTbilisi(moment: string | null | undefined): string {
  return moment ? MOMENT.format(new Date(moment)) : "—";
}

/** How long is left, broken down the way a clock shows it. */
export interface Remaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const A_SECOND = 1000;
const A_MINUTE = 60 * A_SECOND;
const AN_HOUR = 60 * A_MINUTE;
const A_DAY = 24 * AN_HOUR;

/**
 * How long until a moment, or null once it has arrived.
 *
 * Null rather than a row of zeroes, so that whatever is counting has to say
 * something else when the waiting is over rather than sitting at 00:00:00 —
 * which reads as a countdown that has stopped working.
 */
export function remainingUntil(moment: string, now: number): Remaining | null {
  const left = Date.parse(moment) - now;

  if (!Number.isFinite(left) || left <= 0) return null;

  return {
    days: Math.floor(left / A_DAY),
    hours: Math.floor((left % A_DAY) / AN_HOUR),
    minutes: Math.floor((left % AN_HOUR) / A_MINUTE),
    seconds: Math.floor((left % A_MINUTE) / A_SECOND),
  };
}

/** The wait as a clock: `2d 04:11:09` while there are days, `04:11:09` after. */
export function remainingLabel(remaining: Remaining): string {
  const clock = [remaining.hours, remaining.minutes, remaining.seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");

  return remaining.days > 0 ? `${remaining.days}d ${clock}` : clock;
}
