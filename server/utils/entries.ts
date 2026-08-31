/**
 * Submitting an Entry: copying the Multipliers in force onto the Predictions,
 * and writing the Entry and the Coins it commits as one transaction.
 *
 * The two halves are apart because they answer different questions. Pricing
 * asks whether the game will take these answers at all — is that Bout still
 * open, does that round exist on it — and can be asked without writing
 * anything. Submitting asks the only question that has to be answered while
 * holding a lock: whether the fan still has the Coins.
 *
 * Nothing here decides what an Entry may be made of. That is `shared/entries.ts`,
 * asked of what arrived before any of this runs, and asked again by the page
 * while a fan is still choosing. What this module adds is everything only the
 * database knows.
 */
import { COIN_REASONS } from "#shared/coins";
import {
  ENTRY_MESSAGES,
  potentialReward,
  predictionMultiplier,
  priceOf,
  type OfferedAnswer,
  type PredictionAnswer,
  type PricedPrediction,
} from "#shared/entries";
import type { Corner } from "#shared/events";
import { boutState, lockMoment } from "#shared/predictions";
import { MULTIPLIER, type Method } from "#shared/pricing";
import { eq, inArray, sql } from "drizzle-orm";
import { bouts, entries, events, outcomes, predictions } from "../db/schema";
import { balanceOf, balanceToCommitFrom, commitCoins } from "./coins";
import { looksLikeId, refusedByConstraint, useDatabase } from "./db";

/** The name of the trigger that refuses a Prediction on a Bout that is not open. */
export const PREDICTIONS_ARE_MADE_ON_OPEN_BOUTS = "predictions_are_made_on_open_bouts";

/** The name of the index that holds ADR-0004's one Prediction per Bout. */
export const ONE_PREDICTION_PER_BOUT = "predictions_one_per_bout_in_an_entry";

/** The name of the trigger that refuses an Entry of no or too many Predictions. */
export const ENTRIES_HOLD_ONE_TO_TEN_PREDICTIONS = "entries_hold_one_to_ten_predictions";

/** The name of the trigger that refuses Coins a fan does not hold. */
export const COMMITMENTS_ARE_WITHIN_THE_BALANCE = "entry_commitments_are_within_the_balance";

/** The keys that hold a Prediction to answers its Bout was actually offering. */
export const ANSWERS_ARE_OFFERED = [
  "predictions_winner_is_offered",
  "predictions_method_is_offered",
  "predictions_round_is_offered",
] as const;

/** The key that holds a Prediction to a Bout that is on a card. */
export const PREDICTIONS_POINT_AT_A_BOUT = "predictions_bout_id_bouts_id_fk";

/**
 * Why an Entry was not accepted, in the words the fan reads and the status the
 * route answers with.
 *
 * The status is decided here rather than in the route because it is part of
 * the same answer: 422 is an Entry that cannot be accepted as it was sent, and
 * 409 is one the card moved out from under while the fan was building it. A
 * route mapping sentences back to numbers would be a second place to keep them
 * in step.
 */
export interface EntryRefusal {
  problem: string;
  status: number;
}

/** A Prediction priced and ready to be written, with where its Bout is fought. */
export interface PlacedPrediction extends PricedPrediction {
  cardOrder: number;
}

/** Predictions carrying what they pay, or the reason they carry nothing. */
export type PricedAnswers =
  | { predictions: PlacedPrediction[]; refusal?: undefined }
  | { predictions?: undefined; refusal: EntryRefusal };

/** One Prediction of an Entry that has been accepted. */
export interface SubmittedPrediction {
  boutId: string;
  cardOrder: number;
  corner: Corner;
  method: Method | null;
  round: number | null;
  /** What this Prediction pays: the product of the answers it is made of. */
  multiplier: number;
}

/** An Entry the game has accepted, as the fan is shown it back. */
export interface SubmittedEntry {
  id: string;
  amount: number;
  /** The combined Multiplier, after the ×100 cap. */
  multiplier: number;
  /** Whether the cap is what decided that number. */
  capped: boolean;
  /** The Coins it returns if every Prediction in it lands. */
  reward: number;
  submittedAt: string;
  predictions: SubmittedPrediction[];
}

/** An accepted Entry and the Balance it left behind, or why there is neither. */
export type Submission =
  | { entry: SubmittedEntry; balance: number; refusal?: undefined }
  | { entry?: undefined; balance?: undefined; refusal: EntryRefusal };

/**
 * The Multipliers in force on these answers, copied onto them (ADR-0002).
 *
 * Copied rather than pointed at, which is the whole of ADR-0002: an admin
 * correcting a mispriced Outcome tomorrow changes what the next Entry is
 * offered and never one that already exists.
 *
 * Four things are asked of every answer, and each of them is asked again
 * underneath — by the `predictions_are_made_on_open_bouts` trigger and by the
 * three `predictions_…_is_offered` foreign keys. They are asked here so that a
 * fan is told which Bout and why, rather than being handed the database's
 * opinion of their Entry.
 *
 * `now` is passed in rather than read here so that the moment a Lock is judged
 * against is the moment the request was answered — the same decision the card
 * a fan is looking at was rendered from.
 */
export async function priceAnswers(
  answers: readonly PredictionAnswer[],
  within: { seasonId: string; now: Date },
): Promise<PricedAnswers> {
  const boutIds = answers.map((answer) => answer.boutId);

  // Asked before the query rather than after it: an id that is not one is not
  // a Bout anybody has, and casting it inside the `where` below raises a 500
  // halfway down a query instead of answering the fan (see `looksLikeId`).
  if (!boutIds.every(looksLikeId)) return refuse(409, ENTRY_MESSAGES.boutNotOnTheCard);

  const rows = await useDatabase()
    .select({
      id: bouts.id,
      cardOrder: bouts.cardOrder,
      status: bouts.status,
      seasonId: events.seasonId,
      scheduledStart: events.scheduledStart,
      // The Bout fought first on this card, which is the one that locks with
      // the card itself (ADR-0006). The inner `bouts` is aliased so that the
      // `event_id` in its `where` is unmistakably its own, and `events.id` is
      // the outer row it is correlated against.
      firstOnTheCard: sql<number>`(
        select min(place.card_order) from ${bouts} as place where place.event_id = ${events.id}
      )`.mapWith(Number),
    })
    .from(bouts)
    .innerJoin(events, eq(events.id, bouts.eventId))
    .where(inArray(bouts.id, boutIds));

  const onTheCard = new Map(rows.map((row) => [row.id, row]));

  // Every Outcome of every Bout answered, in one query: an Entry is at most
  // ten Bouts of ten Outcomes, and reading them a Bout at a time would be ten
  // round trips before anything is written.
  const offered = await useDatabase()
    .select({
      boutId: outcomes.boutId,
      question: outcomes.question,
      corner: outcomes.corner,
      method: outcomes.method,
      round: outcomes.round,
      multiplier: outcomes.multiplier,
    })
    .from(outcomes)
    .where(inArray(outcomes.boutId, boutIds));

  const offeredOn = new Map<string, OfferedAnswer[]>();

  for (const outcome of offered) {
    offeredOn.set(outcome.boutId, [...(offeredOn.get(outcome.boutId) ?? []), outcome]);
  }

  const priced: PlacedPrediction[] = [];

  for (const answer of answers) {
    const bout = onTheCard.get(answer.boutId);

    if (!bout) return refuse(409, ENTRY_MESSAGES.boutNotOnTheCard);
    if (bout.seasonId !== within.seasonId) return refuse(409, ENTRY_MESSAGES.notThisSeason);

    // Both halves of "not open": a Bout nobody has opened, and one whose Lock
    // has passed without anybody writing a row to say so. #12 makes the second
    // a status of its own, and `boutState` keeps answering the same way when
    // it does.
    const locksAt = lockMoment(
      bout.cardOrder,
      bout.firstOnTheCard,
      bout.scheduledStart.toISOString(),
    );

    if (boutState({ status: bout.status, locksAt }, within.now.getTime()) !== "open") {
      return refuse(409, ENTRY_MESSAGES.boutNotOpen);
    }

    // Priced by the same function the panel priced it with, from the Outcomes
    // Postgres holds rather than the ones the page was looking at. Null is an
    // answer this Bout does not offer — a round it is not scheduled for, or an
    // Outcome a re-import took away.
    const price = priceOf(answer, offeredOn.get(answer.boutId) ?? []);

    if (price === null) return refuse(422, ENTRY_MESSAGES.answerNotOffered);

    priced.push({ ...answer, cardOrder: bout.cardOrder, ...price });
  }

  return { predictions: priced };
}

/**
 * Writes an Entry, its Predictions and the Coins it commits, as one
 * transaction.
 *
 * The Coins leave the Balance here and not at settlement (ADR-0003), so that
 * what a fan is shown in the header is always what they can still commit —
 * and so that there is no moment in which an Entry exists whose Amount is
 * still spendable.
 *
 * The Balance is read under a lock and the Amount checked against it inside
 * the transaction. That is the only arrangement that answers two submissions
 * arriving together: see {@link balanceToCommitFrom}.
 *
 * Every refusal below is also a rule Postgres holds, and the second `catch` is
 * where those come back. A route that only asked first would be right until
 * two requests asked at once.
 */
export async function submitEntry(submission: {
  fanId: string;
  seasonId: string;
  amount: number;
  predictions: readonly PlacedPrediction[];
}): Promise<Submission> {
  const { fanId, seasonId, amount } = submission;

  try {
    return await useDatabase().transaction(async (tx) => {
      const held = await balanceToCommitFrom(tx, seasonId, fanId);

      if (amount > held) throw new Refused(422, ENTRY_MESSAGES.notEnoughCoins(held));

      const [entry] = await tx
        .insert(entries)
        .values({ seasonId, userId: fanId, amount })
        .returning({ id: entries.id, submittedAt: entries.submittedAt });

      if (!entry) throw new Error("Submitting an Entry wrote no row.");

      await tx.insert(predictions).values(
        submission.predictions.map((prediction) => ({
          entryId: entry.id,
          boutId: prediction.boutId,
          corner: prediction.corner,
          method: prediction.method,
          round: prediction.round,
          winnerMultiplier: prediction.winnerMultiplier,
          methodMultiplier: prediction.methodMultiplier,
          roundMultiplier: prediction.roundMultiplier,
        })),
      );

      await commitCoins(tx, {
        seasonId,
        userId: fanId,
        entryId: entry.id,
        amount,
        reason: COIN_REASONS.entryCommitted(submission.predictions.length),
      });

      const { multiplier, capped, reward } = potentialReward(amount, submission.predictions);

      return {
        entry: {
          id: entry.id,
          amount,
          multiplier,
          capped,
          reward,
          submittedAt: entry.submittedAt.toISOString(),
          predictions: submission.predictions.map((prediction) => ({
            boutId: prediction.boutId,
            cardOrder: prediction.cardOrder,
            corner: prediction.corner,
            method: prediction.method,
            round: prediction.round,
            multiplier: Number(predictionMultiplier(prediction).toFixed(MULTIPLIER.decimals)),
          })),
        },
        balance: held - amount,
      };
    });
  } catch (error) {
    if (error instanceof Refused) {
      return { refusal: { status: error.status, problem: error.problem } };
    }

    const refusal = await refusalBehind(error, submission);

    if (refusal) return { refusal };

    throw error;
  }
}

/**
 * The sentence behind a refusal from Postgres, or null for a failure that is
 * not one of this application's rules coming back.
 *
 * Every one of these is asked before the write as well, so reaching one means
 * something changed underneath: a Bout locked while the fan was confirming,
 * another submission spent the Coins first, or somebody wrote SQL by hand.
 */
async function refusalBehind(
  error: unknown,
  submission: { fanId: string; seasonId: string },
): Promise<EntryRefusal | null> {
  if (refusedByConstraint(error, PREDICTIONS_ARE_MADE_ON_OPEN_BOUTS)) {
    return { status: 409, problem: ENTRY_MESSAGES.boutNotOpen };
  }

  if (refusedByConstraint(error, COMMITMENTS_ARE_WITHIN_THE_BALANCE)) {
    // Read again rather than reported from the number this request checked
    // against: whatever spent the Coins has committed by now, and the Balance
    // to tell the fan about is the one they have left.
    return {
      status: 422,
      problem: ENTRY_MESSAGES.notEnoughCoins(
        await balanceOf(submission.seasonId, submission.fanId),
      ),
    };
  }

  if (refusedByConstraint(error, ONE_PREDICTION_PER_BOUT)) {
    return { status: 422, problem: ENTRY_MESSAGES.onePredictionPerBout };
  }

  if (refusedByConstraint(error, ENTRIES_HOLD_ONE_TO_TEN_PREDICTIONS)) {
    return { status: 422, problem: ENTRY_MESSAGES.tooManyPredictions };
  }

  // An answer whose Outcome is gone, or a Bout that is: a card re-imported
  // between the pricing above and this write, which is only possible while
  // every Bout on it is closed and therefore only for an Entry that was
  // already refused a moment ago for a better reason.
  if (ANSWERS_ARE_OFFERED.some((key) => refusedByConstraint(error, key))) {
    return { status: 409, problem: ENTRY_MESSAGES.answerNotOffered };
  }

  if (refusedByConstraint(error, PREDICTIONS_POINT_AT_A_BOUT)) {
    return { status: 409, problem: ENTRY_MESSAGES.boutNotOnTheCard };
  }

  return null;
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

function refuse(status: number, problem: string): PricedAnswers {
  return { refusal: { status, problem } };
}
