/**
 * The signed-in admin, for the admin area to render itself with.
 *
 * The reference shape for every admin endpoint a later ticket adds: `requireAdmin`
 * at the top, and everything after it written knowing which admin is acting.
 * The prefix middleware is what refuses everyone else; this is how the handler
 * gets a name to record against what it does.
 */
export default defineEventHandler(async (event) => {
  const { username } = await requireAdmin(event);

  return { username };
});
