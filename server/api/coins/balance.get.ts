/**
 * The signed-in fan's Balance for the Season being played.
 *
 * Read from the materialised copy of the ledger rather than by adding the
 * ledger up, because the site header asks this on every page a fan opens
 * (ADR-0003, ADR-0009).
 *
 * Answers `null` for both when no Season is open: a fan then has no Balance at
 * all, which is a different thing from holding no Coins, and the header says
 * nothing rather than saying zero.
 */
export default defineEventHandler(async (event) => {
  const fan = await requireFan(event);
  const season = await currentSeason();

  if (!season) return { season: null, balance: null };

  return {
    season: { name: season.name },
    balance: await balanceOf(season.id, fan.id),
  };
});
