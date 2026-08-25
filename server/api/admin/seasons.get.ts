/**
 * Every Season, newest first, with what each one started.
 *
 * `fansGranted` is counted from the ledger rather than remembered from when the
 * Season opened, so the number on this page is the number of grant rows that
 * actually exist. A Season that says it started forty fans and holds thirty-nine
 * grants is exactly the discrepancy an admin needs to see.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  return { seasons: await allSeasons() };
});
