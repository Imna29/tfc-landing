import { PAST_SEASONS_MESSAGES, type FinalStandings } from "#shared/standings";

/**
 * What one Season finished as: the top of its final standings, and the row of
 * whoever is reading them.
 *
 * `/api/leaderboard` for a Season that is over, and deliberately not that route
 * with an id on it. `CONTEXT.md` keeps the two apart — the leaderboard is the
 * Season being played, and a Season that has ended has final standings — and
 * the difference is more than a word: these rows are read out of
 * `final_standings` rather than out of the materialised Balance, so a
 * correction entered on a settled Bout years later moves the ledger and never
 * this.
 *
 * Public and personalised, exactly like the leaderboard: a visitor with no
 * account reads the top ten, and signing in adds one row — their own, wherever
 * in that Season they finished. That is what makes it uncacheable despite
 * being public (ADR-0008), and `route-rules.ts` exempts `/standings` and this
 * route for it.
 *
 * A Season still being played is answered 404 rather than its live standings.
 * It has no final standings — that is what "final" means — and answering the
 * leaderboard here would put a scoreboard behind a link that promises a record.
 *
 * Only usernames leave here, like everywhere else (ADR-0007).
 */
export default defineEventHandler(async (event): Promise<FinalStandings> => {
  // Not `requireFan`: what a Season finished as is public. Who is asking only
  // decides whether there is a row of their own to answer with.
  const fan = await currentFan(event);

  const id = getRouterParam(event, "season");
  const season = looksLikeId(id) ? await seasonById(id) : null;

  if (!season?.closedAt || season.status !== "closed") {
    throw createError({
      statusCode: 404,
      statusMessage: "No final standings",
      message: PAST_SEASONS_MESSAGES.notFound,
    });
  }

  return {
    season: { id: season.id, name: season.name, closedAt: season.closedAt.toISOString() },
    ...(await finalStandingsOf(season.id, fan?.id ?? null)),
  };
});
