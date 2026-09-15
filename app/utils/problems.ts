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

/**
 * The error an admin page throws when the server answered it nothing at all.
 *
 * Two reasons an answer can be missing, and they are not the same page. A fan
 * who guessed the URL was refused before anything rendered, and telling them so
 * is the point — a hidden link is not a guard, and a shell rendered for
 * somebody who cannot use it looks like it worked.
 *
 * Anything else is the server's problem: a query that failed, a database behind
 * on its migrations, a card a re-import has replaced. An admin told they are
 * not an admin goes looking for a permission they already have, so the status
 * the server actually answered with is passed through rather than flattened to
 * a refusal.
 */
export function noAnswerFrom(
  error: { statusCode?: number; statusMessage?: string } | null | undefined,
) {
  const statusCode = error?.statusCode ?? 500;
  const refused = statusCode === 401 || statusCode === 403;

  return createError({
    statusCode,
    statusMessage: refused
      ? "Admins only"
      : (error?.statusMessage ?? "The admin area could not be loaded"),
    fatal: true,
  });
}
