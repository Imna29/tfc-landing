/**
 * Settlement: recording how a Bout ended, grading every Entry riding on it, and
 * moving the Coins — as one transaction.
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
 * doing. Whether a Prediction landed, where an Entry now stands and what each
 * of its Predictions ended up paying is `shared/results.ts`, and what a winning
 * Entry returns is `potentialReward` in `shared/entries.ts` — the same function
 * that priced the panel the fan confirmed in, which is what ADR-0013 means by
 * the cap being a rule rather than a number anybody was quoted.
 *
 * A Bout that produced nothing gradable settles through exactly this path
 * (ADR-0005). It is not a lesser kind of settlement: it locks the Bout, records
 * what happened, grades every Entry riding on it, and moves Coins — the
 * difference is only that the Coins it moves are Amounts coming back rather
 * than Rewards going out.
 *
 * Three separate things stop a Bout settled twice from paying twice, and they
 * are deliberately not one: the `bout_results` primary key refuses a second
 * Result, only Entries still Open are graded, and `won_entries_are_rewarded_once`
 * refuses a second standing Reward for an Entry whatever asked for it — with
 * `entries_are_refunded_in_full` saying the same of a refund. The first is what
 * an admin actually meets, and is the one turned back into a sentence below.
 * The others are underneath it, and reaching any of them means something is
 * wrong rather than merely refused — so they are left to fail loudly rather
 * than dressed up as a refusal an admin could read and shrug at.
 *
 * Correcting a Result that was entered wrong is `server/utils/corrections.ts`,
 * and it is this file read backwards: the same Entries, the same grading, the
 * Coins going the other way first. Everything here that it needs is exported
 * for it rather than copied into it — the grading is the part that must not
 * come to be two functions that disagree.
 */
import { COIN_REASONS } from "#shared/coins";
import { potentialReward, type EntryStatus, type PricedPrediction } from "#shared/entries";
import type { Corner } from "#shared/events";
import {
  RESULT_MESSAGES,
  gradeEntry,
  settledPrice,
  type BoutEnding,
  type NoResultReason,
  type RecordedMethod,
  type Settlement,
} from "#shared/results";
import { and, eq, inArray } from "drizzle-orm";
import type { DatabaseTransaction } from "../db/client";
import { boutResults, bouts, entries, predictions } from "../db/schema";
import { creditRewards, refundEntries, type CoinsReturned } from "./coins";
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

/** The check holding a row to a Result or a No Result, and never half of either. */
export const A_RESULT_OR_A_NO_RESULT = "bout_results_is_a_result_or_no_result";

/**
 * The name of the constraint trigger holding a Won Entry to one Reward, and
 * every other Entry to none.
 *
 * #14 held the first half of this as a partial unique index, which a
 * correction's re-graded Reward would meet; #16 replaced it with a rule that
 * counts the Rewards *standing* — the ones no reversal names — and can
 * therefore say the second half too.
 */
export const WON_ENTRIES_ARE_REWARDED_ONCE = "won_entries_are_rewarded_once";

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

/** A Bout settled and what that did, or the reason it was not. */
export type Settled =
  | { settlement: Settlement; refusal?: undefined }
  | { settlement?: undefined; refusal: ResultRefusal };

/**
 * Records how the Bout ended, settles it and grades every Entry riding on it.
 *
 * The order of the writes is the argument, so it is worth reading as one:
 *
 * 1. **Lock the Bout**, if an admin has not already. A Result entered on a Bout
 *    still taking Predictions is the one failure that lets a fan win with
 *    certainty, and this is the door ADR-0006's backstops do not watch. It is
 *    `lockBout`'s `result` kind, attributed to the admin, because what they
 *    decided to do was enter a result.
 * 2. **Write what happened**, which the primary key on `bout_results` allows
 *    once — a Result, or the No Result the Bout produced instead.
 * 3. **Settle the Bout**, which `results_are_entered_on_settled_bouts` holds to
 *    step 2 at commit — neither is ever written without the other.
 * 4. **Take the Entries** this decides, under a row lock, before reading
 *    anything about them. See below for what that lock is actually for.
 * 5. **Grade, then write once each**: the Entries this ended, the Entries it
 *    finished, the Entries it left with nothing gradable, and the Coins all of
 *    that moves.
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
  ending: BoutEnding,
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
        winner: ending.result?.winner ?? null,
        method: ending.result?.method ?? null,
        round: ending.result?.round ?? null,
        noResult: ending.noResult ?? null,
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
 * Grades every Entry this Bout decides, pays the ones it finishes and returns
 * the Amounts of the ones it left with nothing to grade.
 *
 * Two reads and at most five writes, whatever the card's attendance: a
 * settlement is one shape of work whether it touches four Entries or four
 * thousand, and a query per Entry would hold the transaction open across the
 * whole of it.
 */
async function grade(tx: DatabaseTransaction, boutId: string): Promise<Settlement> {
  // An Entry already Won, Lost or Refunded is not graded again. It is the
  // second of the three guards against a Bout settled twice paying twice, and
  // the one that also covers a chain whose earlier Bout already ended it —
  // which is why a correction, whose whole job is to reach those Entries, asks
  // for them by name instead (`correctResult` in `server/utils/corrections.ts`).
  const riding = await entriesRidingOn(tx, boutId, ["open"]);

  // Every Entry on this Bout was decided by an earlier one, or nobody
  // predicted on it at all. Either way there is nothing to read and nothing to
  // write — an admin settling an undercard Bout late on a card sees this.
  if (riding.length === 0) return NOTHING_TO_SETTLE;

  const settling = await entriesToGrade(tx, riding);

  const lost: SettlingEntry[] = [];
  const won: SettlingEntry[] = [];
  const refunded: SettlingEntry[] = [];
  let stillOpen = 0;

  for (const entry of settling) {
    const standing = standingOf(entry);

    if (standing === "lost") lost.push(entry);
    else if (standing === "won") won.push(entry);
    else if (standing === "refunded") refunded.push(entry);
    else stillOpen += 1;
  }

  // No Coin Transaction for a Lost Entry, and there never will be: its Amount
  // left the Balance when it was submitted (ADR-0003), so losing is a status
  // and nothing else. Writing a row here would take the Coins a second time.
  if (lost.length > 0) await markEntries(tx, "lost", lost);
  if (won.length > 0) await markEntries(tx, "won", won);
  if (refunded.length > 0) await markEntries(tx, "refunded", refunded);

  const paid = await creditRewards(
    tx,
    won.map((entry) => rewardFor(entry, COIN_REASONS.entryWon)),
  );
  const returned = await refundEntries(
    tx,
    refunded.map((entry) => refundFor(entry, COIN_REASONS.entryNoResult)),
  );

  return {
    graded: settling.length,
    won: won.length,
    lost: lost.length,
    refunded: refunded.length,
    stillOpen,
    paid,
    returned,
  };
}

/**
 * The Entries riding on this Bout that the caller may move, taken under a row
 * lock before anything is read about them.
 *
 * `moving` is which statuses this transaction is allowed to change, and it is
 * the one line between settling a Bout and correcting it: settlement takes the
 * Entries still Open, because an Entry an earlier Bout already ended is not
 * its business; a correction takes everything but a cancelled Entry, because
 * an Entry an earlier grading got wrong is exactly its business. Both take the
 * lock, and for the same reason.
 *
 * **The lock is not about two admins settling the same Bout** — the primary
 * key on `bout_results` answers that one. It is about two Bouts of the *same
 * Entry* moving at once, which is an admin working down a card quickly.
 * Without it both transactions read the other's Bout as unsettled, both leave
 * the Entry Open, and a fan who won is never paid: no constraint could catch
 * it, because neither transaction ever writes anything wrong.
 */
export async function entriesRidingOn(
  tx: DatabaseTransaction,
  boutId: string,
  moving: readonly EntryStatus[],
): Promise<string[]> {
  const riding = await tx
    .select({ id: entries.id })
    .from(entries)
    .where(
      and(
        inArray(entries.status, [...moving]),
        inArray(
          entries.id,
          tx
            .select({ id: predictions.entryId })
            .from(predictions)
            .where(eq(predictions.boutId, boutId)),
        ),
      ),
    )
    // A consistent order to take the rows in, so two gradings whose Entries
    // overlap queue behind one another rather than deadlocking half way.
    .orderBy(entries.id)
    .for("update");

  return riding.map((entry) => entry.id);
}

/**
 * Everything these Entries need to be graded: their Amounts, every Prediction
 * in them, and how each of those Bouts ended.
 *
 * One statement whatever the card's attendance, and deliberately a *second*
 * statement rather than a `for update` on the take above. That is the point of
 * it: in read committed a statement that waited on a row lock re-reads that
 * row, but reads everything joined to it from the snapshot it started with.
 * This one starts after the lock is held, so what it sees of the other Bouts
 * is what has actually committed.
 */
export async function entriesToGrade(
  tx: DatabaseTransaction,
  entryIds: readonly string[],
): Promise<SettlingEntry[]> {
  if (entryIds.length === 0) return [];

  const rows = await tx
    .select({
      entryId: entries.id,
      seasonId: entries.seasonId,
      userId: entries.userId,
      amount: entries.amount,
      status: entries.status,
      boutId: predictions.boutId,
      question: predictions.question,
      corner: predictions.corner,
      method: predictions.method,
      round: predictions.round,
      multiplier: predictions.multiplier,
      resultWinner: boutResults.winner,
      resultMethod: boutResults.method,
      resultRound: boutResults.round,
      resultNoResult: boutResults.noResult,
    })
    .from(entries)
    .innerJoin(predictions, eq(predictions.entryId, entries.id))
    .leftJoin(boutResults, eq(boutResults.boutId, predictions.boutId))
    .where(inArray(entries.id, [...entryIds]));

  const settling = new Map<string, SettlingEntry>();

  for (const row of rows) {
    const entry = settling.get(row.entryId) ?? {
      id: row.entryId,
      seasonId: row.seasonId,
      userId: row.userId,
      amount: row.amount,
      status: row.status,
      predictions: [],
    };

    settling.set(row.entryId, entry);

    entry.predictions.push({
      boutId: row.boutId,
      question: row.question,
      corner: row.corner,
      method: row.method,
      round: row.round,
      multiplier: row.multiplier,
      ending: endingFrom(row),
    });
  }

  return [...settling.values()];
}

/**
 * Where this Entry stands against everything its Bouts have settled to so far.
 *
 * `gradeEntry` asked of the rows: the Predictions and their endings arrive on
 * one object here and as two fields there, and this is the one line that turns
 * one into the other. Settlement and correction both ask it, of the same rows,
 * and get the same answer — which is what makes a correction a re-grade rather
 * than a second opinion.
 */
export function standingOf(entry: SettlingEntry): EntryStatus {
  return gradeEntry(
    entry.predictions.map((prediction) => ({ prediction, ending: prediction.ending })),
  );
}

/** A settlement that found nothing left to decide, which is a common one. */
const NOTHING_TO_SETTLE: Settlement = {
  graded: 0,
  won: 0,
  lost: 0,
  refunded: 0,
  stillOpen: 0,
  paid: 0,
  returned: 0,
};

/**
 * One Prediction being settled: what it was worth, and how its Bout went.
 *
 * A `PricedPrediction` with the Bout's ending beside it, rather than two
 * collections to keep in step. It is both of the things settlement needs of a
 * Prediction and it is one object: `gradeEntry` reads the answers and the
 * ending off the same row, and `settledPrice` reads the Multipliers and the
 * ending off it to work out what the answer actually pays.
 */
export interface SettlingPrediction extends PricedPrediction {
  /** How its Bout ended, or null while that Bout has not settled. */
  ending: BoutEnding | null;
}

/** One Entry this decides, with everything needed to grade and pay it. */
export interface SettlingEntry {
  id: string;
  seasonId: string;
  userId: string;
  amount: number;
  /**
   * Where it stands now, which is not where {@link standingOf} says it should.
   * Settlement takes only Entries this is `open` for; a correction reads it to
   * know which Entries it is actually moving.
   */
  status: EntryStatus;
  predictions: SettlingPrediction[];
}

/**
 * What a winning Entry returns, worked out by the function that told the fan
 * what it would.
 *
 * ADR-0013 and ADR-0005 in three lines: the combined Multiplier and the ×100
 * cap are worked out here from the Multipliers on the Predictions rather than
 * read back from a number written at submission, and each Prediction is priced
 * at what it *ended up* paying — a No Result at ×1.0, a disqualification at its
 * winner alone. There is nothing to disagree with.
 *
 * `saying` is handed the Multiplier it came to and writes the ledger's reason
 * from it, because the Coins are the same movement whether this is the first
 * grading of the Bout or a correction of one, and only the sentence differs.
 */
export function rewardFor(
  entry: SettlingEntry,
  saying: (multiplier: number) => string,
): CoinsReturned {
  const { multiplier, reward } = potentialReward(
    entry.amount,
    entry.predictions.map((prediction) => settledPrice(prediction, prediction.ending)),
  );

  return {
    seasonId: entry.seasonId,
    userId: entry.userId,
    entryId: entry.id,
    amount: reward,
    reason: saying(multiplier),
  };
}

/**
 * What an Entry of nothing but No Results returns: the Amount, in full.
 *
 * Read off the Entry rather than worked out from its Predictions, though the
 * two agree by arithmetic — every Prediction in it contributes ×1.0, so
 * `potentialReward` would answer the Amount as well. The Amount is what
 * `entries_are_refunded_in_full` checks against, and a refund is the one
 * movement in this file that is not allowed to be a Multiplier's opinion of
 * anything.
 *
 * The reason is the caller's, for the reason it is on {@link rewardFor}: an
 * Amount coming back on a corrected result is the same Amount coming back.
 */
export function refundFor(entry: SettlingEntry, reason: string): CoinsReturned {
  return {
    seasonId: entry.seasonId,
    userId: entry.userId,
    entryId: entry.id,
    amount: entry.amount,
    reason,
  };
}

/** Moves these Entries to where this settlement found them, in one statement. */
export async function markEntries(
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

/** The four columns a `bout_results` row is read back through. */
export interface RecordedEnding {
  resultWinner: Corner | null;
  resultMethod: RecordedMethod | null;
  resultRound: number | null;
  resultNoResult: NoResultReason | null;
}

/**
 * How a Bout ended, joined onto whatever is being read beside it, or null where
 * it has not settled.
 *
 * The one place the four nullable columns are turned back into the union
 * `shared/results.ts` grades against, so that nothing else has to know which
 * combinations of them are possible. `bout_results_is_a_result_or_no_result`
 * is what makes the half-filled row this would have to guess about
 * unwriteable.
 */
export function endingFrom(row: RecordedEnding): BoutEnding | null {
  if (row.resultNoResult !== null) return { noResult: row.resultNoResult };
  if (row.resultWinner === null || row.resultMethod === null) return null;

  return {
    result: { winner: row.resultWinner, method: row.resultMethod, round: row.resultRound },
  };
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
 * How each of these Bouts ended, by Bout id, for the ones that have settled.
 *
 * Read for a whole card at once rather than a Bout at a time, the way
 * `locksOn` is and for the same reason: an admin looks at a card down the
 * card, and so does everything that shows one.
 */
export async function endingsOn(boutIds: readonly string[]): Promise<Map<string, BoutEnding>> {
  if (boutIds.length === 0) return new Map();

  const recorded = await useDatabase()
    .select({
      boutId: boutResults.boutId,
      resultWinner: boutResults.winner,
      resultMethod: boutResults.method,
      resultRound: boutResults.round,
      resultNoResult: boutResults.noResult,
    })
    .from(boutResults)
    .where(inArray(boutResults.boutId, boutIds));

  const endings = new Map<string, BoutEnding>();

  for (const row of recorded) {
    const ending = endingFrom(row);

    // A row that is neither a Result nor a No Result cannot be written, so
    // this drops nothing — it is how the union stays the only shape anything
    // downstream has to read.
    if (ending) endings.set(row.boutId, ending);
  }

  return endings;
}
