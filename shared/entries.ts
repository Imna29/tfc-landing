/**
 * The Entry a fan builds and commits Coins to: what a Prediction may be made
 * of, what the whole thing returns if every Prediction lands, and what the
 * game refuses to accept.
 *
 * Shared because both sides of the submission need every rule in it. The page
 * answers while a fan is still looking at the card — a second answer on one
 * Bout replaces the first, and the Reward moves as the Entry grows — and the
 * server asks the same questions again of what actually arrives, because a
 * rule enforced only where it is convenient is not enforced. The ones worth
 * asking a third time are on the `predictions` table in
 * `server/db/schema.ts`, where Postgres holds them.
 *
 * `shared/predictions.ts` is what the game adds to a *card*; this is what a fan
 * makes of it. The two are apart for the same reason the card and the game
 * are: a card is worth showing to somebody who is not playing.
 */
import { coinsLabel } from "./coins";
import type { BoutStatus, Corner } from "./events";
import { boutState } from "./predictions";
// Type-only, and so erased before anything runs: `shared/results.ts` reads the
// Prediction types from here, and this reads the one type it adds.
import type { BoutEnding } from "./results";
import {
  isMethod,
  isQuestion,
  isRound,
  MULTIPLIER,
  outcomeKey,
  type OutcomeAnswer,
} from "./pricing";

/**
 * How many Predictions one Entry holds.
 *
 * The floor is what an Entry is: a fan committing Coins to nothing has not
 * predicted anything. The ceiling is a bound on what a mispriced Outcome can
 * cost, not a rule about how a fan should play — ADR-0002 has no pool that
 * self-corrects a price nobody looked at, so the damage is bounded by the ten
 * links here and by {@link COMBINED_MULTIPLIER_CAP} rather than prevented.
 *
 * Spelled out again in the `entries_hold_one_to_ten_predictions` trigger.
 */
export const ENTRY_PREDICTIONS = { minimum: 1, maximum: 10 } as const;

/**
 * The smallest Amount an Entry can be submitted for.
 *
 * The maximum is the fan's whole Balance, which is not a constant — it is
 * whatever the ledger says they hold at the moment they press the button, and
 * only the database can answer it. Spelled out again in the
 * `entries_amount_is_committed` check constraint.
 */
export const AMOUNT = { minimum: 1 } as const;

/**
 * The most an Entry's combined Multiplier can reach.
 *
 * The other half of ADR-0002's bill. A Multiplier set by hand can be wrong,
 * and ten wrong ones multiplied together is a Reward nobody meant to offer, so
 * the chain stops paying more at ×100 however far it is taken. The cap is
 * shown to the fan the moment it starts deciding their Reward: a number that
 * quietly stopped growing would read as a game that had stopped working.
 *
 * **The cap is a rule of the game, not a term of the offer** (ADR-0013). An
 * Entry freezes what each of its answers paid (ADR-0002) and nothing else, so
 * the cap and the rounding are applied wherever a Reward is worked out —
 * here, in the panel a fan confirms in, and in the settlement that pays. There
 * is no capped number written onto an Entry for settlement to read back,
 * because settlement could not pay it in any case: a No Result contributes
 * ×1.0 (ADR-0005), and the Reward is worked out from the answers that survived.
 *
 * The consequence is worth saying plainly: **changing this number changes what
 * every unsettled Entry pays.** That is a decision to take between Seasons
 * rather than during one, and the reason it is a constant somebody edits in a
 * reviewed change rather than a setting somebody can type.
 */
export const COMBINED_MULTIPLIER_CAP = 100;

/**
 * Where an Entry is.
 *
 * Everything an Entry can become is somebody's ticket, and each of them widens
 * `entries_status_known` in a migration that somebody reads: #14 wrote the
 * `won` and `lost` a settled Entry ends at, #13 the `cancelled` a fan
 * withdraws to, and #15 the `refunded` an Entry of nothing but No Results is
 * made whole with. A status permitted before anything writes it is a status
 * nobody has thought about.
 *
 * Cancelled and Refunded both return the Amount in full and are not the same
 * thing: the first is the fan's decision, taken while every Bout in the Entry
 * was still open, and the second is the game's, because nothing in the Entry
 * turned out to be gradable (ADR-0005). Postgres holds them to that with one
 * rule between them, `entries_are_refunded_in_full`.
 *
 * Shared rather than kept in the schema for the reason `BoutStatus` is: this
 * is what `gradeEntry` in `shared/results.ts` answers with, and what the
 * profile history reads back. Spelled out again in the check constraint, for
 * the reason given on `Role` in `server/db/schema.ts`.
 */
export type EntryStatus = "open" | "won" | "lost" | "cancelled" | "refunded";

/**
 * The five, in the order a fan is offered them as a filter on their history.
 *
 * Open first because it is the one a fan is looking for while a card is being
 * fought, then the two a Bout decided, then the two that returned the Amount.
 */
export const ENTRY_STATUSES = [
  "open",
  "won",
  "lost",
  "cancelled",
  "refunded",
] as const satisfies readonly EntryStatus[];

/** What each status is called wherever a fan reads one of their Entries. */
export const ENTRY_STATUS_LABELS = {
  open: "Open",
  won: "Won",
  lost: "Lost",
  cancelled: "Cancelled",
  refunded: "Refunded",
} as const satisfies Record<EntryStatus, string>;

/** Whether this is one of the five places an Entry can be. */
export function isEntryStatus(value: unknown): value is EntryStatus {
  return ENTRY_STATUSES.includes(value as EntryStatus);
}

/**
 * One Prediction as it is submitted: the Bout, and the one answer given on it.
 *
 * An `OutcomeAnswer` and the Bout it was offered on, because a Prediction is a
 * copy of the Outcome a fan picked (ADR-0014) — the same Question, the same
 * corner, the same one answer among a method and a round, in the same three
 * columns. Nothing joining, grading or naming the two carries a translation
 * step, and `outcomeKey` tells one answer from another wherever either of them
 * is, the fighter it names included (ADR-0015).
 *
 * A Bout nobody has answered holds no Prediction at all, and is absent from
 * the Entry rather than present and empty. A fan who answers a second Question
 * on a Bout replaces what they said about it: an Entry holds one Prediction
 * per Bout, and {@link pickAnswered} is where that happens on the card.
 */
export interface PredictionAnswer extends OutcomeAnswer {
  boutId: string;
}

/**
 * A Prediction with what its answer pays copied onto it.
 *
 * One Multiplier, because there is one answer: every Multiplier stands for its
 * own answer outright and none of them multiply together within a Bout
 * (ADR-0014). ADR-0002 is why it is a value at all — an Outcome repriced
 * tomorrow never reaches an Entry submitted today.
 */
export interface PricedPrediction extends PredictionAnswer {
  multiplier: number;
}

/** A Prediction in the Entry being built, as the fan reads it back. */
export interface DraftPrediction extends PricedPrediction {
  /** Where the Bout sits on the card: 1 is fought first. */
  cardOrder: number;
  /** The two names the Bout is fought under, which name a winner answer. */
  corners: Record<Corner, string>;
}

/**
 * Where a Prediction's Bout stands, which is the whole of what an Entry can
 * still be taken back on.
 *
 * What a Prediction says was decided when it was submitted; only the Bout it
 * was made on moves afterwards. So this is what {@link cancellationOf} asks
 * for, and asking for no more than it is what lets the route ask the question
 * of four columns rather than of a whole listing.
 */
export interface PredictedBout {
  status: BoutStatus;
  /**
   * The moment this Bout locks by itself, whether or not a row says so yet.
   *
   * The Bout's own automatic Lock — the card's scheduled start for the Bout
   * fought first, the sweep behind it for every other (`automaticLock` in
   * `shared/locks.ts`). Deliberately not the `locksAt` a card shows a fan,
   * which is null on every Bout an admin advances: that one is a countdown
   * worth watching, and this one is a fact about when the Entry stops being
   * cancellable.
   */
  locksAt: string;
}

/**
 * One Prediction of an Entry a fan has submitted, as they read it back.
 *
 * Carries how its Bout ended, because a No Result has to say why it was one:
 * a Prediction that quietly counted for nothing reads as the game losing
 * track of it, and ADR-0005 costs a fan nothing only if they can see that it
 * did. It is what `settledPrice` in `shared/results.ts` reprices the answer
 * with, so the ×1.0 a No Result contributes is the number on the screen.
 *
 * This is not the graded history — that is `shared/history.ts`, which goes
 * back through every Season and says of each Prediction whether it landed.
 */
export interface CommittedPrediction extends DraftPrediction, PredictedBout {
  /** How its Bout ended, or null while that Bout has not settled. */
  ending: BoutEnding | null;
}

/**
 * An Entry a fan has submitted, as their own listing shows it back to them.
 *
 * Carries no combined Multiplier and no Reward, for the reason the `entries`
 * table carries neither: both are the product of what is on the Predictions,
 * and `potentialReward` below is where they are worked out (ADR-0013).
 */
export interface CommittedEntry {
  id: string;
  status: EntryStatus;
  amount: number;
  submittedAt: string;
  predictions: CommittedPrediction[];
}

/** The Entries a fan holds, as the listing beside the card reads them. */
export interface CommittedEntries {
  /**
   * The server's clock when it answered.
   *
   * A page that decides whether to offer cancelling has to decide it against
   * some instant, and the browser's own would render one answer on the server
   * and a different one a moment later in the browser. Same reason
   * `CardPredictions` carries one, and read by the same `useNow`.
   */
  answeredAt: string;
  /** Every Entry this fan holds this Season, newest first. */
  entries: CommittedEntry[];
}

/**
 * Whether an Entry can still be taken back, and the reason where it cannot.
 *
 * A union rather than a flag beside an always-present sentence, like every
 * other yes-or-why-not in this directory: "cancellable, and here is why not"
 * is not a state anything should have to read past.
 */
export type Cancellation =
  | { cancellable: true; reason?: undefined }
  | { cancellable: false; reason: string };

/** What an Entry returns if every Prediction in it lands. */
export interface PotentialReward {
  /** The combined Multiplier, after the cap and as a fan is shown it. */
  multiplier: number;
  /** Whether the cap is what decided that number. */
  capped: boolean;
  /** The Coins a winning Entry returns: the Amount at that Multiplier. */
  reward: number;
}

/**
 * The Prediction on a Bout after a fan answers one of its Questions.
 *
 * **Answering replaces whatever was there**, because an Entry holds one
 * Prediction per Bout (ADR-0014) and a fan who has just said "Tsiklauri by
 * Submission" has said what they think about that Bout. A control that
 * refused the second answer, or added it alongside the first, would be
 * offering a shape the Entry cannot hold.
 *
 * Answering the same thing twice takes it back, which is the only way to
 * unpick something — there is no separate clear control on the card, and a
 * fan who tapped the wrong fighter would otherwise be stuck with a Prediction
 * they have to submit to be rid of. The Bout then leaves the Entry, because a
 * Prediction with no answer on it is not one.
 */
export function pickAnswered(
  pick: OutcomeAnswer | null,
  answer: OutcomeAnswer,
): OutcomeAnswer | null {
  if (isAnswered(pick, answer)) return null;

  // The four fields of the answer and nothing else — the corner among them,
  // because it is part of which answer this is (ADR-0015). What the card hands
  // in is an `OfferedOutcome`, which carries the row's id and its Multiplier as
  // well; both are the card's business rather than the Entry's, and the Entry
  // is priced from the card it is being built on rather than from a number
  // that rode along on a click.
  const { question, corner, method, round } = answer;

  return { question, corner, method, round };
}

/** Whether this answer is the one the fan has already given on this Bout. */
export function isAnswered(pick: OutcomeAnswer | null, answer: OutcomeAnswer): boolean {
  return pick !== null && outcomeKey(pick) === outcomeKey(answer);
}

/** An answer a Bout is offering, and what it pays. */
export type OfferedAnswer = OutcomeAnswer & { multiplier: number };

/**
 * What this Bout pays for this answer, or null if it is not offering it.
 *
 * Null is a fan answering something the Bout does not ask — round 4 of a
 * three-round Bout, or an Outcome a re-import took away — and it is refused
 * rather than priced at anything. There is no third case now that a Prediction
 * is one answer: an answer is either on the card at a Multiplier or it is not
 * on the card.
 *
 * Said once for both sides of the submission: the panel prices the Entry a fan
 * is building from the card in front of them, and the server prices the same
 * answers again from the Outcomes in Postgres. Two implementations of this
 * would be two Rewards, and the fan would have been shown the wrong one.
 */
export function priceOf(answer: OutcomeAnswer, offered: readonly OfferedAnswer[]): number | null {
  const key = outcomeKey(answer);

  return offered.find((one) => outcomeKey(one) === key)?.multiplier ?? null;
}

/**
 * What an Entry returns if every Prediction in it lands.
 *
 * The Multiplier is rounded to the places a Multiplier is written to before
 * the Reward is worked out from it, so the number a fan was shown is the
 * number they are paid on. Doing it the other way round would pay a Reward
 * that no Multiplier on the page multiplies out to.
 *
 * An Entry with nothing answered on it multiplies out to ×1: the product of no
 * Predictions, which is what it is. Nothing shows that — a fan who has
 * answered nothing is shown no Reward — and it is the honest answer for the
 * moment between clearing an Entry and starting the next one.
 */
export function potentialReward(
  amount: number,
  predictions: readonly PricedPrediction[],
): PotentialReward {
  const combined = predictions.reduce((product, prediction) => product * prediction.multiplier, 1);

  const capped = combined > COMBINED_MULTIPLIER_CAP;
  const multiplier = capped
    ? COMBINED_MULTIPLIER_CAP
    : Number(combined.toFixed(MULTIPLIER.decimals));

  return { multiplier, capped, reward: Math.round(amount * multiplier) };
}

/**
 * Whether this Entry can still be cancelled, and what to tell the fan when it
 * cannot.
 *
 * **An Entry is cancellable only while every Bout in it is still open**, which
 * is the rule ADR-0002 makes necessary rather than a courtesy. Multipliers are
 * frozen at submission, so an Entry that could be withdrawn at any point would
 * let a fan wait for one to move, or fish for a pricing mistake and back out
 * of it — and "frozen at submission" would mean nothing.
 *
 * Asked of every Bout rather than of the earliest, because the Bouts of a
 * Chained Entry lock one at a time as the card is fought (ADR-0006): the
 * moment the first of them closes, part of what the Entry is riding on is
 * already being decided.
 *
 * Said once for both sides. The listing a fan reads shows the reason before
 * they press anything, and re-reads it as the clock passes each Lock moment;
 * the route asks the same question again of the rows in Postgres, because the
 * page is not what the server is holding.
 *
 * `now` is passed in for the reason it is everywhere else in this game: a Lock
 * that has fallen due but has no row yet is still a Lock, and the moment it is
 * judged against is the moment the request was answered.
 */
export function cancellationOf(
  entry: { status: EntryStatus; predictions: readonly PredictedBout[] },
  now: number,
): Cancellation {
  if (entry.status === "cancelled") return no(CANCELLATION_MESSAGES.alreadyCancelled);
  // Told apart from the two below it, because "graded against what happened"
  // is the one thing that did not happen to a Refunded Entry (ADR-0005).
  if (entry.status === "refunded") return no(CANCELLATION_MESSAGES.alreadyRefunded);
  if (entry.status !== "open") return no(CANCELLATION_MESSAGES.alreadyGraded);

  const closed = entry.predictions.some((prediction) => boutState(prediction, now) !== "open");

  return closed ? no(CANCELLATION_MESSAGES.boutLocked) : { cancellable: true };
}

function no(reason: string): Cancellation {
  return { cancellable: false, reason };
}

/** Everything cancelling an Entry says to the fan cancelling it. */
export const CANCELLATION_MESSAGES = {
  whileOpen:
    "An Entry can be cancelled while every Bout in it is still open, and its " +
    "Coins come back in full. Once one of them locks, the Entry rides on what " +
    "it says.",
  boutLocked:
    "A Bout in this Entry has locked, so it can no longer be cancelled. What " +
    "each answer pays is fixed when an Entry is submitted, and one that could " +
    "be taken back afterwards could be taken back knowing how a Bout was going.",
  alreadyCancelled:
    "This Entry has already been cancelled, and its Coins are back in your " +
    "Balance. Cancelling is not something that happens twice.",
  alreadyGraded:
    "This Entry has been graded against what happened, so there is nothing " +
    "left to cancel. How it went is on the Entry itself.",
  alreadyRefunded:
    "No Bout in this Entry produced a result to grade, so its Coins are " +
    "already back in your Balance in full. There is nothing left to take back.",
  notYours:
    "That is not one of your Entries. An Entry belongs to the fan who " +
    "submitted it, and only they can cancel it.",
  cancelled: (amount: number) =>
    `Entry cancelled. ${coinsLabel(amount)} returned to your Balance, which is ` +
    "the whole of what it committed.",
  noneYet:
    "You have not committed an Entry this Season yet. Answer a Bout on the " +
    "card above, and the Entries you commit are listed here.",
} as const;

/** Everything submitting an Entry says to the fan submitting it. */
export const ENTRY_MESSAGES = {
  signIn:
    "Sign in to commit Coins to an Entry. Reading the card and picking your " +
    "way through it needs no account; committing Coins to what you picked does.",
  emailUnverified:
    "Confirm your email address before your first Entry. The link is in the " +
    "message TFC sent when you signed up, and your account page will send " +
    "another one.",
  noSeasonOpen:
    "No Season is being played, so there are no Coins to commit. Every fan " +
    "starts the next one on the same hundred.",
  nothingPicked:
    "Answer at least one Bout to start an Entry. One answer on one Bout is a " +
    "whole Prediction, and chaining across Bouts is what multiplies what it " +
    "returns.",
  tooManyPredictions:
    `An Entry holds at most ${ENTRY_PREDICTIONS.maximum} Predictions. Take ` +
    "one out to answer another Bout, or commit this Entry and start a second.",
  onePredictionPerBout:
    "An Entry holds one Prediction per Bout, so answering a second Question " +
    "on a Bout replaces what you said about it. Chaining is across different " +
    "Bouts, and two views on one Bout are two Entries.",
  unreadable:
    "That Entry could not be read. Reload the card and pick your answers " +
    "again — nothing has been committed.",
  amount:
    `Commit a whole number of Coins, ${AMOUNT.minimum} or more. Coins are ` +
    "whole things: there is no fraction of one to commit or to be returned.",
  notEnoughCoins: (balance: number) =>
    `That is more Coins than you hold. Your Balance is ${coinsLabel(balance)}, ` +
    "and there are no top-ups inside a Season.",
  boutNotOpen:
    "One of those Bouts is not taking Predictions. A Bout takes them from the " +
    "moment TFC opens it until it locks, and a card moves on without the page " +
    "in front of you — reload it to see where that Bout is now.",
  notThisSeason:
    "One of those Bouts is not part of the Season being played. An Entry is " +
    "committed in one Season, and the Coins it moves are that Season's.",
  boutNotOnTheCard:
    "One of those Bouts is not in the game any more. Reload the card: it may " +
    "have been replaced by a lineup change since this page was opened.",
  answerNotOffered:
    "One of those answers is not offered on that Bout. Reload the card — a " +
    "three-round Bout has no round 4, and what an answer pays is set before " +
    "the Bout opens.",
  capped:
    `Chained this far, the combined Multiplier has reached its cap of ` +
    `×${COMBINED_MULTIPLIER_CAP}. Another Prediction lengthens the Entry ` +
    "without increasing what it returns.",
  accepted: (amount: number, reward: number) =>
    `Entry accepted. ${coinsLabel(amount)} committed, returning ` +
    `${coinsLabel(reward)} if every Prediction in it lands.`,
} as const;

/** An Entry ready to be priced and written, or the reason it is not. */
export type ParsedEntry =
  | { entry: { amount: number; predictions: PredictionAnswer[] }; problem?: undefined }
  | { entry?: undefined; problem: string };

/**
 * Reads the Entry a fan submitted.
 *
 * Only what the Entry says about itself is decided here: how many Predictions
 * it holds, that no two answer the same Bout, that each is one answer to one
 * Question the game asks, and that the Amount is a number of Coins. Whether
 * those Bouts are open, whether those answers are offered on them, and whether
 * the fan holds that many Coins are questions only the database can answer,
 * and they are asked before anything is written.
 *
 * An Entry is refused whole. There is no reading of a submission where nine of
 * ten Predictions are what the fan meant and the tenth is dropped.
 */
export function parseEntry(value: unknown): ParsedEntry {
  const sent = (value ?? {}) as { amount?: unknown; predictions?: unknown };

  if (!Array.isArray(sent.predictions) || sent.predictions.length < ENTRY_PREDICTIONS.minimum) {
    return { problem: ENTRY_MESSAGES.nothingPicked };
  }

  if (sent.predictions.length > ENTRY_PREDICTIONS.maximum) {
    return { problem: ENTRY_MESSAGES.tooManyPredictions };
  }

  if (!isAmount(sent.amount)) return { problem: ENTRY_MESSAGES.amount };

  const predictions: PredictionAnswer[] = [];
  const bouts = new Set<string>();

  for (const answered of sent.predictions) {
    const prediction = readPrediction(answered);

    if (prediction === null) return { problem: ENTRY_MESSAGES.unreadable };

    // ADR-0014's rule, and the one the `predictions_one_per_bout_in_an_entry`
    // index refuses regardless of what any route believed. On the card a
    // second answer replaces the first ({@link pickAnswered}), so an Entry
    // arriving with two on one Bout was not built on the card.
    if (bouts.has(prediction.boutId)) return { problem: ENTRY_MESSAGES.onePredictionPerBout };

    bouts.add(prediction.boutId);
    predictions.push(prediction);
  }

  return { entry: { amount: sent.amount, predictions } };
}

/**
 * One answered Bout as it arrives, or null if it is not one.
 *
 * **A corner always, plus exactly one of a method and a round, and it is the
 * one its Question names.** Every answer is about a fighter (ADR-0015), so a
 * Prediction naming a method and no corner is not an answer the card ever
 * offered — and one carrying a method and a round at once is refused here
 * rather than resolved, because nothing downstream could say which of them the
 * fan gave. `predictions_answers_its_question` refuses the same row
 * underneath, the way `outcomes_answers_its_question` refuses it of the
 * Outcome this is a copy of.
 */
function readPrediction(value: unknown): PredictionAnswer | null {
  const answered = (value ?? {}) as Record<string, unknown>;
  const { boutId, question, corner = null, method = null, round = null } = answered;

  if (typeof boutId !== "string" || boutId === "") return null;
  if (!isQuestion(question)) return null;
  if (corner !== "red" && corner !== "blue") return null;

  if (question === "winner") {
    if (method !== null || round !== null) return null;

    return { boutId, question, corner, method: null, round: null };
  }

  if (question === "method") {
    if (!isMethod(method)) return null;
    if (round !== null) return null;

    return { boutId, question, corner, method, round: null };
  }

  if (!isRound(round)) return null;
  if (method !== null) return null;

  return { boutId, question, corner, method: null, round };
}

/** Whether this is a number of Coins that can be committed. */
function isAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= AMOUNT.minimum;
}
