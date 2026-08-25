/**
 * Coins: how many a fan starts a Season with, how the ledger explains a
 * movement, and how a number of them is written wherever a fan reads one.
 *
 * Shared rather than kept on the server because the reasons written into the
 * Coin ledger are read by whoever has to explain a Balance to a fan, and
 * because `test/unit/vocabulary.test.ts` reads this directory: the sentences
 * the ledger stores are held to `CONTEXT.md` like any other copy.
 */

/**
 * The Coins every fan starts a Season with.
 *
 * The same number for a fan who was there when the Season opened and for one
 * who joins at the last Event — that is what "a level field" means here, and
 * why there is nothing anywhere that adds Coins to a fan mid-Season. That rule
 * is the Season entry in `CONTEXT.md`; ADR-0007 is why the economy has to stay
 * closed at all, Coins being neither purchasable nor transferable.
 *
 * Spelled out again in the `coin_transactions_grant_is_the_starting_balance`
 * check constraint, so that changing it means a migration somebody reviews
 * rather than a constant somebody edits.
 */
export const STARTING_BALANCE = 100;

/**
 * What each kind of Coin movement says about itself in the ledger.
 *
 * A `reason` is what an admin reads when a fan disputes a Balance, so it names
 * the thing that happened rather than the code path that wrote it. The two
 * grants are told apart because "did this fan start the Season or join it
 * late?" is a question the row should answer without a second query.
 */
export const COIN_REASONS = {
  seasonOpened: (season: string) => `${season} opened`,
  joinedSeason: (season: string) => `Joined ${season}`,
} as const;

/**
 * A number of Coins, written the way a fan reads it: "100 Coins", "1 Coin".
 *
 * The number is shown as it is given, sign and all. `Math.abs` decides only
 * the plural, so a movement of −1 Coin reads "-1 Coin" rather than the
 * "-1 Coins" a plain `!== 1` would produce.
 */
export function coinsLabel(coins: number): string {
  return `${coins} ${Math.abs(coins) === 1 ? "Coin" : "Coins"}`;
}
