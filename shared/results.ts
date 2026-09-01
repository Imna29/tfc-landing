/**
 * What happened in a Bout, and what it does to the Predictions made on it.
 *
 * The whole of settlement's deciding, with nothing about Postgres in it.
 * `server/utils/results.ts` reads the rows, writes the Coins and holds the
 * transaction together; every question about *meaning* — did this Prediction
 * land, has this Entry won or lost yet, what is it worth now — is asked here,
 * once, of how the Bout ended and the answers the fan gave.
 *
 * Shared for the reason `shared/entries.ts` is: the admin area records what
 * happened with these words and refuses it with these sentences, the fan's own
 * listing grades a Prediction with these functions rather than a second copy of
 * them, and `test/unit/vocabulary.test.ts` holds all of it to `CONTEXT.md` at
 * once.
 *
 * Nothing here is written down. A Prediction's grade is worked out from how its
 * Bout ended wherever it is shown, never stored beside it — for the reason
 * ADR-0013 gives about the combined Multiplier, and ADR-0003 about a Balance: a
 * copy of an answer the data already holds is a second answer, and something
 * has to decide which of them is right the day they differ.
 */
import { coinsLabel } from "./coins";
import {
  potentialReward,
  predictionMultiplier,
  type BoutPick,
  type EntryStatus,
  type PotentialReward,
  type PricedPrediction,
} from "./entries";
import type { Corner } from "./events";
import { multiplierLabel } from "./predictions";
import { isMethod, isRound, METHODS, METHOD_LABELS, type Method } from "./pricing";

/**
 * The four ways a Bout produces nothing gradable: it was cancelled, a fighter
 * withdrew, it was a draw, or it was ruled a no contest.
 *
 * ADR-0005 is why these are one thing rather than four. Whatever the reason,
 * the Prediction on the Bout contributes a Multiplier of ×1.0 and the rest of
 * the Chained Entry plays on — treating any of them as a loss would punish
 * fans for something no prediction could anticipate, and a withdrawn fighter
 * would silently kill every Chained Entry containing them.
 *
 * Which of the four it was is recorded and shown all the same. A fan who is
 * told their Prediction counted for nothing, and not why, is reading an
 * outcome that looks arbitrary.
 *
 * Spelled out again in the `bout_results_no_result_known` check constraint,
 * for the reason given on `Role` in `server/db/schema.ts`.
 */
export type NoResultReason = "cancelled" | "withdrawal" | "draw" | "no_contest";

/** The four reasons, in the order an admin is offered them. */
export const NO_RESULT_REASONS = [
  "cancelled",
  "withdrawal",
  "draw",
  "no_contest",
] as const satisfies readonly NoResultReason[];

/**
 * What each reason is called wherever one is shown.
 *
 * Written as what happened to the Bout rather than as a bare noun, because
 * these are read in two places that both need the subject: an admin choosing
 * between them in a list, and a fan reading one beside the Prediction it
 * decided.
 */
export const NO_RESULT_LABELS = {
  cancelled: "Bout cancelled",
  withdrawal: "Fighter withdrew",
  draw: "Draw",
  no_contest: "No contest",
} as const satisfies Record<NoResultReason, string>;

/**
 * What a No Result contributes: ×1.0, which multiplies nothing away.
 *
 * ADR-0005's number, named because it is said in three places — the Multipliers
 * {@link settledPrice} answers, the sentence {@link endingNote} writes, and the
 * Amount an Entry of nothing but No Results comes back at.
 */
const NEUTRAL = 1;

/** Whether this is one of the four ways a Bout produces nothing gradable. */
export function isNoResultReason(value: unknown): value is NoResultReason {
  return NO_RESULT_REASONS.includes(value as NoResultReason);
}

/**
 * How a Bout ended, where it ended with a winner: one of the three methods the
 * game offers, or the disqualification it does not.
 *
 * Deliberately not {@link Method}, and deliberately wider than it. ADR-0005
 * settles a DQ's **winner** Question normally, because the DQ winner did win,
 * while the method and round Questions become No Results — "won by DQ" is not
 * one of the three answers any fan was offered, so no fan can have got it
 * wrong. Keeping the two types apart is what stops that fourth value reaching
 * an Outcome or a Prediction, where it would be an answer nobody was ever
 * shown.
 *
 * Spelled out again in `bout_results_method_known`, which is one value wider
 * than `outcomes_method_known` and `predictions_method_known` for exactly this
 * reason.
 */
export type RecordedMethod = Method | "disqualification";

/** The ways a Bout ends with a winner, in the order an admin is offered them. */
export const RECORDED_METHODS = [
  ...METHODS,
  "disqualification",
] as const satisfies readonly RecordedMethod[];

/** What each of them is called wherever one is shown. */
export const RECORDED_METHOD_LABELS = {
  ...METHOD_LABELS,
  disqualification: "Disqualification",
} as const satisfies Record<RecordedMethod, string>;

/**
 * What an admin records about a Bout that has been fought to a winner: who won,
 * how it ended, and — where it ended inside one — which round.
 *
 * The same three answers a Prediction is made of, which is what makes grading
 * a comparison rather than an interpretation. `winner` rather than `corner`,
 * because that is the Question it answers (`CONTEXT.md`) and because a Result
 * is a statement about the Bout rather than a pick somebody made.
 *
 * A Bout that produced nothing gradable is a No Result and is not one of these
 * (ADR-0005). See {@link BoutEnding}, which is what anything grading against a
 * Bout is handed.
 */
export interface BoutResult {
  winner: Corner;
  method: RecordedMethod;
  /** The round it ended in, or null where it did not end inside one. */
  round: number | null;
}

/**
 * How a Bout ended: the Result it produced, or the No Result it produced
 * instead.
 *
 * One type rather than two nullable fields beside each other, because they are
 * the two halves of one question and nothing sensible reads as both. It is
 * deliberately not called an outcome: `CONTEXT.md` keeps that word for an
 * answer the game *offered*, and this is what actually happened.
 *
 * A union rather than a `kind` discriminator for the reason every other
 * yes-or-why-not in this directory is one: `ending.noResult` is the whole test,
 * and the Result is right there in the branch where there is one.
 */
export type BoutEnding =
  | { result: BoutResult; noResult?: undefined }
  | { result?: undefined; noResult: NoResultReason };

/**
 * Where one Prediction stands.
 *
 * `unresolved` is the Bout not having settled yet, which is what `CONTEXT.md`
 * calls an Entry Open for. It is a value rather than a `null` because it is a
 * state a fan is shown — a Chained Entry part-way through a card reads as two
 * landed, one to come.
 *
 * `no result` is the fourth, and it is neither a win nor a loss: the Prediction
 * contributes ×1.0 and the Entry around it plays on (ADR-0005). It is also
 * what a fan is shown beside the answer it decided, so that a Prediction that
 * counted for nothing says why.
 */
export type PredictionGrade = "correct" | "wrong" | "no result" | "unresolved";

/**
 * What each grade is called where a fan reads one, which is beside the answer
 * they gave in their Entry history.
 *
 * Won and Lost rather than "correct" and "wrong", because a fan reading a
 * chain is reading it against the Entry above it, and one word for the
 * Prediction and another for the Entry would make that comparison work they
 * have to do in their head. `unresolved` is written as the waiting it is: the
 * Bout has not been fought, and nothing about the answer is decided yet.
 */
export const PREDICTION_GRADE_LABELS = {
  correct: "Won",
  wrong: "Lost",
  "no result": "No Result",
  unresolved: "Still open",
} as const satisfies Record<PredictionGrade, string>;

/**
 * Whether this Prediction landed.
 *
 * Every answer the fan gave has to be right, and every answer they did not
 * give is not asked about: a winner-only Prediction on a Bout that went to a
 * Decision is correct, because ADR-0004 makes a method and a round a
 * *deepening* of the winner pick rather than three predictions standing beside
 * one another. That is also why a wrong winner ends it — the method was priced
 * knowing it multiplies onto that fighter winning.
 *
 * The two ADR-0005 cases are the ones worth reading closely. A Bout that
 * produced nothing gradable grades every Prediction on it a No Result,
 * whatever anybody answered — there is nothing to have been right or wrong
 * about. A disqualification grades the winner and stops: the method and the
 * round the fan may have named are No Results of their own, so naming one
 * cannot lose them the Entry.
 */
export function gradePrediction(pick: BoutPick, ending: BoutEnding | null): PredictionGrade {
  if (ending === null) return "unresolved";
  if (ending.noResult) return "no result";

  const result = ending.result;

  if (pick.corner !== result.winner) return "wrong";

  // The DQ winner did win, and that is the whole of what this Bout settled.
  if (result.method === "disqualification") return "correct";

  if (pick.method !== null && pick.method !== result.method) return "wrong";
  if (pick.round !== null && pick.round !== result.round) return "wrong";

  return "correct";
}

/** One Prediction of an Entry, beside how the Bout it answered ended. */
export interface GradedPrediction {
  prediction: BoutPick;
  /** How its Bout ended, or null while that Bout has not settled. */
  ending: BoutEnding | null;
}

/**
 * Where an Entry stands once everything known so far is applied to it.
 *
 * **Lost the instant any Prediction in it fails**, without waiting for its
 * remaining Bouts. That is the fail-fast rule the spec asks for, and the order
 * of the checks below is the whole of it: a chain with one missed Prediction
 * and three Bouts still to come is not Open, and showing it as Open would tell
 * a fan their Entry is alive when they can see on the screen that it is not —
 * and would count them among the fans still in contention on the leaderboard.
 *
 * An Entry has Won only once every Bout in it has settled. Nothing pays before
 * then, because there is nothing to pay: a Reward is the Amount at the
 * combined Multiplier of the whole chain.
 *
 * **Refunded is an Entry with nothing gradable left in it**: every Prediction
 * was a No Result, so there is no Prediction that could have won or lost and
 * the Amount comes back in full (ADR-0005). It is checked last because it is
 * the narrowest of the four — one landed Prediction beside a No Result is a
 * chain that won, at the Multiplier the Prediction that landed was priced at.
 */
export function gradeEntry(graded: readonly GradedPrediction[]): EntryStatus {
  const grades = graded.map((one) => gradePrediction(one.prediction, one.ending));

  if (grades.includes("wrong")) return "lost";
  if (grades.includes("unresolved")) return "open";
  if (grades.every((grade) => grade === "no result")) return "refunded";

  return "won";
}

/**
 * What each answer of a Prediction ends up paying, now its Bout is decided.
 *
 * ADR-0005 as arithmetic. A No Result contributes ×1.0, which is the winner at
 * ×1 and no method or round beside it; a disqualification leaves the winner at
 * what it was priced and drops the method and round, which were never asked
 * about. Everything else pays exactly what ADR-0002 froze onto it.
 *
 * Answers the Multipliers rather than the number they multiply out to, so that
 * a settled Entry is priced by `potentialReward` — the same function that
 * priced the panel the fan confirmed in, cap and rounding included (ADR-0013).
 *
 * A Prediction whose Bout has not settled is left at what it was priced. That
 * is what "returns this if every Prediction lands" means while a card is still
 * being fought, and it is never what anything is paid on: nothing pays until
 * every Bout in the Entry has settled.
 */
export function settledPrice(
  prediction: PricedPrediction,
  ending: BoutEnding | null,
): PricedPrediction {
  if (ending === null) return prediction;

  if (ending.noResult) {
    return {
      ...prediction,
      winnerMultiplier: NEUTRAL,
      methodMultiplier: null,
      roundMultiplier: null,
    };
  }

  if (ending.result.method !== "disqualification") return prediction;

  return { ...prediction, methodMultiplier: null, roundMultiplier: null };
}

/** A Prediction beside how the Bout it answered ended. */
export interface AnsweredBout extends PricedPrediction {
  /** How its Bout ended, or null while that Bout has not settled. */
  ending: BoutEnding | null;
}

/** What an Entry and each answer in it are worth against what happened. */
export interface EntryAsItStands {
  /** What each Prediction pays now, in the order they were given. */
  multipliers: number[];
  /** The combined Multiplier after the ×100 cap, and the Coins at it. */
  returns: PotentialReward;
}

/**
 * What an Entry is worth now its Bouts have started being decided.
 *
 * {@link settledPrice} over every answer and `potentialReward` over the chain
 * they make, which is the whole of the arithmetic settlement pays on
 * (`rewardFor` in `server/utils/results.ts` is these two functions in the same
 * order).
 *
 * **Said once because a fan can have it on the screen twice.** The listing
 * beside the card and the Entry history on the profile both show what a chain
 * is worth, and two copies of these four lines would be two Rewards for one
 * Entry on two pages — the same failure `priceOf` is shared to prevent at the
 * other end of an Entry's life.
 *
 * A Prediction whose Bout has not settled is left at what it was priced, which
 * is what "returns this if every Prediction lands" means while a card is still
 * being fought. On a chain that is already Lost the same number reads as the
 * counterfactual it is — what it was going for, priced against what happened —
 * and `HISTORY_MESSAGES.lost` is where it is said in those words, because a
 * Multiplier standing on its own beside "No Reward" invites the wrong reading.
 */
export function entryAsItStands(entry: {
  amount: number;
  predictions: readonly AnsweredBout[];
}): EntryAsItStands {
  const settled = entry.predictions.map((prediction) =>
    settledPrice(prediction, prediction.ending),
  );

  return {
    multipliers: settled.map(predictionMultiplier),
    returns: potentialReward(entry.amount, settled),
  };
}

/**
 * One Result as a sentence: "Levan Beridze by KO/TKO in round 2".
 *
 * The same sentence `predictionLabel` in `shared/entries.ts` writes a
 * Prediction as, and deliberately so: an admin checking a Result against the
 * card, and a fan reading how close they were, are comparing two of these, and
 * two wordings would make that comparison work they have to do in their head.
 */
export function resultLabel(result: BoutResult, corners: Record<Corner, string>): string {
  const round = result.round === null ? "" : ` in round ${result.round}`;

  return `${corners[result.winner]} by ${RECORDED_METHOD_LABELS[result.method]}${round}`;
}

/**
 * A No Result as a sentence: that it was one, and why.
 *
 * Always both halves. It is the difference between a fan reading "this Bout
 * decided nothing" — which sounds like the game losing track — and reading
 * that a fighter withdrew, which is a thing that happened.
 *
 * Said once for the admin reading a settled Bout back and the fan reading the
 * Prediction it decided, the way `resultLabel` is: two wordings would be two
 * accounts of the same Bout.
 */
export function noResultLabel(reason: NoResultReason): string {
  return `No Result — ${NO_RESULT_LABELS[reason]}`;
}

/** How a Bout ended, as one sentence, either way it ended. */
export function boutEndingLabel(ending: BoutEnding, corners: Record<Corner, string>): string {
  if (ending.noResult) return noResultLabel(ending.noResult);

  return resultLabel(ending.result, corners);
}

/**
 * One correction of a Bout's Result, as the admin area shows it: what the Bout
 * used to be recorded as having produced, and who replaced it when.
 *
 * The answer to the question a corrected result raises and nothing else can
 * settle — "what was my Entry graded against before?" — which is why it is
 * shown beside the fight rather than kept for a query somebody would have to
 * know to run. The row behind it holds more (who entered the statement being
 * replaced, and when they entered it); this is the half that is read on a
 * screen.
 */
export interface ResultCorrection {
  /** What the Bout was recorded as having produced, until this correction. */
  ending: BoutEnding;
  /** When it was corrected. */
  at: string;
  /** The username of the admin who corrected it. */
  by: string;
}

/**
 * Whether these two are the same account of one Bout.
 *
 * Asked of a correction before anything is written, so that an admin who
 * re-entered what was already there is told so rather than being handed a
 * correction that reversed nothing, re-paid the identical Rewards and left a
 * row in the audit log saying a Result was replaced with itself. Every answer
 * has to match, the null ones included: a Decision has no round and a No
 * Result has no winner, and "unanswered" is as much a part of what was
 * recorded as the answers are.
 */
export function isTheSameEnding(one: BoutEnding, other: BoutEnding): boolean {
  if (one.noResult || other.noResult) return one.noResult === other.noResult;

  return (
    one.result.winner === other.result.winner &&
    one.result.method === other.result.method &&
    one.result.round === other.result.round
  );
}

/**
 * What how this Bout ended did to the answers this fan gave, where that needs
 * saying — and null where it does not.
 *
 * The sentence ADR-0005 is unreadable without. A Multiplier that quietly
 * dropped to ×1.0 is the game appearing to take something away, and a fan who
 * cannot see why is reading an outcome that looks arbitrary — which is as true
 * of the disqualification that neutralised two of their three answers as it is
 * of the Bout that was cancelled outright.
 *
 * Null on everything that needs no explaining: a Bout that has not settled, a
 * Bout that produced an ordinary Result, and the disqualification a fan
 * answered with a winner and nothing else — that Prediction was graded on the
 * one Question it asked, and pays what it was priced at.
 */
export function endingNote(pick: BoutPick, ending: BoutEnding | null): string | null {
  if (ending === null) return null;

  if (ending.noResult) {
    return (
      `${noResultLabel(ending.noResult)}. Nothing about this Bout could be ` +
      `graded, so this Prediction counts as ${multiplierLabel(NEUTRAL)} and ` +
      "the rest of the Entry plays on."
    );
  }

  if (ending.result.method !== "disqualification") return null;
  if (pick.method === null && pick.round === null) return null;

  return (
    "Won by disqualification, which is not one of the three methods this Bout " +
    `offered. The winner picked still stands; the method and the round count ` +
    `as ${multiplierLabel(NEUTRAL)} each.`
  );
}

/**
 * What entering a Result did, as the admin who entered it is told.
 *
 * Counted rather than listed. An admin entering the result of a main event
 * needs to know that it landed and roughly how big it was; who won what is the
 * fans' own history (`shared/history.ts`), and a list of five hundred
 * usernames on a phone at cageside is not an answer to anything.
 *
 * Here rather than in `server/utils/results.ts` because it is what the sentence
 * below is written from, and the admin page reads both.
 */
export interface Settlement {
  /** Entries holding a Prediction on this Bout that were still Open. */
  graded: number;
  /** Of those, the ones this ending finished: every Prediction landed. */
  won: number;
  /** Of those, the ones it ended, Bouts still to come or not. */
  lost: number;
  /** Of those, the ones left with nothing gradable at all (ADR-0005). */
  refunded: number;
  /** Of those, the ones still alive: correct so far, with Bouts left. */
  stillOpen: number;
  /** The Coins the Rewards returned. */
  paid: number;
  /** The Coins the refunds returned, which is those Entries' Amounts in full. */
  returned: number;
}

/**
 * What correcting a Result did, as the admin who corrected it is told.
 *
 * A {@link Settlement} read one moment later, and every field of it means what
 * it meant with one word changed: this is where the Entries riding on the Bout
 * stand *now*, rather than where this ending put them. `graded` is every Entry
 * the correction looked at, which is every Entry on the Bout that was not
 * cancelled — not only the ones it moved, because "nothing changed for the
 * other four hundred" is the reassuring half of the answer.
 *
 * `paid` and `returned` are the Coins that went out on this grading, and
 * {@link Correction.reversed} is what came back off the last one. They are
 * separate numbers rather than one net figure, because a net figure would let
 * a correction that reversed eight hundred Coins and paid eight hundred read
 * as a correction that did nothing.
 */
export interface Correction extends Settlement {
  /**
   * The Coins the reversals took back, as a positive number: what the mistake
   * had paid out and has now been undone.
   */
  reversed: number;
}

/**
 * What a grading moved, as the second half of the sentences below.
 *
 * One sentence for both, because a correction moves Coins the same four ways a
 * settlement does and reads them in the same order. What it adds is the
 * reversal, and it is added at the front: an admin who has just taken Coins
 * off fans who were told they won needs that number before any of the others.
 * The verb changes with it — a correction re-grades Entries that were graded
 * once already.
 */
function whatItMoved(moved: Settlement | Correction): string {
  const correction = "reversed" in moved ? moved : null;
  const entries = moved.graded === 1 ? "Entry" : "Entries";
  const said = [`${moved.graded} ${entries} ${correction ? "re-graded" : "graded"}`];

  if (correction) said.push(`${coinsLabel(correction.reversed)} reversed`);

  said.push(`${coinsLabel(moved.paid)} returned in Rewards`);

  // Left off entirely rather than said as zero, because a card with no No
  // Results on it is the ordinary one and "0 Coins refunded in full" is a
  // sentence about something that did not happen.
  if (moved.returned !== 0) said.push(`${coinsLabel(moved.returned)} refunded in full`);

  return `${said.join(", ")}.`;
}

/** Everything entering a Result says to the admin entering it. */
export const RESULT_MESSAGES = {
  winnerNotChosen:
    "Choose which corner won. Every Prediction on this Bout is graded against " +
    "it first, so it is the one answer a Result cannot be entered without. A " +
    "Bout that decided no winner at all is a No Result instead.",
  methodNotChosen:
    "Choose how the Bout ended: KO/TKO, Submission, Decision, or a " +
    "disqualification. A Bout that ended in none of those produced nothing " +
    "the game can grade, which is a No Result rather than a method.",
  aDecisionHasNoRound:
    "A Decision is the Bout going the distance, so there is no round to " +
    "record it in. Clear the round, or say it ended in a KO/TKO or a " +
    "Submission.",
  aFinishHasARound:
    "A KO/TKO and a Submission happen in a round. Say which one this Bout " +
    "ended in — fans predicted it, and it is what their round answer is " +
    "graded against.",
  aDisqualificationHasNoRound:
    "A disqualification settles who won and nothing else: it is not one of " +
    "the three methods fans were offered, so the method and round Questions " +
    "on this Bout are No Results. Clear the round.",
  noResultReasonNotChosen:
    "Say why this Bout produced nothing to grade: it was cancelled, a fighter " +
    "withdrew, it was a draw, or it was a no contest. Every Prediction on it " +
    "then counts as ×1.0 and the rest of each Entry plays on.",
  aNoResultDecidedNothing:
    "A Bout either produced a result or it produced none, and this says both. " +
    "Enter the winner and the method, or the reason there is neither.",
  roundNotScheduled: (scheduledRounds: number) =>
    `This Bout is scheduled for ${scheduledRounds} rounds, so it cannot have ` +
    "ended in a later one. No fan was offered that round either.",
  unreadable:
    "That result could not be read. Choose the winner, the method and — for a " +
    "finish — the round, and enter it again. Nothing has been settled.",
  boutNotOpened:
    "Nobody opened this Bout for predictions, so no Entry is riding on how it " +
    "went and there is nothing to settle. A card can still be re-imported " +
    "while its Bouts are closed.",
  alreadySettled:
    "This Bout already has a result and the Coins it moved have been paid. A " +
    "result entered wrong is corrected by reversing what it settled and " +
    "grading again, never by overwriting it.",
  settled: (settlement: Settlement) => `Result entered. ${whatItMoved(settlement)}`,
  noResultEntered: (settlement: Settlement) => `No Result entered. ${whatItMoved(settlement)}`,
  notSettled:
    "Nothing has been entered about this Bout yet, so there is no result to " +
    "correct. Enter the result it produced, or the reason it produced none.",
  alreadyTheResult:
    "That is what this Bout is already recorded as having produced, so there " +
    "is nothing to correct. Change an answer, or leave the result as it " +
    "stands — every Entry on the Bout is already graded against it.",
  corrected: (correction: Correction) => `Result corrected. ${whatItMoved(correction)}`,
} as const;

/**
 * How a Bout ended, as the admin area sends it.
 *
 * There are two controls and they send two different bodies, because they are
 * two different statements about the fight: the result form sends the three
 * answers, and the No Result control sends the reason. **Whether `noResult` is
 * there at all is what says which of them was used** — present and null is an
 * admin who pressed "Enter No Result" without saying why, and that is a
 * different thing to tell them than "choose which corner won".
 *
 * Every field is optional because a control nobody used sends nothing, and an
 * empty one sends null. {@link parseEnding} reads this off the wire and takes
 * `unknown` rather than this, because what arrives is only claimed to be it.
 */
export interface EnteredEnding {
  winner?: Corner | null;
  method?: RecordedMethod | null;
  round?: number | null;
  noResult?: NoResultReason | null;
}

/** How a Bout ended, ready to be settled against, or the reason it is not. */
export type ParsedEnding =
  | { ending: BoutEnding; problem?: undefined }
  | { ending?: undefined; problem: string };

/**
 * Reads what an admin entered about a Bout, against the Bout it is about.
 *
 * The Bout is needed for one thing and only one: how many rounds it was
 * scheduled for, which is what makes "round 4" wrong on a three-round opener.
 * Everything else is what a Result may be made of at all, and is the same
 * question on every Bout on every card.
 *
 * A No Result is read first because it is a statement about the whole Bout:
 * nothing was decided, so there is no winner to check and no method to reject.
 * Sending both is refused rather than resolved — an admin who has filled in a
 * winner *and* said the Bout produced nothing has two different fights in mind,
 * and quietly honouring one of them would settle the wrong one.
 *
 * Asked again in Postgres — `bout_results_a_round_is_a_finish`,
 * `bout_results_is_a_result_or_no_result` and the key holding the round to one
 * the Bout offered — because a rule that lives only in a handler is one
 * refactor away from disappearing. It is asked here so that an admin is told
 * which answer is wrong rather than being handed the database's opinion.
 */
export function parseEnding(value: unknown, bout: { scheduledRounds: number }): ParsedEnding {
  const entered = (value ?? {}) as {
    winner?: unknown;
    method?: unknown;
    round?: unknown;
    noResult?: unknown;
  };
  const { winner = null, method = null, round = null } = entered;

  // `undefined` rather than null, because it is the field being there at all
  // that says the No Result control was the one used. A reason nobody chose
  // is answered as the missing reason it is.
  if (entered.noResult !== undefined) {
    const { noResult } = entered;

    if (!isNoResultReason(noResult)) return { problem: RESULT_MESSAGES.noResultReasonNotChosen };

    // Nothing the admin area sends alongside it, and a body that names a
    // winner as well is two different accounts of one fight — settling
    // whichever of them happened to be read would settle the wrong one.
    if (winner !== null || method !== null || round !== null) {
      return { problem: RESULT_MESSAGES.aNoResultDecidedNothing };
    }

    return { ending: { noResult } };
  }

  if (winner !== "red" && winner !== "blue") return { problem: RESULT_MESSAGES.winnerNotChosen };

  // A disqualification is a winner and nothing else. The round is refused
  // rather than dropped, because an admin who named one is describing a finish
  // this Bout is not being recorded as having.
  if (method === "disqualification") {
    if (round !== null) return { problem: RESULT_MESSAGES.aDisqualificationHasNoRound };

    return { ending: { result: { winner, method, round: null } } };
  }

  // Asked before the round is read, so that an admin who has answered neither
  // is told about the method — which is the answer they have to give before a
  // round means anything at all.
  if (!isMethod(method)) return { problem: RESULT_MESSAGES.methodNotChosen };

  if (round !== null && !isRound(round)) return { problem: RESULT_MESSAGES.unreadable };

  if (method === "decision") {
    if (round !== null) return { problem: RESULT_MESSAGES.aDecisionHasNoRound };

    return { ending: { result: { winner, method, round: null } } };
  }

  // A finish happened in a round, and the round it happened in is a fact about
  // the Bout rather than something an admin may leave out: it is what every
  // round answer on this Bout is graded against.
  if (round === null) return { problem: RESULT_MESSAGES.aFinishHasARound };

  if (round > bout.scheduledRounds) {
    return { problem: RESULT_MESSAGES.roundNotScheduled(bout.scheduledRounds) };
  }

  return { ending: { result: { winner, method, round } } };
}
