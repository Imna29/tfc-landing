/**
 * Correcting a Result that was entered wrong, after Entries have settled
 * against it: reversing the Coin Transactions it wrote, recording what it used
 * to say, and grading every Entry on the Bout again — as one transaction.
 *
 * **This is the scenario ADR-0003 built the ledger for.** A Result is typed in
 * by somebody watching a fight, and the fights this game is played on are
 * decided in a cage at one in the morning; by the time anybody notices the
 * winner was recorded the wrong way round, Rewards are in Balances that fans
 * have seen, and some of those Coins are committed to other Entries. With a
 * mutable balance column the only available fix would be quietly rewriting
 * people's totals with nothing to say it happened. With a ledger, the fix is
 * rows: the Reward stays, a reversal stands beside it, and the re-graded
 * Reward stands beside that — so the mistake and its correction are both
 * readable afterwards, by an admin and by the fan who is unhappy.
 *
 * `server/utils/results.ts` read backwards, and deliberately built out of its
 * pieces rather than a second copy of them. The grading is the part that must
 * not become two functions that disagree: a correction that graded an Entry
 * differently from the settlement it is correcting would be a bug nothing
 * could catch, because both answers would look reasonable.
 *
 * Three things about the shape are worth knowing before changing anything
 * here:
 *
 * - **The Result row is updated, not replaced.** `bout_results` holds one row
 *   per Bout and everything that shows a Prediction grades against it, so
 *   there is no version of "the current Result" that is two rows — and a
 *   correction that deleted the old one would have to unsettle the Bout, which
 *   `a_locked_bout_is_never_reopened` refuses outright. What it said before
 *   goes to `bout_result_corrections`, and `corrected_results_are_recorded`
 *   makes that not something a writer has to remember.
 * - **Only what is no longer true is moved.** An Entry whose grade has not
 *   changed is left exactly as it is, ledger rows included. Reversing and
 *   re-paying an identical Reward would be two rows saying nothing, in the
 *   history of a fan who was not affected — on a well-attended card, for
 *   several hundred of them.
 * - **A Balance can go below zero, and that is the correction working.** See
 *   `reverseCoins` in `server/utils/coins.ts`, and the deliberate narrowness of
 *   `entry_commitments_are_within_the_balance`.
 */
import { COIN_REASONS } from "#shared/coins";
import type { EntryStatus } from "#shared/entries";
import {
  isTheSameEnding,
  RESULT_MESSAGES,
  type BoutEnding,
  type Correction,
  type ResultCorrection,
} from "#shared/results";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { DatabaseTransaction } from "../db/client";
import { boutResultCorrections, boutResults, coinTransactions, users } from "../db/schema";
import {
  balancesToMoveFrom,
  creditRewards,
  refundEntries,
  reverseCoins,
  type CoinsReturned,
  type CoinsReversed,
} from "./coins";
import { useDatabase } from "./db";
import {
  endingFrom,
  entriesRidingOn,
  entriesToGrade,
  markEntries,
  refundFor,
  rewardFor,
  standingOf,
  type ResultRefusal,
  type SettlingEntry,
} from "./results";

/** The name of the constraint trigger that holds a reversal to what it undoes. */
export const A_REVERSAL_UNDOES_THE_ROW_IT_NAMES = "a_reversal_undoes_the_row_it_names";

/** The index that refuses taking the same movement back twice. */
export const ONE_REVERSAL_PER_ROW = "coin_transactions_one_reversal_per_row";

/** The name of the constraint trigger tying a correction to the log of it. */
export const CORRECTED_RESULTS_ARE_RECORDED = "corrected_results_are_recorded";

/** The name of the trigger that refuses to rewrite the Result audit log. */
export const BOUT_RESULT_CORRECTIONS_ARE_APPEND_ONLY = "bout_result_corrections_are_append_only";

/**
 * The statuses a correction may move an Entry out of, which is every status but
 * one.
 *
 * Cancelled is the exception and is not a near miss. A fan cancels an Entry
 * while every Bout in it is still open, before anything in it has been decided
 * (`CONTEXT.md`), so no Result was ever graded against it and no correction of
 * one has anything to say about it. Reaching into those Entries would be the
 * game taking back a decision the fan made — and `an_entry_is_cancelled_once_out_of_open`
 * refuses it underneath regardless.
 */
const STATUSES_A_CORRECTION_MAY_MOVE: readonly EntryStatus[] = ["open", "won", "lost", "refunded"];

/** A Result corrected and what that moved, or the reason it was not. */
export type Corrected =
  | { correction: Correction; refusal?: undefined }
  | { correction?: undefined; refusal: ResultRefusal };

/**
 * Corrects the Result on a settled Bout, reversing what it paid and grading
 * every Entry on it again.
 *
 * The order of the writes is the argument, so it is worth reading as one:
 *
 * 1. **Take the Result**, under a row lock, which is what makes two admins
 *    correcting the same Bout in the same second queue rather than each reverse
 *    the same Rewards. The second of them reads what the first one left and
 *    corrects that.
 * 2. **Take the Entries** this Bout decides — every one of them that is not
 *    cancelled — under a row lock, before anything is read about them. It is
 *    `entriesRidingOn`'s lock and it is here for the same reason settlement
 *    takes it: two Bouts of one chain being graded at once.
 * 3. **Record what the Result said**, then write what it says now. Both, or
 *    neither: `corrected_results_are_recorded`.
 * 4. **Re-grade, and move only what changed**: reverse the Rewards and refunds
 *    that are no longer right, write the ones that now are, and move the
 *    statuses that moved.
 *
 * Nothing here re-opens the Bout, re-locks it or touches its Lock record. The
 * Bout stopped taking Predictions when it stopped taking Predictions, and a
 * Result being wrong does not change the moment that happened — which is the
 * answer `bout_locks` exists to give (ADR-0006).
 */
export async function correctResult(
  bout: { id: string },
  ending: BoutEnding,
  by: string,
): Promise<Corrected> {
  return useDatabase().transaction(async (tx) => {
    const [standing] = await tx
      .select({
        resultWinner: boutResults.winner,
        resultMethod: boutResults.method,
        resultRound: boutResults.round,
        resultNoResult: boutResults.noResult,
      })
      .from(boutResults)
      .where(eq(boutResults.boutId, bout.id))
      .for("update");

    // Nothing has been entered about this Bout, so there is nothing to correct.
    // Asked in the route first, off the Bout's status; asked again here because
    // between the two an admin can enter the first Result — and because this is
    // the read that holds the row.
    if (!standing) return refuse(409, RESULT_MESSAGES.notSettled);

    // The four columns as the union everything grades against, which is what
    // `isTheSameEnding` compares.
    const wasEnding = endingFrom(standing);

    // A row that is neither a Result nor a No Result cannot be written
    // (`bout_results_is_a_result_or_no_result`), so this is unreachable rather
    // than merely unlikely — and answering it as "nothing to correct" is the
    // one safe thing to do with a Bout whose ending nothing can read.
    if (!wasEnding) return refuse(409, RESULT_MESSAGES.notSettled);

    // Re-entering what is already there is not a correction. Refused rather
    // than honoured as a no-op, because honouring it would write a row in the
    // audit log saying a Result was replaced by itself, which is a correction
    // that never happened being recorded as one.
    if (isTheSameEnding(wasEnding, ending)) return refuse(422, RESULT_MESSAGES.alreadyTheResult);

    const riding = await entriesRidingOn(tx, bout.id, STATUSES_A_CORRECTION_MAY_MOVE);

    // Copied inside Postgres rather than read out and written back, and it is
    // worth being deliberate about: `entered_at` is a `timestamptz`, which
    // keeps microseconds, and a JavaScript `Date` keeps milliseconds — so a
    // round trip through this process would log a moment a few microseconds
    // away from the one it claims to be copying. `corrected_results_are_recorded`
    // compares the two field for field and would refuse it, which is the
    // trigger doing exactly what it is for. An `insert ... select` cannot be
    // wrong about the row it is copying.
    await tx.execute(sql`
      insert into ${boutResultCorrections}
        (bout_id, winner, method, round, no_result, entered_at, entered_by, corrected_by)
      select bout_id, winner, method, round, no_result, entered_at, entered_by, ${by}::uuid
      from ${boutResults}
      where bout_id = ${bout.id}::uuid
    `);

    await tx
      .update(boutResults)
      .set({
        winner: ending.result?.winner ?? null,
        method: ending.result?.method ?? null,
        round: ending.result?.round ?? null,
        noResult: ending.noResult ?? null,
        // Who says this is what happened, and when they said it. The admin who
        // entered the Result being replaced is not overwritten: they are on the
        // correction row, beside what they said.
        enteredAt: new Date(),
        enteredBy: by,
      })
      .where(eq(boutResults.boutId, bout.id));

    return { correction: await regrade(tx, riding) };
  });
}

/**
 * Grades these Entries against what the Bouts now say, moves the ones that have
 * changed, and answers with what that came to.
 *
 * Two reads and at most six writes, whatever the card's attendance — the shape
 * `grade` has in `server/utils/results.ts`, with the reversals in front. A
 * query per Entry would hold the transaction open across the whole of a card's
 * audience, and this transaction is holding a row lock on every Entry in it.
 */
async function regrade(tx: DatabaseTransaction, riding: readonly string[]): Promise<Correction> {
  if (riding.length === 0) return NOTHING_TO_CORRECT;

  const settling = await entriesToGrade(tx, riding);
  const held = await standingMovements(tx, riding);

  const moved = new Map<EntryStatus, SettlingEntry[]>();
  const standings = new Map<EntryStatus, number>();
  const reversals: CoinsReversed[] = [];
  const rewards: CoinsReturned[] = [];
  const refunds: CoinsReturned[] = [];

  for (const entry of settling) {
    const standing = standingOf(entry);
    const holding = held.get(entry.id);

    standings.set(standing, (standings.get(standing) ?? 0) + 1);

    // A Reward is re-priced as well as re-graded. A correction that turns a
    // disqualification into a KO/TKO leaves an Entry Won either way and pays a
    // different number, because a DQ neutralises the method and round the fan
    // named (ADR-0005) and a KO/TKO grades them. So what is compared is the
    // Reward this Entry would be paid now against the one standing beside it,
    // rather than the status alone.
    const reward =
      standing === "won"
        ? rewardFor(entry, (multiplier) =>
            COIN_REASONS.afterACorrection(COIN_REASONS.entryWon(multiplier)),
          )
        : null;
    const refund =
      standing === "refunded"
        ? refundFor(entry, COIN_REASONS.afterACorrection(COIN_REASONS.entryNoResult))
        : null;

    if (holding?.reward && holding.reward.amount !== reward?.amount) {
      reversals.push(takingBack(entry, holding.reward, COIN_REASONS.rewardReversed));
    }

    if (holding?.refund && refund === null) {
      reversals.push(takingBack(entry, holding.refund, COIN_REASONS.refundReversed));
    }

    // The Coins are written only where they are not already there. An Entry
    // that won before and wins the same Reward now keeps the row it was paid
    // with: reversing it and writing an identical one would be two movements
    // in a fan's history that add up to nothing having happened.
    if (reward && reward.amount !== holding?.reward?.amount) rewards.push(reward);
    if (refund && !holding?.refund) refunds.push(refund);

    if (standing !== entry.status) moved.set(standing, [...(moved.get(standing) ?? []), entry]);
  }

  // The Balance row of every fan whose Coins this moves, taken before the first
  // of those Coins moves and after the Entries themselves — the order
  // `cancelEntry` takes them in, and the rule `balanceToMoveFrom` states of
  // every transaction that writes a Coin Transaction. A correction overlapping
  // a submission by the same fan would otherwise leave the materialised
  // Balance saying a number neither of them meant.
  await balancesToMoveFrom(tx, [...reversals, ...rewards, ...refunds]);

  // Reversed before anything is paid, so that an Entry moving from one Reward
  // to another is never momentarily holding both — `won_entries_are_rewarded_once`
  // is deferred and would not notice, but the order the rows are written in is
  // the order somebody reads them in afterwards.
  const reversed = await reverseCoins(tx, reversals);

  for (const [status, entries] of moved) await markEntries(tx, status, entries);

  const paid = await creditRewards(tx, rewards);
  const returned = await refundEntries(tx, refunds);

  return {
    graded: settling.length,
    won: standings.get("won") ?? 0,
    lost: standings.get("lost") ?? 0,
    refunded: standings.get("refunded") ?? 0,
    stillOpen: standings.get("open") ?? 0,
    paid,
    returned,
    reversed,
  };
}

/** A correction on a Bout no Entry is riding on, which is a quiet card. */
const NOTHING_TO_CORRECT: Correction = {
  graded: 0,
  won: 0,
  lost: 0,
  refunded: 0,
  stillOpen: 0,
  paid: 0,
  returned: 0,
  reversed: 0,
};

/** The Reward and the refund an Entry is currently holding, if it holds either. */
interface StandingMovements {
  reward?: { id: string; amount: number };
  refund?: { id: string; amount: number };
}

/**
 * What each of these Entries has been paid that has not since been taken back.
 *
 * "Standing" is the whole question a correction asks of the ledger, and it is
 * asked here the same way `won_entries_are_rewarded_once` and
 * `entries_are_refunded_in_full` ask it: a movement is standing when no
 * reversal names it. Reading it any other way — the newest row, the sum of the
 * rows — would be a second definition of the word, and the day the two
 * disagreed the constraint would refuse a correction the code thought was
 * right.
 */
async function standingMovements(
  tx: DatabaseTransaction,
  entryIds: readonly string[],
): Promise<Map<string, StandingMovements>> {
  // An anti-join: every Reward and refund of these Entries, less the ones a
  // reversal points at. `coin_transactions_one_reversal_per_row` is what makes
  // the join at most one row, and
  // `coin_transactions_a_reversal_names_what_it_undoes` is why no filter on
  // the reversal's kind is needed — nothing else in this table names another
  // row at all.
  const reversal = alias(coinTransactions, "reversal");

  const rows = await tx
    .select({
      id: coinTransactions.id,
      kind: coinTransactions.kind,
      amount: coinTransactions.amount,
      entryId: coinTransactions.causeId,
    })
    .from(coinTransactions)
    .leftJoin(reversal, eq(reversal.reverses, coinTransactions.id))
    .where(
      and(
        inArray(coinTransactions.causeId, [...entryIds]),
        inArray(coinTransactions.kind, ["entry_reward", "entry_refund"]),
        isNull(reversal.id),
      ),
    );

  const held = new Map<string, StandingMovements>();

  for (const row of rows) {
    const holding = held.get(row.entryId) ?? {};
    const movement = { id: row.id, amount: row.amount };

    held.set(
      row.entryId,
      row.kind === "entry_reward"
        ? { ...holding, reward: movement }
        : { ...holding, refund: movement },
    );
  }

  return held;
}

/** One movement of an Entry's, as the row that takes it back. */
function takingBack(
  entry: SettlingEntry,
  movement: { id: string; amount: number },
  reason: string,
): CoinsReversed {
  return {
    transactionId: movement.id,
    seasonId: entry.seasonId,
    userId: entry.userId,
    entryId: entry.id,
    amount: movement.amount,
    reason,
  };
}

/** A correction the card had moved on from, as the admin reads it. */
function refuse(status: number, problem: string): Corrected {
  return { refusal: { status, problem } };
}

/**
 * Every correction made to these Bouts' Results, oldest first, by Bout id.
 *
 * Read for a whole card at once rather than a Bout at a time, the way `locksOn`
 * and `endingsOn` are and for the same reason: an admin looks at a card down
 * the card. Most Bouts have none of these, and the ones that do have one.
 */
export async function correctionsOn(
  boutIds: readonly string[],
): Promise<Map<string, ResultCorrection[]>> {
  if (boutIds.length === 0) return new Map();

  const recorded = await useDatabase()
    .select({
      boutId: boutResultCorrections.boutId,
      resultWinner: boutResultCorrections.winner,
      resultMethod: boutResultCorrections.method,
      resultRound: boutResultCorrections.round,
      resultNoResult: boutResultCorrections.noResult,
      correctedAt: boutResultCorrections.correctedAt,
      by: users.username,
    })
    .from(boutResultCorrections)
    .innerJoin(users, eq(users.id, boutResultCorrections.correctedBy))
    .where(inArray(boutResultCorrections.boutId, [...boutIds]))
    .orderBy(boutResultCorrections.correctedAt);

  const corrections = new Map<string, ResultCorrection[]>();

  for (const row of recorded) {
    const ending = endingFrom(row);

    // A row that is neither a Result nor a No Result cannot be written, so
    // this drops nothing — it is how the union stays the only shape anything
    // downstream has to read.
    if (!ending) continue;

    corrections.set(row.boutId, [
      ...(corrections.get(row.boutId) ?? []),
      { ending, at: row.correctedAt.toISOString(), by: row.by },
    ]);
  }

  return corrections;
}
