import type { Leaderboard } from "#shared/standings";

/**
 * The Season's leaderboard: the top ten by Balance, and the row of whoever is
 * reading it.
 *
 * **Public, and personalised anyway.** A visitor with no account is answered
 * the top ten rather than a 401, because sizing up the competition is how
 * somebody decides to join it. What signing in adds is one row — their own,
 * wherever in the Season it is — which is what makes the page as a whole
 * uncacheable despite being public (ADR-0008). `route-rules.ts` exempts both
 * `/leaderboard` and this route.
 *
 * A fan already in the top ten is marked in it rather than pinned under it,
 * and that is `server/utils/standings.ts`'s doing rather than this route's:
 * both halves come out of one statement, so the ten and the eleventh row
 * cannot be two readings of the standings taken a moment apart.
 *
 * Answers nothing rather than zeroes between Seasons, the way the Balance and
 * the standing routes do: there is then no Balance to rank anybody by and
 * nobody to be ranked among, which is a different thing from an empty
 * leaderboard.
 *
 * Only usernames leave here. There is no column on this answer a real name
 * could travel in, and no endpoint anywhere that would return one (ADR-0007).
 */
export default defineEventHandler(async (event): Promise<Leaderboard> => {
  // Not `requireFan`: the top ten is public. Who is asking only decides
  // whether there is a row of their own to answer with.
  const fan = await currentFan(event);
  const season = await currentSeason();

  if (!season) return { season: null, top: [], you: null, fans: 0 };

  return {
    season: { name: season.name },
    ...(await leaderboardOf(season.id, fan?.id ?? null)),
  };
});
