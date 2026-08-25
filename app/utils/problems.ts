/**
 * What went wrong, as the page should say it.
 *
 * Every route in the admin area refuses with a sentence written for whoever
 * is reading it — see `shared/seasons.ts` and `shared/events.ts` — and
 * `$fetch` puts that sentence on `error.data.message`. This is the one place
 * that knows so, so a page shows the server's reason rather than its own guess
 * at one.
 *
 * The fallback is for the failures that carry no sentence, because nobody
 * wrote one: a connection that dropped, a process that fell over. An admin
 * gets something they can act on rather than an empty red line.
 */
export function problemFrom(error: unknown): string {
  return (
    (error as { data?: { message?: string } }).data?.message ??
    "Something went wrong on our side. Try again in a moment."
  );
}
