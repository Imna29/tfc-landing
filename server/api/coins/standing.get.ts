import type { FanStanding } from "#shared/standings";

/**
 * Where the signed-in fan stands in the Season being played: what they hold,
 * and where that puts them.
 *
 * Beside `/api/coins/balance` rather than folded into it, because they are
 * asked by two different things at two different costs. The Balance is the
 * site header, asked on every page a fan opens, and it is one indexed row; a
 * Rank orders every fan in the Season, and is asked by the one page that shows
 * one. Putting the second on the first would charge every page for it.
 *
 * Answers nothing rather than zeroes between Seasons, the way the Balance
 * route does: a fan then has no Balance and no Rank at all, which is a
 * different thing from holding no Coins and from being last.
 *
 * Never edge-cached: `/api/**` is exempt, and this is one fan's own place in
 * the standings (ADR-0008).
 */
export default defineEventHandler(async (event): Promise<FanStanding> => {
  const fan = await requireFan(event);
  const season = await currentSeason();

  if (!season) return { season: null, balance: null, rank: null, fans: 0 };

  const standing = await standingIn(season.id, fan.id);

  return {
    season: { name: season.name },
    // A fan with no Balance row in the Season holds no Coins, which is zero
    // rather than a missing answer — the same reading `balanceOf` gives.
    balance: standing.balance ?? 0,
    rank: standing.rank,
    fans: standing.fans,
  };
});
