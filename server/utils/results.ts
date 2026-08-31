/**
 * Settlement: recording what happened in a Bout, grading every Entry riding on
 * it, and moving the Coins — as one transaction.
 *
 * **This is the only place in the application where Coins can be created or
 * destroyed by accident.** Everything else that moves them either takes an
 * Amount a fan typed or grants a fixed hundred; here the numbers are worked out
 * from Multipliers frozen weeks ago, against a Result somebody typed in while
 * watching a fight. A settlement that half-commits — Entries graded and no
 * Rewards written, or Rewards written and the Bout still taking Predictions —
 * would be wrong with no error anywhere, which is why every write below is
 * inside one `transaction` and every read is through it (ADR-0010).
 *
 * What is decided here is only what the database knows: which Entries this Bout
 * touches, which of their other Bouts have settled, and what the Coins are
 * doing. Whether a Prediction landed and where an Entry now stands is
 * `shared/results.ts`, and what a winning Entry returns is `potentialReward` in
 * `shared/entries.ts` — the same function that priced the panel the fan
 * confirmed in, which is what ADR-0013 means by the cap being a rule rather
 * than a number anybody was quoted.
 *
 * Three separate things stop a Bout settled twice from paying twice, and they
 * are deliberately not one: the `bout_results` primary key refuses a second
 * Result, only Entries still Open are graded, and
 * `coin_transactions_one_reward_per_entry` refuses a second Reward for an Entry
 * whatever asked for it. The first is what an admin actually meets, and is the
 * one turned back into a sentence below. The other two are underneath it, and
 * reaching either means something is wrong rather than merely refused — so they
 * are left to fail loudly rather than dressed up as a refusal an admin could
 * read and shrug at.
 */
import { COIN_REASONS } from "#shared/coins";
import { potentialReward, type EntryStatus, type PricedPrediction } from "#shared/entries";
import type { Corner } from "#shared/events";
import type { Method } from "#shared/pricing";
import { RESULT_MESSAGES, gradeEntry, type BoutResult } from "#shared/results";
import { and, eq, inArray } from "drizzle-orm";
import type { DatabaseTransaction } from "../db/client";
import { boutResults, bouts, entries, predictions } from "../db/schema";
import { creditRewards, type Reward } from "./coins";
import { refusedByConstraint, useDatabase } from "./db";
import { lockBout } from "./locks";

/** The key that holds a Bout to one Result. */
export const ONE_RESULT_PER_BOUT = "bout_results_pkey";

/** The name of the trigger refusing a Result on a Bout that never locked. */
export const RESULTS_ARE_ENTERED_ON_BOUTS_THAT_LOCKED = "results_are_entered_on_bouts_that_locked";

/** The name of the constraint trigger tying a Result to a settled Bout. */
export const RESULTS_ARE_ENTERED_ON_SETTLED_BOUTS = "results_are_entered_on_settled_bouts";

/** The key holding a Result's round to one the Bout was offering. */
export const A_RESULTS_ROUND_WAS_OFFERED = "bout_results_round_was_offered";

/** The index that holds an Entry to one Reward. */
export const ONE_REWARD_PER_ENTRY = "coin_transactions_one_reward_per_entry";

/**
 * Why a Result was not entered, in the words the admin reads and the status the
 * route answers with.
 *
 * The same shape `EntryRefusal` has in `server/utils/entries.ts`, and for the
 * same reason: 409 is the card having moved under the admin, 422 is a result
 * that cannot be what happened.
 */
export interface ResultRefusal {
  problem: string;
  status: number;
}

/**
 * What entering a Result did, as the admin who entered it is told.
 *
 * Counted rather than listed. An admin entering the result of a main event
 * needs to know that it landed and roughly how big it was; who won what is the
 * fans' own history (#17), and a list of five hundred usernames on a phone at
 * cageside is not an answer to anything.
 */
export interface Settlement {
  /** Entries holding a Prediction on this Bout that were still Open. */
  graded: number;
  /** Of those, the ones this Result finished: every Prediction landed. */
  won: number;
  /** Of those, the ones this Result ended, Bouts still to come or not. */
  lost: number;
  /** Of those, the ones still alive: correct so far, with Bouts left. */
  stillOpen: number;
  /** The Coins the Rewards returned. */
  paid: number;
}

/** A Bout settled and what that did, or the reason it was not. */
export type Settled =
  | { settlement: Settlement; refusal?: undefined }
  | { settlement?: undefined; refusal: ResultRefusal };

/**
 * Records the Result, settles the Bout and grades every Entry riding on it.
 *
 * The order of the writes is the argument, so it is worth reading as one:
 *
 * 1. **Lock the Bout**, if an admin has not already. A Result entered on a Bout
 *    still taking Predictions is the one failure that lets a fan win with
 *    certainty, and this is the door ADR-0006's backstops do not watch. It is
 *    `lockBout`'s `result` kind, attributed to the admin, because what they
 *    decided to do was enter a result.
 * 2. **Write the Result**, which the primary key on `bout_results` allows once.
 * 3. **Settle the Bout**, which `results_are_entered_on_settled_bouts` holds to
 *    step 2 at commit — neither is ever written without the other.
 * 4. **Take the Entries** this Result decides, under a row lock, before reading
 *    anything about them. See below for what that lock is actually for.
 * 5. **Grade, then write once each**: the Entries this ended, the Entries it
 *    finished, and their Rewards.
 *
 * The row lock in step 4 is not about two admins settling the same Bout — the
 * primary key answers that one. It is about two Bouts of the *same Entry*
 * settling at once, which is an admin working down a card quickly. Without it
 * both transactions read the other's Bout as unsettled, both leave the Entry
 * Open, and a fan who won is never paid: no constraint could catch it, because
 * neither transaction ever writes anything wrong. Taking the Entries first
 * means the second settlement waits and then reads the first one's Result.
 */
export async function settleBout(
  bout: { id: string; scheduledRounds: number },
  result: BoutResult,
  by: string,
): Promise<Settled> {
  try {
    return await useDatabase().transaction(async (tx) => {
      // Whether this is the call that locked it does not change what happens
      // next, so the answer is dropped: a Bout an admin locked when it was
      // fought is already locked, which is the ordinary case, and one nobody
      // locked is locked here. A Bout that was never open is refused by
      // `results_are_entered_on_bouts_that_locked` a statement later.
      await lockBout(tx, { boutId: bout.id, kind: "result", by });

      await tx.insert(boutResults).values({
        boutId: bout.id,
        winner: result.winner,
        method: result.method,
        round: result.round,
        enteredBy: by,
      });

      await tx
        .update(bouts)
        .set({ status: "settled" })
        .where(and(eq(bouts.id, bout.id), eq(bouts.status, "locked")));

      return { settlement: await grade(tx, bout.id) };
    });
  } catch (error) {
    const refusal = refusalBehind(error, bout);

    if (refusal) return { refusal };

    throw error;
  }
}

/**
 * Grades every Entry this Bout's Result decides, and pays the ones it finishes.
 *
 * Two reads and at most three writes, whatever the card's attendance: a
 * settlement is one shape of work whether it touches four Entries or four
 * thousand, and a query per Entry would hold the transaction open across the
 * whole of it.
 */
async function grade(tx: DatabaseTransaction, boutId: string): Promise<Settlement> {
  const riding = await tx
    .select({ id: entries.id })
    .from(entries)
    .where(
      and(
        // An Entry already Won or Lost is not graded again. It is the second of
        // the three guards against a Bout settled twice paying twice, and the
        // one that also covers a chain whose earlier Bout already ended it.
        eq(entries.status, "open"),
        inArray(
          entries.id,
          tx
            .select({ id: predictions.entryId })
            .from(predictions)
            .where(eq(predictions.boutId, boutId)),
        ),
      ),
    )
    // A consistent order to take the rows in, so two settlements whose Entries
    // overlap queue behind one another rather than deadlocking half way.
    .orderBy(entries.id)
    .for("update");

  // Every Entry on this Bout was decided by an earlier one, or nobody
  // predicted on it at all. Either way there is nothing to read and nothing to
  // write — an admin settling an undercard Bout late on a card sees this.
  if (riding.length === 0) return { graded: 0, won: 0, lost: 0, stillOpen: 0, paid: 0 };

  // A second statement rather than a `for update` on the join above, and that
  // is the point of it: in read committed a statement that waited on a row lock
  // re-reads that row, but reads everything joined to it from the snapshot it
  // started with. This one starts after the lock is held, so what it sees of
  // the other Bouts is what has actually committed.
  const rows = await tx
    .select({
      entryId: entries.id,
      seasonId: entries.seasonId,
      userId: entries.userId,
      amount: entries.amount,
      boutId: predictions.boutId,
      corner: predictions.corner,
      method: predictions.method,
      round: predictions.round,
      winnerMultiplier: predictions.winnerMultiplier,
      methodMultiplier: predictions.methodMultiplier,
      roundMultiplier: predictions.roundMultiplier,
      resultWinner: boutResults.winner,
      resultMethod: boutResults.method,
      resultRound: boutResults.round,
    })
    .from(entries)
    .innerJoin(predictions, eq(predictions.entryId, entries.id))
    .leftJoin(boutResults, eq(boutResults.boutId, predictions.boutId))
    .where(
      inArray(
        entries.id,
        riding.map((entry) => entry.id),
      ),
    );

  const settling = new Map<string, SettlingEntry>();

  for (const row of rows) {
    const entry = settling.get(row.entryId) ?? {
      id: row.entryId,
      seasonId: row.seasonId,
      userId: row.userId,
      amount: row.amount,
      predictions: [],
    };

    settling.set(row.entryId, entry);

    entry.predictions.push({
      boutId: row.boutId,
      corner: row.corner,
      method: row.method,
      round: row.round,
      winnerMultiplier: row.winnerMultiplier,
      methodMultiplier: row.methodMultiplier,
      roundMultiplier: row.roundMultiplier,
      result: resultFrom(row),
    });
  }

  const lost: SettlingEntry[] = [];
  const won: SettlingEntry[] = [];
  let stillOpen = 0;

  for (const entry of settling.values()) {
    const standing = gradeEntry(
      entry.predictions.map((prediction) => ({ prediction, result: prediction.result })),
    );

    if (standing === "lost") lost.push(entry);
    else if (standing === "won") won.push(entry);
    else stillOpen += 1;
  }

  // No Coin Transaction for a Lost Entry, and there never will be: its Amount
  // left the Balance when it was submitted (ADR-0003), so losing is a status
  // and nothing else. Writing a row here would take the Coins a second time.
  if (lost.length > 0) await markEntries(tx, "lost", lost);
  if (won.length > 0) await markEntries(tx, "won", won);

  const paid = await creditRewards(tx, won.map(rewardFor));

  return { graded: settling.size, won: won.length, lost: lost.length, stillOpen, paid };
}

/**
 * One Prediction being settled: what it was worth, and how its Bout went.
 *
 * A `PricedPrediction` with the Result beside it, rather than two collections
 * to keep in step. It is both of the things settlement needs of a Prediction
 * and it is one object: `potentialReward` reads the Multipliers off it, and
 * `gradeEntry` reads the answers and the Result off the same row.
 */
interface SettlingPrediction extends PricedPrediction {
  /** The Result of its Bout, or null while that Bout has not settled. */
  result: BoutResult | null;
}

/** One Entry this Result decides, with everything needed to grade and pay it. */
interface SettlingEntry {
  id: string;
  seasonId: string;
  userId: string;
  amount: number;
  predictions: SettlingPrediction[];
}

/**
 * What a winning Entry returns, worked out by the function that told the fan
 * what it would.
 *
 * ADR-0013 is the whole of this line: the combined Multiplier and the ×100 cap
 * are worked out here from the Multipliers on the Predictions, rather than read
 * back from a number written at submission. There is nothing to disagree with.
 */
function rewardFor(entry: SettlingEntry): Reward {
  const { multiplier, reward } = potentialReward(entry.amount, entry.predictions);

  return {
    seasonId: entry.seasonId,
    userId: entry.userId,
    entryId: entry.id,
    amount: reward,
    reason: COIN_REASONS.entryWon(multiplier),
  };
}

/** Moves these Entries to where this settlement found them, in one statement. */
async function markEntries(
  tx: DatabaseTransaction,
  status: EntryStatus,
  settled: readonly SettlingEntry[],
): Promise<void> {
  await tx
    .update(entries)
    .set({ status })
    .where(
      inArray(
        entries.id,
        settled.map((entry) => entry.id),
      ),
    );
}

/** The Result joined onto a Prediction's Bout, or null where it has none. */
function resultFrom(row: {
  resultWinner: Corner | null;
  resultMethod: Method | null;
  resultRound: number | null;
}): BoutResult | null {
  if (row.resultWinner === null || row.resultMethod === null) return null;

  return { winner: row.resultWinner, method: row.resultMethod, round: row.resultRound };
}

/**
 * The sentence behind a refusal from Postgres, or null for a failure that is
 * not one of this application's rules coming back.
 *
 * Every one of these is asked in the route first, so reaching one means the
 * card moved between the question and the write: another admin entered the
 * result, or the sweep locked a Bout this one thought was open.
 */
function refusalBehind(error: unknown, bout: { scheduledRounds: number }): ResultRefusal | null {
  if (refusedByConstraint(error, ONE_RESULT_PER_BOUT)) {
    return { status: 409, problem: RESULT_MESSAGES.alreadySettled };
  }

  if (refusedByConstraint(error, RESULTS_ARE_ENTERED_ON_BOUTS_THAT_LOCKED)) {
    return { status: 409, problem: RESULT_MESSAGES.boutNotOpened };
  }

  if (refusedByConstraint(error, A_RESULTS_ROUND_WAS_OFFERED)) {
    return { status: 422, problem: RESULT_MESSAGES.roundNotScheduled(bout.scheduledRounds) };
  }

  return null;
}

/**
 * The Result on each of these Bouts, by Bout id, for the ones that have one.
 *
 * Read for a whole card at once rather than a Bout at a time, the way
 * `locksOn` is and for the same reason: an admin looks at a card down the
 * card, and so does everything that shows one.
 */
export async function resultsOn(boutIds: readonly string[]): Promise<Map<string, BoutResult>> {
  if (boutIds.length === 0) return new Map();

  const recorded = await useDatabase()
    .select({
      boutId: boutResults.boutId,
      winner: boutResults.winner,
      method: boutResults.method,
      round: boutResults.round,
    })
    .from(boutResults)
    .where(inArray(boutResults.boutId, boutIds));

  return new Map(
    recorded.map((entered) => [
      entered.boutId,
      { winner: entered.winner, method: entered.method, round: entered.round },
    ]),
  );
}
