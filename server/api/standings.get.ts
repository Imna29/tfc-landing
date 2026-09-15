import type { ClosedSeason } from "#shared/standings";

/**
 * Every Season that has ended, newest first.
 *
 * What the leaderboard links to, and the reason the final standings of a
 * Season four years old are still reachable: the page is the list, and the
 * list is every Season rather than the last one. `CONTEXT.md` — Entry history
 * is kept forever, and so is what each Season finished as.
 *
 * Public and identical for everybody, unlike the standings it links to: there
 * is nothing personal in a list of Season names. It is exempt from the edge
 * cache anyway, because `/api/**` is (ADR-0008), and a list that gained a
 * Season ten minutes late would be the one link a fan was looking for.
 */
export default defineEventHandler(async (): Promise<{ seasons: ClosedSeason[] }> => {
  const ended = await endedSeasons();

  return {
    seasons: ended.map((season) => ({
      id: season.id,
      name: season.name,
      closedAt: season.closedAt.toISOString(),
    })),
  };
});
