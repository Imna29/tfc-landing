/**
 * Coins: how many a fan starts a Season with, how the ledger explains a
 * movement, and how a number of them is written wherever a fan reads one.
 *
 * Shared rather than kept on the server because the reasons written into the
 * Coin ledger are read by whoever has to explain a Balance to a fan, and
 * because `test/unit/vocabulary.test.ts` reads this directory: the sentences
 * the ledger stores are held to `CONTEXT.md` like any other copy.
 */
// A Multiplier is written one way wherever anybody reads one, the ledger
// included: a Reward that says ×12.5 in the audit trail and ×12.50 on the card
// is two numbers to whoever is comparing them.
import { multiplierLabel } from "./predictions";

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
  /**
   * The Coins an Entry took out of a Balance at submission.
   *
   * How many Predictions it held is in the row because it is the first thing
   * asked about an Entry somebody is disputing — a chain of eight is a
   * different conversation from a single winner pick — and reading it here
   * costs no second query.
   */
  entryCommitted: (predictions: number) =>
    `Committed to an Entry of ${predictions} ${predictions === 1 ? "Prediction" : "Predictions"}`,
  /**
   * The Coins a winning Entry returned when its last Bout settled.
   *
   * The combined Multiplier is in the row because it is what a fan disputing a
   * Reward is actually disputing, and because ADR-0013 makes it a number
   * settlement worked out rather than one anybody can look up afterwards: the
   * cap and the rounding are rules, so this row is the only record of what
   * they came to on the day.
   */
  entryWon: (multiplier: number) => `Reward on a winning Entry at ${multiplierLabel(multiplier)}`,
  /**
   * The Coins an Entry returned to the fan who cancelled it.
   *
   * Says what was true at the moment it was written, because that is the whole
   * of what an admin needs when a fan asks why an Entry is gone from the card:
   * they took it back, and they were allowed to because nothing in it had
   * started being decided yet. It is a row of its own rather than the
   * commitment being unwritten — the ledger records what happened (ADR-0003),
   * and what happened is that Coins were committed and then came back.
   */
  entryCancelled: "Returned in full on an Entry cancelled while every Bout in it was open",
  /**
   * The Coins an Entry returned because nothing in it turned out to be
   * gradable.
   *
   * The same movement as a cancellation and for the same reason — the Amount
   * back in full — but the game's decision rather than the fan's, so the row
   * says which it was. ADR-0005: every Bout in the Entry was cancelled, lost a
   * fighter, drew or was ruled a no contest, and no prediction could have
   * anticipated any of it.
   */
  entryNoResult: "Returned in full on an Entry in which every Prediction was a No Result",
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
