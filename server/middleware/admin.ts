/**
 * The lock on the admin area, on the way in rather than at each door.
 *
 * Every request under `/admin` and `/api/admin` is refused here before any
 * handler runs, so an admin page or endpoint added by a later ticket is locked
 * the moment it exists — including one whose author forgot there was anything
 * to remember. A missing role check on a single admin route is enough to let a
 * fan price their own Multipliers.
 *
 * The rejection is deliberately not a hidden link or an empty menu: it is the
 * server answering the request itself, so a fan who guesses the URL gets
 * exactly as far as a fan who follows one.
 */
export default defineEventHandler(async (event) => {
  if (!isAdminPath(event.path)) return;

  // Answered before the role is looked at, so it reads the same to everyone:
  // a spelling the edge cache would store is not an admin's page to serve.
  if (!isCanonicalSpelling(event.path)) {
    throw createError({ statusCode: 404, statusMessage: "Not found" });
  }

  await requireAdmin(event);
});
