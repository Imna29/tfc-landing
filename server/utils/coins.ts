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
 * What a fan holds, read so that nothing else can spend it until this
 * transaction is done with it.
 *
 * The `for update` is what makes "an Amount above the fan's Balance is
 * refused" true of two requests arriving together. Without it, two submissions
 * in the same moment both read a hundred Coins, both find themselves within
 * it, and a fan commits two hundred: neither transaction can see the other's
 * uncommitted ledger row, so no constraint on the ledger could catch it
 * either. Taking the row first means the second submission waits, and reads
 * the Balance the first one left behind.
 *
 * A fan with no row holds nothing. It is the row {@link balanceOf} answers
 * zero for — a fan whose account was created while no Season was open — and
 * locking nothing is right for them: they can afford no Entry at all, so there
 * is nothing to serialise.
 *
 * Takes the transaction to run inside because a lock outside one is released
 * the moment the statement ends, which is a lock that has held nothing.
 */
export async function balanceToCommitFrom(
  tx: DatabaseTransaction,
  seasonId: string,
  userId: string,
): Promise<number> {
  const [held] = await balanceRow(tx, seasonId, userId).for("update");

  return held?.balance ?? 0;
}

/**
 * The one query behind both ways of reading a Balance: the materialised row,
 * or nothing for a fan who has none.
 *
 * Written once because the two callers differ in one word — the `for update`
 * one of them adds — and two copies of the same `where` is two places for the
 * Season and the fan to come apart.
 */
function balanceRow(executor: Database | DatabaseTransaction, seasonId: string, userId: string) {
  return executor
    .select({ balance: balanceCache.balance })
    .from(balanceCache)
    .where(and(eq(balanceCache.seasonId, seasonId), eq(balanceCache.userId, userId)))
    .limit(1);
}

/**
 * Takes the Coins an Entry commits out of a fan's Balance, and brings the
 * materialised copy of it in step.
 *
 * The ledger row is the movement (ADR-0003): the Coins leave at submission,
 * not at settlement, and this is the only place that says so. It writes and
 * does not ask — whether the fan holds this many is
 * {@link balanceToCommitFrom}'s question, asked under a lock a moment earlier,
 * and `entry_commitments_are_within_the_balance` is what refuses this
 * regardless.
 *
 * Takes the transaction to run inside: an Entry that exists without its
 * commitment is Coins a fan is playing with twice.
 */
export async function commitCoins(
  tx: DatabaseTransaction,
  commitment: {
    seasonId: string;
    userId: string;
    entryId: string;
    amount: number;
    reason: string;
  },
): Promise<void> {
  await tx.insert(coinTransactions).values({
    seasonId: commitment.seasonId,
    userId: commitment.userId,
    kind: "entry_commitment",
    // Signed, like every row in the ledger: Coins leaving are negative.
    amount: -commitment.amount,
    reason: commitment.reason,
    cause: "entry",
    causeId: commitment.entryId,
  });

  await materialiseBalances(tx, commitment.seasonId, [commitment.userId]);
}

/** One Entry's Reward, as settlement worked it out. */
export interface Reward {
  /** The Season whose Balance it moves, which is the Entry's own. */
  seasonId: string;
  userId: string;
  entryId: string;
  /** The Coins it returns, which is the Amount at the combined Multiplier. */
  amount: number;
  reason: string;
}

/**
 * Returns the Coins a winning Entry earned, and brings the materialised copy of
 * every Balance it moved in step.
 *
 * One of the two ends of {@link commitCoins}: the Amount left the Balance at
 * submission, and this is what a winning Entry puts back into one — the other
 * being {@link refundCoins}, which puts back exactly what was taken. It
 * writes and does not ask — whether these Entries won is settlement's question,
 * asked of the Results under a row lock — and
 * `coin_transactions_one_reward_per_entry` is what refuses a second Reward for
 * an Entry regardless of what asked for it.
 *
 * Every Reward of one settlement in one statement rather than a row each,
 * because a Bout on a well-attended card decides hundreds of Entries and a
 * round trip apiece would hold the transaction open for as long as the card has
 * fans. Nothing is written at all for a settlement that paid nobody, which is
 * every Bout an admin enters a result for before the chains on it are finished.
 *
 * Takes the transaction to run inside because an Entry marked Won whose Reward
 * was not written is Coins destroyed with no error anywhere (ADR-0003).
 */
export async function creditRewards(
  tx: DatabaseTransaction,
  rewards: readonly Reward[],
): Promise<number> {
  if (rewards.length === 0) return 0;

  await tx.insert(coinTransactions).values(
    rewards.map((reward) => ({
      seasonId: reward.seasonId,
      userId: reward.userId,
      kind: "entry_reward" as const,
      // Signed, like every row in the ledger: Coins arriving are positive.
      amount: reward.amount,
      reason: reward.reason,
      cause: "entry" as const,
      causeId: reward.entryId,
    })),
  );

  // Grouped by Season rather than assuming one. An Entry belongs to the Season
  // it was submitted in and a Bout to the Season its card was imported into,
  // and those are the same Season today — but this is the statement that would
  // silently write half a Season's Balances if they ever were not.
  const fansBySeason = new Map<string, Set<string>>();

  for (const reward of rewards) {
    const fans = fansBySeason.get(reward.seasonId) ?? new Set<string>();

    fans.add(reward.userId);
    fansBySeason.set(reward.seasonId, fans);
  }

  for (const [seasonId, fans] of fansBySeason) {
    await materialiseBalances(tx, seasonId, [...fans]);
  }

  return rewards.reduce((coins, reward) => coins + reward.amount, 0);
}

/**
 * Returns the Coins a cancelled Entry committed, and brings the materialised
 * copy of the fan's Balance in step.
 *
 * The third way Coins move about an Entry, and the only one that puts back
 * exactly what was taken: the Amount, in full, as one row. It writes and does
 * not ask — whether this Entry may be cancelled at all is
 * `cancelEntry`'s question in `server/utils/cancellation.ts`, asked of the
 * Entry and of every Bout in it under a row lock — and
 * `coin_transactions_one_refund_per_entry` refuses a second refund for an
 * Entry whatever asked for it, with `cancelled_entries_are_refunded` holding
 * the row and the Entry's status to each other at commit.
 *
 * The commitment is left where it is rather than being unwritten. The ledger
 * is append-only (ADR-0003) and it is the record of what happened: the Coins
 * were committed, and then they came back, which is two rows because it was
 * two events.
 *
 * Takes the transaction to run inside because a cancelled Entry whose refund
 * was not written is Coins destroyed with no error anywhere.
 */
export async function refundCoins(
  tx: DatabaseTransaction,
  refund: {
    seasonId: string;
    userId: string;
    entryId: string;
    amount: number;
    reason: string;
  },
): Promise<void> {
  await tx.insert(coinTransactions).values({
    seasonId: refund.seasonId,
    userId: refund.userId,
    kind: "entry_refund",
    // Signed, like every row in the ledger: Coins arriving are positive.
    amount: refund.amount,
    reason: refund.reason,
    cause: "entry",
    causeId: refund.entryId,
  });

  await materialiseBalances(tx, refund.seasonId, [refund.userId]);
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
 *
 * `on` is for the callers already inside a transaction, which is where a
 * Balance that has just moved has to be read from: on the one connection a
 * serverless function has (ADR-0010), reaching for the application's own would
 * wait on a connection the transaction itself is holding.
 */
export async function balanceOf(
  seasonId: string,
  userId: string,
  on: Database | DatabaseTransaction = useDatabase(),
): Promise<number> {
  const [held] = await balanceRow(on, seasonId, userId);

  return held?.balance ?? 0;
}
