/**
 * The Entry a fan builds and commits Coins to: what a Prediction may be made
 * of, what the whole thing returns if every Prediction lands, and what the
 * game refuses to accept.
 *
 * Shared because both sides of the submission need every rule in it. The page
 * answers while a fan is still looking at the card — a round that cannot be
 * chosen is never offered, and the Reward moves as the Entry grows — and the
 * server asks the same questions again of what actually arrives, because a
 * rule enforced only where it is convenient is not enforced. The ones worth
 * asking a third time are in `0007_entries_and_predictions.sql`, where
 * Postgres holds them.
 *
 * `shared/predictions.ts` is what the game adds to a *card*; this is what a fan
 * makes of it. The two are apart for the same reason the card and the game
 * are: a card is worth showing to somebody who is not playing.
 */
import { coinsLabel } from "./coins";
import type { Corner } from "./events";
import {
  isMethod,
  isRound,
  METHOD_LABELS,
  MULTIPLIER,
  outcomeKey,
  type Method,
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
 * `won` and `lost` a settled Entry ends at, #13 adds the `cancelled` a fan
 * withdraws to, and #15 the `refunded` an Entry of nothing but No Results is
 * made whole with. A status permitted before anything writes it is a status
 * nobody has thought about.
 *
 * Shared rather than kept in the schema for the reason `BoutStatus` is: this
 * is what `gradeEntry` in `shared/results.ts` answers with, and what the
 * profile history reads back. Spelled out again in the check constraint, for
 * the reason given on `Role` in `server/db/schema.ts`.
 */
export type EntryStatus = "open" | "won" | "lost";

/**
 * A fan's answer to one Bout, as they are building it.
 *
 * The winner is what a Prediction is made of, and the reason this type has no
 * "no winner yet" state: a Bout nobody has picked a winner on holds no
 * Prediction at all, and is absent from the Entry rather than present and
 * empty. Method and round deepen that answer (ADR-0004), which is why they
 * hang off it rather than standing beside it.
 */
export interface BoutPick {
  corner: Corner;
  method: Method | null;
  round: number | null;
}

/** One Prediction as it is submitted: the Bout, and the answer given for it. */
export interface PredictionAnswer extends BoutPick {
  boutId: string;
}

/**
 * A Prediction with what each of its answers pays copied onto it.
 *
 * Three Multipliers rather than the one they multiply out to, because they are
 * graded separately: a disqualification settles the winner and leaves the
 * method and the round with nothing to grade (#15), and a Prediction holding
 * only the product could not be paid what its winner was worth. ADR-0002 is
 * why they are values at all — an Outcome repriced tomorrow never reaches an
 * Entry submitted today.
 */
export interface PricedPrediction extends PredictionAnswer {
  winnerMultiplier: number;
  /** What the method pays, or null on a Prediction that names no method. */
  methodMultiplier: number | null;
  /** What the round pays, or null on a Prediction that names no round. */
  roundMultiplier: number | null;
}

/** A Prediction in the Entry being built, as the fan reads it back. */
export interface DraftPrediction extends PricedPrediction {
  /** Where the Bout sits on the card: 1 is fought first. */
  cardOrder: number;
  /** The two names the Bout is fought under, which name the winner. */
  corners: Record<Corner, string>;
}

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
 * Whether a Bout ending this way ends inside a round.
 *
 * The distinction ADR-0004 turns on: a KO/TKO and a Submission happen in a
 * round somebody can name, and a Decision is the Bout going the distance.
 */
export function isFinish(method: Method | null): boolean {
  return method === "ko_tko" || method === "submission";
}

/**
 * The Prediction on a Bout after a fan answers one of its Questions.
 *
 * Answering the same thing twice takes it back, which is the only way to
 * unpick something — there is no separate clear control on the card, and a
 * fan who tapped the wrong fighter would otherwise be stuck with a Prediction
 * they have to submit to be rid of. Unpicking the winner answers `null`: the
 * Bout leaves the Entry, because a Prediction without a winner is not one.
 *
 * A Decision drops a round that was already chosen rather than refusing the
 * click. The alternative is a fan looking at a control that does nothing, with
 * the reason a screen away.
 */
export function pickAnswered(pick: BoutPick | null, answer: OutcomeAnswer): BoutPick | null {
  if (answer.question === "winner") {
    if (answer.corner === null) return pick;
    if (pick === null) return { corner: answer.corner, method: null, round: null };

    // Changing their mind about who wins keeps the read on how it ends: the
    // method and round are priced conditionally on the winner (ADR-0004), so
    // "by KO/TKO in round 2" means the same thing about either fighter.
    return pick.corner === answer.corner ? null : { ...pick, corner: answer.corner };
  }

  if (!canAnswer(pick, answer) || pick === null) return pick;

  if (answer.question === "method") {
    const method = pick.method === answer.method ? null : answer.method;

    // The round goes with the method it was chosen alongside, whether that is
    // a Decision arriving or the finish it belonged to being taken back.
    return { ...pick, method, round: isFinish(method) ? pick.round : null };
  }

  return { ...pick, round: pick.round === answer.round ? null : answer.round };
}

/**
 * Whether this answer can be given on this Bout yet.
 *
 * What it is not is whether the Bout is open — that is `boutState` in
 * `shared/predictions.ts`, and it is asked of the whole Bout rather than of
 * each answer on it.
 */
export function canAnswer(pick: BoutPick | null, answer: OutcomeAnswer): boolean {
  if (answer.question === "winner") return true;
  if (pick === null) return false;

  return answer.question === "method" || isFinish(pick.method);
}

/** Whether this answer is one the fan has already given on this Bout. */
export function isAnswered(pick: BoutPick | null, answer: OutcomeAnswer): boolean {
  if (pick === null) return false;
  if (answer.question === "winner") return pick.corner === answer.corner;
  if (answer.question === "method") return pick.method === answer.method;

  return pick.round === answer.round;
}

/** An answer a Bout is offering, and what it pays. */
export type OfferedAnswer = OutcomeAnswer & { multiplier: number };

/** What each answer of a Prediction pays, as its Bout is offering them. */
export type Price = Pick<
  PricedPrediction,
  "winnerMultiplier" | "methodMultiplier" | "roundMultiplier"
>;

/**
 * What a Bout is offering on one Prediction, or null if it is not offering all
 * of it.
 *
 * Null is a fan answering something the Bout does not ask — round 4 of a
 * three-round Bout, or an Outcome a re-import took away — and it is refused
 * rather than priced at anything. Undefined and null are told apart carefully
 * here: an answer nobody gave has no Multiplier because there is nothing to
 * pay for, and an answer nobody offered has none because it was never on the
 * card.
 *
 * Said once for both sides of the submission: the panel prices the Entry a fan
 * is building from the card in front of them, and the server prices the same
 * answers again from the Outcomes in Postgres. Two implementations of this
 * would be two Rewards, and the fan would have been shown the wrong one.
 */
export function priceOf(pick: BoutPick, offered: readonly OfferedAnswer[]): Price | null {
  const pays = (answer: OutcomeAnswer) =>
    offered.find((one) => outcomeKey(one) === outcomeKey(answer))?.multiplier;

  const winnerMultiplier = pays({
    question: "winner",
    corner: pick.corner,
    method: null,
    round: null,
  });

  const methodMultiplier =
    pick.method === null
      ? null
      : pays({ question: "method", corner: null, method: pick.method, round: null });

  const roundMultiplier =
    pick.round === null
      ? null
      : pays({ question: "round", corner: null, method: null, round: pick.round });

  if (
    winnerMultiplier === undefined ||
    methodMultiplier === undefined ||
    roundMultiplier === undefined
  ) {
    return null;
  }

  return { winnerMultiplier, methodMultiplier, roundMultiplier };
}

/**
 * What one Prediction pays: the product of the answers it is made of.
 *
 * ADR-0004 is why this is a product rather than a chain of its own — the
 * method and round Multipliers are priced knowing they are multiplied onto a
 * winner pick, so "Submission at ×3.2" means ×3.2 given that the chosen
 * fighter wins.
 */
export function predictionMultiplier(prediction: PricedPrediction): number {
  return (
    prediction.winnerMultiplier *
    (prediction.methodMultiplier ?? 1) *
    (prediction.roundMultiplier ?? 1)
  );
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
  const combined = predictions.reduce(
    (product, prediction) => product * predictionMultiplier(prediction),
    1,
  );

  const capped = combined > COMBINED_MULTIPLIER_CAP;
  const multiplier = capped
    ? COMBINED_MULTIPLIER_CAP
    : Number(combined.toFixed(MULTIPLIER.decimals));

  return { multiplier, capped, reward: Math.round(amount * multiplier) };
}

/**
 * One Prediction as a sentence: "Levan Beridze by KO/TKO in round 2".
 *
 * Said once, for the panel a fan confirms an Entry in and the history that
 * lists it afterwards, so that the Prediction they committed to and the
 * Prediction they are shown later cannot come to be worded differently.
 */
export function predictionLabel(pick: BoutPick, corners: Record<Corner, string>): string {
  const winner = corners[pick.corner];
  const method = pick.method === null ? "" : ` by ${METHOD_LABELS[pick.method]}`;
  const round = pick.round === null ? "" : ` in round ${pick.round}`;

  return `${winner}${method}${round}`;
}

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
    "Pick a winner on at least one Bout to start an Entry. A method and a " +
    "round are optional, and each one you add multiplies what it returns.",
  pickAWinnerFirst:
    "Pick a winner on this Bout first. A method and a round deepen that pick " +
    "rather than standing beside it, so they multiply onto it.",
  tooManyPredictions:
    `An Entry holds at most ${ENTRY_PREDICTIONS.maximum} Predictions. Deepen ` +
    "the ones already in it with a method and a round rather than chaining " +
    "another Bout onto the end.",
  onePredictionPerBout:
    "An Entry holds one Prediction per Bout. Deepen the one you have on that " +
    "Bout with a method and a round; chaining is across different Bouts.",
  roundNeedsAFinish:
    "A round of victory goes with a KO/TKO or a Submission. A Decision is the " +
    "Bout going the distance, so there is no round it ends in.",
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
 * it holds, that no two answer the same Bout, that each answer is one the game
 * asks for, and that the Amount is a number of Coins. Whether those Bouts are
 * open, whether those answers are offered on them, and whether the fan holds
 * that many Coins are questions only the database can answer, and they are
 * asked before anything is written.
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

    // Not the same rule as the round check inside `readPrediction`: this one
    // is ADR-0004's, and it is the one the `predictions_one_per_bout_in_an_entry`
    // index refuses regardless of what any route believed.
    if (bouts.has(prediction.boutId)) return { problem: ENTRY_MESSAGES.onePredictionPerBout };

    // A round names a moment inside the Bout, so it only means anything
    // alongside a finish. Said here as well as on the card, because the card
    // is not what the server is holding.
    if (prediction.round !== null && !isFinish(prediction.method)) {
      return { problem: ENTRY_MESSAGES.roundNeedsAFinish };
    }

    bouts.add(prediction.boutId);
    predictions.push(prediction);
  }

  return { entry: { amount: sent.amount, predictions } };
}

/** One answered Bout as it arrives, or null if it is not one. */
function readPrediction(value: unknown): PredictionAnswer | null {
  const answered = (value ?? {}) as Record<string, unknown>;
  const { boutId, corner, method = null, round = null } = answered;

  if (typeof boutId !== "string" || boutId === "") return null;
  if (corner !== "red" && corner !== "blue") return null;
  if (method !== null && !isMethod(method)) return null;
  if (round !== null && !isRound(round)) return null;

  return { boutId, corner, method, round };
}

/** Whether this is a number of Coins that can be committed. */
function isAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= AMOUNT.minimum;
}
