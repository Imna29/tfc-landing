/**
 * What happened in a Bout, and what it does to the Predictions made on it.
 *
 * The whole of settlement's deciding, with nothing about Postgres in it.
 * `server/utils/results.ts` reads the rows, writes the Coins and holds the
 * transaction together; every question about *meaning* — did this Prediction
 * land, has this Entry won or lost yet — is asked here, once, of the Result and
 * the answers the fan gave.
 *
 * Shared for the reason `shared/entries.ts` is: the admin area records a Result
 * with these words and refuses one with these sentences, the profile history
 * will grade a Prediction with this function rather than a second copy of it,
 * and `test/unit/vocabulary.test.ts` holds all of it to `CONTEXT.md` at once.
 *
 * Nothing here is written down. A Prediction's grade is worked out from the
 * Result of its Bout wherever it is shown, never stored beside it — for the
 * reason ADR-0013 gives about the combined Multiplier, and ADR-0003 about a
 * Balance: a copy of an answer the data already holds is a second answer, and
 * something has to decide which of them is right the day they differ.
 */
import { coinsLabel } from "./coins";
import type { BoutPick, EntryStatus } from "./entries";
import type { Corner } from "./events";
import { isMethod, isRound, METHOD_LABELS, type Method } from "./pricing";

/**
 * What an admin records about a Bout that has been fought: who won, how it
 * ended, and — where it ended inside one — which round.
 *
 * The same three answers a Prediction is made of, which is what makes grading
 * a comparison rather than an interpretation. `winner` rather than `corner`,
 * because that is the Question it answers (`CONTEXT.md`) and because a Result
 * is a statement about the Bout rather than a pick somebody made.
 *
 * A Bout that produced nothing gradable is a No Result and is not one of these
 * (ADR-0005, #15). That is deliberate: every Result here settles the Questions
 * it answers, so nothing reading one has to wonder whether it counts.
 */
export interface BoutResult {
  winner: Corner;
  method: Method;
  /** The round it ended in, or null where it went to a Decision. */
  round: number | null;
}

/**
 * Where one Prediction stands.
 *
 * `unresolved` is the Bout not having settled yet, which is what
 * `CONTEXT.md` calls an Entry Open for. It is a third value rather than a
 * `null` because it is a state a fan is shown — a Chained Entry part-way
 * through a card reads as two landed, one to come — and #15 adds a fourth for
 * the Bout that produced nothing gradable.
 */
export type PredictionGrade = "correct" | "wrong" | "unresolved";

/**
 * Whether this Prediction landed.
 *
 * Every answer the fan gave has to be right, and every answer they did not
 * give is not asked about: a winner-only Prediction on a Bout that went to a
 * Decision is correct, because ADR-0004 makes a method and a round a
 * *deepening* of the winner pick rather than three predictions standing beside
 * one another. That is also why a wrong winner ends it — the method was priced
 * knowing it multiplies onto that fighter winning.
 */
export function gradePrediction(pick: BoutPick, result: BoutResult | null): PredictionGrade {
  if (result === null) return "unresolved";

  if (pick.corner !== result.winner) return "wrong";
  if (pick.method !== null && pick.method !== result.method) return "wrong";
  if (pick.round !== null && pick.round !== result.round) return "wrong";

  return "correct";
}

/** One Prediction of an Entry, beside the Result of the Bout it answered. */
export interface GradedPrediction {
  prediction: BoutPick;
  /** The Result of its Bout, or null while that Bout has not settled. */
  result: BoutResult | null;
}

/**
 * Where an Entry stands once the Results known so far are applied to it.
 *
 * **Lost the instant any Prediction in it fails**, without waiting for its
 * remaining Bouts. That is the fail-fast rule the spec asks for, and the order
 * of the two checks below is the whole of it: a chain with one missed
 * Prediction and three Bouts still to come is not Open, and showing it as Open
 * would tell a fan their Entry is alive when they can see on the screen that
 * it is not — and would count them among the fans still in contention on the
 * leaderboard.
 *
 * An Entry has Won only once every Bout in it has settled. Nothing pays before
 * then, because there is nothing to pay: a Reward is the Amount at the
 * combined Multiplier of the whole chain.
 */
export function gradeEntry(graded: readonly GradedPrediction[]): EntryStatus {
  const grades = graded.map((one) => gradePrediction(one.prediction, one.result));

  if (grades.includes("wrong")) return "lost";
  if (grades.includes("unresolved")) return "open";

  return "won";
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

  return `${corners[result.winner]} by ${METHOD_LABELS[result.method]}${round}`;
}

/** Everything entering a Result says to the admin entering it. */
export const RESULT_MESSAGES = {
  winnerNotChosen:
    "Choose which corner won. Every Prediction on this Bout is graded against " +
    "it first, so it is the one answer a Result cannot be entered without.",
  methodNotChosen:
    "Choose how the Bout ended: KO/TKO, Submission, or Decision. A Bout that " +
    "ended in none of them produced no result the game can grade, which is " +
    "its own thing rather than a method.",
  aDecisionHasNoRound:
    "A Decision is the Bout going the distance, so there is no round to " +
    "record it in. Clear the round, or say it ended in a KO/TKO or a " +
    "Submission.",
  aFinishHasARound:
    "A KO/TKO and a Submission happen in a round. Say which one this Bout " +
    "ended in — fans predicted it, and it is what their round answer is " +
    "graded against.",
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
  settled: (entries: number, coins: number) =>
    `Result entered. ${entries} ${entries === 1 ? "Entry" : "Entries"} graded, ` +
    `${coinsLabel(coins)} returned in Rewards.`,
} as const;

/** A Result ready to be settled against, or the reason it is not one. */
export type ParsedResult =
  | { result: BoutResult; problem?: undefined }
  | { result?: undefined; problem: string };

/**
 * Reads the Result an admin entered, against the Bout it is about.
 *
 * The Bout is needed for one of these and only one: how many rounds it was
 * scheduled for, which is what makes "round 4" wrong on a three-round opener.
 * Everything else is what a Result may be made of at all, and is the same
 * question on every Bout on every card.
 *
 * Asked again in Postgres — `bout_results_a_round_is_a_finish` and the key
 * holding the round to one the Bout offered — because a rule that lives only
 * in a handler is one refactor away from disappearing. It is asked here so
 * that an admin is told which answer is wrong rather than being handed the
 * database's opinion of their result.
 */
export function parseResult(value: unknown, bout: { scheduledRounds: number }): ParsedResult {
  const entered = (value ?? {}) as { winner?: unknown; method?: unknown; round?: unknown };
  const { winner, method, round = null } = entered;

  if (winner !== "red" && winner !== "blue") return { problem: RESULT_MESSAGES.winnerNotChosen };
  if (!isMethod(method)) return { problem: RESULT_MESSAGES.methodNotChosen };

  if (round !== null && !isRound(round)) return { problem: RESULT_MESSAGES.unreadable };

  if (method === "decision") {
    if (round !== null) return { problem: RESULT_MESSAGES.aDecisionHasNoRound };

    return { result: { winner, method, round: null } };
  }

  // A finish happened in a round, and the round it happened in is a fact about
  // the Bout rather than something an admin may leave out: it is what every
  // round answer on this Bout is graded against.
  if (round === null) return { problem: RESULT_MESSAGES.aFinishHasARound };

  if (round > bout.scheduledRounds) {
    return { problem: RESULT_MESSAGES.roundNotScheduled(bout.scheduledRounds) };
  }

  return { result: { winner, method, round } };
}
