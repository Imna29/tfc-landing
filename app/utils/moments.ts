import { CONTEST_TIME_ZONE } from "#shared/signUp";

/**
 * A moment as an admin reads one, in Georgia, where the promotion is.
 *
 * The time zone is named rather than left to the reader's. Admin pages are
 * server-rendered and then hydrated, so a format that followed whatever zone
 * the process happens to be in would render one string on the server and a
 * different one in the browser — and an admin comparing when a Season was
 * opened against a card's start time wants both in the same zone anyway.
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
