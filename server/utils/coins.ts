/**
 * The Coin ledger: the only code that writes a Coin Transaction, and the only
 * code that writes the materialised Balance those rows add up to.
 *
 * Balance is derived, never stored (ADR-0003). `balance_cache` exists so that
 * a site header and a leaderboard do not aggregate the whole ledger on every
 * request, and it is written here in exactly one way — as a `select` back out
 * of the ledger. There is deliberately no "add this much to the cache" path,
 * because a cache that is incremented can drift from the rows it claims to
 * summarise, and a cache that is derived cannot.
 *
 * That is also what makes {@link rebuildBalanceCache} more than a repair
 * script: it is the same statement the write path runs, with nothing narrowing
 * it. `test/server/coins.test.ts` throws the cache away and rebuilds it.
 *
 * Everything here takes the transaction it is to run inside rather than
 * reaching for a connection of its own — see {@link DatabaseTransaction} for
 * why that is not a preference.
 */
import { STARTING_BALANCE } from "#shared/coins";
import { and, eq, sql } from "drizzle-orm";
import type { Database, DatabaseTransaction } from "../db/client";
import { balanceCache, coinTransactions, users } from "../db/schema";
import { useDatabase } from "./db";

/**
 * Writes the Season's starting Coins into the ledger and brings the Balances
 * they move in step. Answers how many fans were granted.
 *
 * `forFan` narrows it to one fan, for somebody who joined after the Season
 * opened; without it, every fan with an account, which is what opening a
 * Season does. Either way they get the same hundred Coins — a fan joining at
 * the last Event of a Season is behind on the leaderboard, which is fair,
 * rather than behind on Coins, which would not be.
 *
 * The amount is not a parameter and never will be. A function that took one
 * would be the Coin printer the Season rules exist to rule out, and every
 * caller would then be something that had to be trusted with it.
 *
 * A fan who holds a grant for this Season already is skipped rather than
 * refused — `coin_transactions_one_grant_per_fan` is what guarantees at most
 * one, and honouring it here means this can be run again after a failure
 * without paying anybody twice.
 *
 * Takes the transaction to run inside rather than opening one: opening a
 * Season writes the Season row and these together or not at all.
 */
export async function grantStartingCoins(
  tx: DatabaseTransaction,
  seasonId: string,
  reason: string,
  forFan?: string,
): Promise<number> {
  const onlyThisFan = forFan ? sql`where ${users.id} = ${forFan}::uuid` : sql``;

  // An `insert ... select` rather than a row per fan, because opening a Season
  // grants to everybody at once and a round trip each would hold the
  // transaction open for as long as the promotion has fans.
  const granted = await tx.execute<{ user_id: string }>(sql`
    insert into ${coinTransactions} (season_id, user_id, kind, amount, reason, cause, cause_id)
    select ${seasonId}::uuid, ${users.id}, 'season_grant', ${STARTING_BALANCE},
           ${reason}, 'season', ${seasonId}::uuid
    from ${users}
    ${onlyThisFan}
    on conflict do nothing
    returning user_id
  `);

  if (granted.length > 0) {
    await materialiseBalances(tx, seasonId, forFan ? [forFan] : undefined);
  }

  return granted.length;
}

/**
 * Grants one fan the Season's starting Coins in a transaction of its own, for
 * the callers that are not already inside one — a fan signing up, whose
 * account `better-auth` has already committed by the time this runs.
 */
export function grantOneFanTheirStartingCoins(
  seasonId: string,
  reason: string,
  userId: string,
): Promise<number> {
  return useDatabase().transaction((tx) => grantStartingCoins(tx, seasonId, reason, userId));
}

/**
 * Writes what the ledger says these fans' Balances are into `balance_cache`.
 *
 * `forFans` is the fans whose rows just moved. Passing nothing recomputes the
 * whole Season, which is what a rebuild is.
 */
async function materialiseBalances(
  tx: DatabaseTransaction,
  seasonId: string,
  forFans?: string[],
): Promise<void> {
  const onlyTheseFans = forFans
    ? sql`and user_id in (${sql.join(
        forFans.map((id) => sql`${id}::uuid`),
        sql`, `,
      )})`
    : sql``;

  await tx.execute(sql`
    insert into ${balanceCache} (season_id, user_id, balance)
    select season_id, user_id, sum(amount)
    from ${coinTransactions}
    where season_id = ${seasonId}::uuid ${onlyTheseFans}
    group by season_id, user_id
    on conflict (season_id, user_id) do update
      set balance = excluded.balance, updated_at = now()
  `);
}

/**
 * Throws the materialised Balance for a Season away and derives it again from
 * the ledger.
 *
 * Nothing in the application calls this: the write path keeps the cache in
 * step on its own. It exists because ADR-0003 claims the cache is derived data
 * that can always be rebuilt, and a claim nothing can act on is not a claim —
 * `test/server/coins.test.ts` corrupts the cache and proves this puts it back.
 *
 * The one thing here that is handed a connection rather than reaching for the
 * app's own, because its only caller is in another process and connects
 * separately.
 *
 * The delete is what makes it a rebuild rather than a refresh: a cached
 * Balance for a fan with no rows in this Season is exactly the kind of wrong
 * a rebuild has to be able to remove.
 */
export function rebuildBalanceCache(database: Database, seasonId: string): Promise<void> {
  return database.transaction(async (tx) => {
    await tx.delete(balanceCache).where(eq(balanceCache.seasonId, seasonId));
    await materialiseBalances(tx, seasonId);
  });
}

/**
 * A fan's Balance for a Season, read from the materialised copy.
 *
 * A fan with no row has no Coin Transactions in this Season, which is zero
 * Coins — not a missing answer. It happens to a fan whose account was created
 * while no Season was open and who has not been granted anything since.
 */
export async function balanceOf(seasonId: string, userId: string): Promise<number> {
  const [held] = await useDatabase()
    .select({ balance: balanceCache.balance })
    .from(balanceCache)
    .where(and(eq(balanceCache.seasonId, seasonId), eq(balanceCache.userId, userId)))
    .limit(1);

  return held?.balance ?? 0;
}
