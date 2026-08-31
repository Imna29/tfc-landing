import { describe, expect, it } from "vitest";
import type { BoutPick } from "../../shared/entries";
import {
  RESULT_MESSAGES,
  gradeEntry,
  gradePrediction,
  parseResult,
  resultLabel,
  type BoutResult,
  type GradedPrediction,
} from "../../shared/results";

/**
 * What happened in a Bout, and what it does to the Predictions made on it.
 *
 * The arithmetic of settlement, with no database under it. Everything here is
 * a question that can be answered from the Result and the answers a fan gave,
 * which is deliberately all of the deciding: `server/utils/results.ts` reads
 * the rows and writes the Coins, and asks these functions what any of it means.
 *
 * The case worth reading first is the fail-fast one. An Entry is Lost the
 * instant one of its Predictions is, without waiting for its remaining Bouts —
 * showing "still open" beside a chain a fan can already see is dead makes the
 * product look broken, and puts somebody on a leaderboard who is out of it.
 */

const CORNERS = { red: "Giorgi Tsiklauri", blue: "Levan Beridze" };

/** A Result as an admin records one: who won, how, and when. */
function result(overrides: Partial<BoutResult> = {}): BoutResult {
  return { winner: "red", method: "ko_tko", round: 2, ...overrides };
}

/** A fan's answer to that Bout: a winner, deepened as far as they took it. */
function pick(overrides: Partial<BoutPick> = {}): BoutPick {
  return { corner: "red", method: null, round: null, ...overrides };
}

/** A Prediction beside the Result of the Bout it answered, if there is one. */
function graded(prediction: BoutPick, against: BoutResult | null = result()): GradedPrediction {
  return { prediction, result: against };
}

describe("grading one Prediction against a Result", () => {
  it("is correct when the fan picked the fighter who won", () => {
    expect(gradePrediction(pick({ corner: "red" }), result({ winner: "red" }))).toBe("correct");
  });

  it("is wrong when they picked the other corner", () => {
    expect(gradePrediction(pick({ corner: "blue" }), result({ winner: "red" }))).toBe("wrong");
  });

  it("is correct when the method they named is the one it ended by", () => {
    expect(
      gradePrediction(pick({ method: "ko_tko" }), result({ method: "ko_tko", round: 2 })),
    ).toBe("correct");
  });

  it("is wrong when they named a different method, whoever won", () => {
    expect(
      gradePrediction(pick({ method: "submission" }), result({ method: "ko_tko", round: 2 })),
    ).toBe("wrong");
  });

  it("is correct when the round they named is the one it ended in", () => {
    expect(
      gradePrediction(pick({ method: "ko_tko", round: 2 }), result({ method: "ko_tko", round: 2 })),
    ).toBe("correct");
  });

  it("is wrong when it ended a round later", () => {
    expect(
      gradePrediction(pick({ method: "ko_tko", round: 2 }), result({ method: "ko_tko", round: 3 })),
    ).toBe("wrong");
  });

  it("leaves an answer the fan never gave out of it", () => {
    // A winner-only Prediction is correct on a Bout that went to a Decision:
    // ADR-0004 deepens a pick with a method and a round, so a fan who named
    // neither is asking one Question and has answered it.
    expect(gradePrediction(pick(), result({ method: "decision", round: null }))).toBe("correct");
  });

  it("is unresolved while the Bout it answers has no Result", () => {
    expect(gradePrediction(pick(), null)).toBe("unresolved");
  });
});

describe("where an Entry stands once its Bouts start settling", () => {
  it("has won when every Prediction in it landed and every Bout has settled", () => {
    expect(gradeEntry([graded(pick({ corner: "red" })), graded(pick({ corner: "red" }))])).toBe(
      "won",
    );
  });

  it("is Lost the instant one Prediction fails, with Bouts still to come", () => {
    expect(
      gradeEntry([
        graded(pick({ corner: "blue" })),
        graded(pick({ corner: "red" }), null),
        graded(pick({ corner: "red" }), null),
      ]),
    ).toBe("lost");
  });

  it("stays open while every Prediction so far has landed and one Bout has not settled", () => {
    expect(gradeEntry([graded(pick({ corner: "red" })), graded(pick(), null)])).toBe("open");
  });
});

describe("reading a Result an admin entered", () => {
  const threeRounder = { scheduledRounds: 3 };

  it("reads a finish and the round it happened in", () => {
    expect(parseResult({ winner: "blue", method: "submission", round: 3 }, threeRounder)).toEqual({
      result: { winner: "blue", method: "submission", round: 3 },
    });
  });

  it("reads a Decision, which has no round", () => {
    expect(parseResult({ winner: "red", method: "decision", round: null }, threeRounder)).toEqual({
      result: { winner: "red", method: "decision", round: null },
    });
  });

  it("refuses a Decision that names a round", () => {
    expect(parseResult({ winner: "red", method: "decision", round: 2 }, threeRounder)).toEqual({
      problem: RESULT_MESSAGES.aDecisionHasNoRound,
    });
  });

  it("refuses a finish with no round, because it happened in one", () => {
    expect(parseResult({ winner: "red", method: "ko_tko", round: null }, threeRounder)).toEqual({
      problem: RESULT_MESSAGES.aFinishHasARound,
    });
  });

  it("refuses a round the Bout was never scheduled for", () => {
    expect(parseResult({ winner: "red", method: "ko_tko", round: 4 }, threeRounder)).toEqual({
      problem: RESULT_MESSAGES.roundNotScheduled(3),
    });
  });

  it("refuses a corner that is not one", () => {
    expect(parseResult({ winner: "green", method: "ko_tko", round: 1 }, threeRounder)).toEqual({
      problem: RESULT_MESSAGES.winnerNotChosen,
    });
  });

  it("refuses a method the game does not ask about", () => {
    expect(parseResult({ winner: "red", method: "disqualification" }, threeRounder)).toEqual({
      problem: RESULT_MESSAGES.methodNotChosen,
    });
  });
});

describe("a Result as a sentence", () => {
  it("names the winner, the method and the round", () => {
    expect(resultLabel(result({ winner: "blue", method: "submission", round: 3 }), CORNERS)).toBe(
      "Levan Beridze by Submission in round 3",
    );
  });

  it("leaves the round off a Decision", () => {
    expect(resultLabel(result({ method: "decision", round: null }), CORNERS)).toBe(
      "Giorgi Tsiklauri by Decision",
    );
  });
});
