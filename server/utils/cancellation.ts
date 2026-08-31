/**
 * Cancelling an Entry: the Entries a fan is holding, and taking one back
 * before any of it has started being decided.
 *
 * The other end of `server/utils/entries.ts`. Submitting asks whether the game
 * will take these answers and whether the fan holds the Coins; this asks the
 * one question that decides whether an Entry can still be undone — is every
 * Bout in it still open — and then returns the Amount in full.
 *
 * **Why that rule is the whole feature.** Multipliers are frozen at submission
 * (ADR-0002), so an Entry that could be withdrawn at any point would let a fan
 * wait for one to move, or fish for a pricing mistake and back out of it, and
 * "frozen at submission" would mean nothing. It is worth as much as
 * "Predictions are made on open Bouts": a fan who could take an Entry back
 * after a Bout closed could take it back knowing how that Bout was going.
 *
 * Nothing here decides what cancelling *means* — that is `cancellationOf` in
 * `shared/entries.ts`, asked by the listing a fan reads before they press
 * anything and asked again here of the rows in Postgres. What this module adds
 * is everything only the database knows: which Entries are this fan's, where
 * each of their Bouts actually stands, and the Coins.
 */
import { COIN_REASONS } from "#shared/coins";
import {
  CANCELLATION_MESSAGES,
  cancellationOf,
  type CommittedEntry,
  type EntryStatus,
  type PredictedBout,
} from "#shared/entries";
import { and, desc, eq } from "drizzle-orm";
import type { DatabaseTransaction } from "../db/client";
import { boutResults, bouts, entries, events, predictions } from "../db/schema";
import { balanceOf, balanceToMoveFrom, refundEntries } from "./coins";
import { looksLikeId, refusedByConstraint, useDatabase } from "./db";
import { firstOnTheCard, lockMomentOf, type AsAt } from "./locks";
import { endingFrom } from "./results";

/** The name of the trigger that refuses a cancellation once a Bout has locked. */
export const ENTRIES_ARE_CANCELLED_WHILE_EVERY_BOUT_IS_OPEN =
  "entries_are_cancelled_while_every_bout_is_open";

/**
 * The name of the trigger that holds an Entry to one cancellation, out of Open,
 * and to staying cancelled afterwards.
 *
 * It covered the Refunded an Entry of nothing but No Results reaches as well
 * until #16, which took that half out: a Refund is the game's decision about a
 * Result, and a Result can be corrected, so an Entry has to be able to leave it
 * — with its refund reversed in the same transaction. A Cancellation is the
 * fan's own decision about a card that had not started, and nothing corrects
 * one.
 */
export const AN_ENTRY_IS_CANCELLED_ONCE_OUT_OF_OPEN = "an_entry_is_cancelled_once_out_of_open";

/**
 * The name of the constraint trigger tying either status that returns an
 * Amount to the refund that returned it — and, since #16, to a refund that is
 * still standing rather than one that has since been reversed.
 */
export const ENTRIES_ARE_REFUNDED_IN_FULL = "entries_are_refunded_in_full";

/**
 * Why an Entry was not cancelled, in the words the fan reads and the status
 * the route answers with.
 *
 * The same shape `EntryRefusal` has in `server/utils/entries.ts`, and declared
 * here rather than shared with it because the statuses are this module's own:
 * 404 is an Entry that is not this fan's — or is nobody's — and 409 is one the
 * card, or the fan's own earlier request, has moved on from. Nothing here can
 * be refused for what it was made of, which is the whole of what a 422 would
 * mean.
 */
export interface CancellationRefusal {
  problem: string;
  status: number;
}

/** An Entry the fan took back, and the Balance it left behind. */
export type Cancelled =
  | { entry: CancelledEntry; balance: number; refusal?: undefined }
  | { entry?: undefined; balance?: undefined; refusal: CancellationRefusal };

/** A cancelled Entry, as the fan who cancelled it is shown it back. */
export interface CancelledEntry {
  id: string;
  status: EntryStatus;
  /** The Coins returned, which are all of the ones it committed. */
  amount: number;
}

/**
 * Every Entry this fan has committed in this Season, newest first, with where
 * each of its Bouts stands.
 *
 * Scoped to one Season because that is what a Balance is scoped to, and
 * because the Entries worth showing beside a card are the ones being played on
 * it. The history that goes back through every Season, with each Prediction
 * graded, is the profile page's (#17).
 *
 * A cancelled Entry is listed like any other. It is Coins that moved and a
 * decision the fan made, and a listing it disappeared from would be a fan
 * wondering what became of an Entry they remember submitting.
 *
 * Every Bout carries its own automatic Lock moment rather than only its status
 * (`automaticLock` in `shared/locks.ts`), so the page can stop offering to
 * cancel at the instant a Lock falls due rather than at the next time somebody
 * asks the server. `sweepAfter` is passed in for the reason `priceAnswers`
 * takes it: it is configuration, and this module is easier to reason about for
 * not reading the environment itself.
 */
export async function committedEntries(
  fan: { seasonId: string; fanId: string },
  at: AsAt,
): Promise<CommittedEntry[]> {
  const rows = await useDatabase()
    .select({
      id: entries.id,
      status: entries.status,
      amount: entries.amount,
      submittedAt: entries.submittedAt,
      boutId: predictions.boutId,
      corner: predictions.corner,
      method: predictions.method,
      round: predictions.round,
      winnerMultiplier: predictions.winnerMultiplier,
      methodMultiplier: predictions.methodMultiplier,
      roundMultiplier: predictions.roundMultiplier,
      cardOrder: bouts.cardOrder,
      boutStatus: bouts.status,
      redName: bouts.redName,
      blueName: bouts.blueName,
      scheduledStart: events.scheduledStart,
      // How the Bout ended, for the Predictions whose Bouts have settled. A No
      // Result has to say why it was one where the fan reads it (ADR-0005),
      // and it is what reprices the answer to the ×1.0 it now contributes.
      resultWinner: boutResults.winner,
      resultMethod: boutResults.method,
      resultRound: boutResults.round,
      resultNoResult: boutResults.noResult,
      // The Bout fought first on this card, which is the one that locks with
      // the card itself (ADR-0006).
      firstOnTheCard,
    })
    .from(entries)
    .innerJoin(predictions, eq(predictions.entryId, entries.id))
    .innerJoin(bouts, eq(bouts.id, predictions.boutId))
    .innerJoin(events, eq(events.id, bouts.eventId))
    .leftJoin(boutResults, eq(boutResults.boutId, predictions.boutId))
    .where(and(eq(entries.userId, fan.fanId), eq(entries.seasonId, fan.seasonId)))
    // Newest Entry first, and inside each one the order the Bouts are fought:
    // the two orders a fan reads their own Entries in.
    .orderBy(desc(entries.submittedAt), bouts.cardOrder);

  const held = new Map<string, CommittedEntry>();

  for (const row of rows) {
    const entry = held.get(row.id) ?? {
      id: row.id,
      status: row.status,
      amount: row.amount,
      submittedAt: row.submittedAt.toISOString(),
      predictions: [],
    };

    held.set(row.id, entry);

    entry.predictions.push({
      boutId: row.boutId,
      corner: row.corner,
      method: row.method,
      round: row.round,
      winnerMultiplier: row.winnerMultiplier,
      methodMultiplier: row.methodMultiplier,
      roundMultiplier: row.roundMultiplier,
      cardOrder: row.cardOrder,
      corners: { red: row.redName, blue: row.blueName },
      status: row.boutStatus,
      locksAt: lockMomentOf(row, at.sweepAfter).at,
      ending: endingFrom(row),
    });
  }

  return [...held.values()];
}

/**
 * Cancels an Entry and returns its Amount, as one transaction.
 *
 * The Entry row is taken `for update` before anything is read about it, and
 * that is the whole of "an Entry cannot be cancelled twice, or double-refunded,
 * under concurrent requests": two requests arriving together queue behind the
 * row, and the second reads the status the first one left. Without it both
 * would read `open`, both would find every Bout open, and the fan would be
 * refunded twice — with `entries_are_refunded_in_full` the only thing left to
 * notice, at commit, after one of the two transactions had already told a fan
 * it worked. The fan's Balance row is taken next, for the quieter reason
 * {@link balanceToMoveFrom} gives: a cancellation and a submission overlapping
 * would otherwise leave the materialised Balance saying a number neither of
 * them meant.
 *
 * The Season is the Entry's own rather than the one being played. An Entry
 * belongs to the competition it was made in and the Coins it moves are that
 * Season's, and reading it off the row means this never has to be told which.
 *
 * Refusals are the ones a fan can act on: an Entry that is not theirs, one
 * already cancelled or already graded, and a card that has started. The last
 * is the only one asked twice — here and by
 * `entries_are_cancelled_while_every_bout_is_open`, because an admin can lock
 * a Bout in the moment between the two, and this is the one race the row lock
 * above does not settle. The rest of what Postgres holds is left to fail
 * loudly: with that lock, reaching one of those is something being wrong
 * rather than something being refused.
 */
export async function cancelEntry(
  cancellation: { entryId: string; fanId: string },
  at: AsAt,
): Promise<Cancelled> {
  const { entryId, fanId } = cancellation;

  // Asked before the query rather than after it: an id that is not one is not
  // an Entry anybody has, and casting it inside a `where` raises a 500 halfway
  // down a query instead of answering the fan (see `looksLikeId`).
  if (!looksLikeId(entryId)) return refuse(404, CANCELLATION_MESSAGES.notYours);

  try {
    return await useDatabase().transaction(async (tx) => {
      const [entry] = await tx
        .select({
          id: entries.id,
          seasonId: entries.seasonId,
          status: entries.status,
          amount: entries.amount,
        })
        .from(entries)
        // Scoped to the fan asking, so that another fan's Entry is not an
        // Entry at all rather than one they are told they may not touch:
        // whether somebody else holds an Entry of that id is not news TFC owes
        // anybody.
        .where(and(eq(entries.id, entryId), eq(entries.userId, fanId)))
        .for("update");

      if (!entry) throw new Refused(404, CANCELLATION_MESSAGES.notYours);

      // Taken before anything is written and after the Entry itself, which is
      // the order settlement takes them in: every transaction that moves a
      // fan's Coins queues on this row, so that the recomputed Balance a
      // refund leaves behind cannot be written from a snapshot taken before a
      // submission committed. The number it answers is not needed here — what
      // a cancellation returns is the Amount, whatever the Balance was.
      await balanceToMoveFrom(tx, entry.seasonId, fanId);

      const { cancellable, reason } = cancellationOf(
        { status: entry.status, predictions: await boutsBehind(tx, entry.id, at.sweepAfter) },
        at.now.getTime(),
      );

      if (!cancellable) throw new Refused(409, reason);

      await tx.update(entries).set({ status: "cancelled" }).where(eq(entries.id, entry.id));

      await refundEntries(tx, [
        {
          seasonId: entry.seasonId,
          userId: fanId,
          entryId: entry.id,
          amount: entry.amount,
          reason: COIN_REASONS.entryCancelled,
        },
      ]);

      return {
        entry: { id: entry.id, status: "cancelled" as const, amount: entry.amount },
        // Read back rather than worked out from the Amount: the Balance a fan
        // is shown next is what the ledger says, and this is the one moment
        // this request knows it without a second round trip.
        balance: await balanceOf(entry.seasonId, fanId, tx),
      };
    });
  } catch (error) {
    if (error instanceof Refused) {
      return { refusal: { status: error.status, problem: error.problem } };
    }

    // The one rule underneath that a request can genuinely lose a race to: an
    // admin locking a Bout between the read above and this write. The trigger
    // re-reads the Bout rows as the statement runs, so it sees the Lock this
    // transaction's snapshot does not.
    if (refusedByConstraint(error, ENTRIES_ARE_CANCELLED_WHILE_EVERY_BOUT_IS_OPEN)) {
      return { refusal: { status: 409, problem: CANCELLATION_MESSAGES.boutLocked } };
    }

    throw error;
  }
}

/** Where each Bout of this Entry stands, read through the transaction. */
async function boutsBehind(
  tx: DatabaseTransaction,
  entryId: string,
  sweepAfter: number,
): Promise<PredictedBout[]> {
  const held = await tx
    .select({
      cardOrder: bouts.cardOrder,
      boutStatus: bouts.status,
      scheduledStart: events.scheduledStart,
      firstOnTheCard,
    })
    .from(predictions)
    .innerJoin(bouts, eq(bouts.id, predictions.boutId))
    .innerJoin(events, eq(events.id, bouts.eventId))
    .where(eq(predictions.entryId, entryId));

  return held.map((bout) => ({
    status: bout.boutStatus,
    locksAt: lockMomentOf(bout, sweepAfter).at,
  }));
}

/** A rule this module asked about first, refused inside the transaction. */
class Refused extends Error {
  constructor(
    readonly status: number,
    readonly problem: string,
  ) {
    super(problem);
  }
}

function refuse(status: number, problem: string): Cancelled {
  return { refusal: { status, problem } };
}
