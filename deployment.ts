/**
 * Where the server runs. See ADR-0022.
 *
 * One fact, kept here for the reason the cache boundary is kept in
 * `route-rules.ts`: it is a deployment decision that nothing in a page can hint
 * at, and it is invisible until somebody measures it.
 *
 * ## Why this file exists
 *
 * Vercel defaults a Function to `iad1` — Washington DC — and says so nowhere a
 * developer looks. TFC's database is in Europe and so are TFC's fans, so every
 * PlayTFC page was being rendered across the Atlantic and back:
 *
 * - the request entered at the Frankfurt edge and executed in `iad1`, which on
 *   its own cost **0.35s** before a single query ran, and
 * - every query the render made then crossed back to Europe and returned,
 *   at **~90ms each**.
 *
 * A signed-in `/predictions` makes twenty sequential round trips to Postgres,
 * so it answered in **2.44s** deployed and in 0.03s on a laptop — the whole of
 * the difference being distance, which is exactly the bug that cannot be
 * reproduced locally. The marketing site never showed it because ADR-0008
 * leaves it edge-cached and it never reaches the Function at all; every page
 * that bug report named is one of the pages ADR-0008 exempts.
 *
 * ## The rule
 *
 * **This region must be the region TFC's Postgres is in.** Not the region the
 * fans are in — the fans reach an edge either way, and it is the twenty round
 * trips behind the edge that decide what a page costs. A Function beside its
 * database pays ~1ms for each of them instead of ~90ms.
 *
 * Moving the database means changing this line in the same commit. The deploy
 * workflow measures the distance on every run and fails if it opens up again,
 * so the two cannot drift apart silently — see `.github/workflows/deploy.yml`.
 *
 * Vercel's European regions, should the database move within Europe:
 * `arn1` Stockholm, `cdg1` Paris, `dub1` Dublin, `fra1` Frankfurt, `lhr1`
 * London.
 */
export const FUNCTION_REGION = "fra1";

/**
 * How far the Function may be from Postgres before a deploy is refused, in
 * milliseconds.
 *
 * Measured as one round trip: `/api/health` is a single query, and
 * subtracting a Function response that makes none leaves the database's
 * distance on its own — which is what makes the check independent of wherever
 * the CI runner happens to be sitting.
 *
 * Twenty-five rather than something tighter because this is a backstop against
 * a continent, not a performance budget. Same region measures a few
 * milliseconds; the regression it exists to catch measured ninety.
 */
export const DATABASE_ROUND_TRIP_BUDGET_MS = 25;
