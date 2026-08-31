import { describe, expect, it } from "vitest";
import type { BoutPick, PricedPrediction } from "../../shared/entries";
import { potentialReward, predictionMultiplier } from "../../shared/entries";
import {
  RESULT_MESSAGES,
  boutEndingLabel,
  endingNote,
  gradeEntry,
  gradePrediction,
  isTheSameEnding,
  noResultLabel,
  parseEnding,
  resultLabel,
  settledPrice,
  type BoutEnding,
  type BoutResult,
  type GradedPrediction,
  type NoResultReason,
} from "../../shared/results";

/**
 * What happened in a Bout, and what it does to the Predictions made on it.
 *
 * The arithmetic of settlement, with no database under it. Everything here is
 * a question that can be answered from how the Bout ended and the answers a fan
 * gave, which is deliberately all of the deciding: `server/utils/results.ts`
 * reads the rows and writes the Coins, and asks these functions what any of it
 * means.
 *
 * The case worth reading first is the fail-fast one. An Entry is Lost the
 * instant one of its Predictions is, without waiting for its remaining Bouts —
 * showing "still open" beside a chain a fan can already see is dead makes the
 * product look broken, and puts somebody on a leaderboard who is out of it.
 *
 * The second is ADR-0005. A Bout that produced nothing gradable neither wins
 * nor loses a chain: the Prediction on it contributes ×1.0 and the rest of the
 * Entry plays on, and an Entry of nothing but those is made whole. A
 * disqualification is the same rule applied to two Questions out of three.
 */

const CORNERS = { red: "Giorgi Tsiklauri", blue: "Levan Beridze" };

/** A Result as an admin records one: who won, how, and when. */
function result(overrides: Partial<BoutResult> = {}): BoutEnding {
  return { result: { winner: "red", method: "ko_tko", round: 2, ...overrides } };
}

/** A Bout that produced nothing gradable, and why (ADR-0005). */
function noResult(reason: NoResultReason = "draw"): BoutEnding {
  return { noResult: reason };
}

/** A fan's answer to that Bout: a winner, deepened as far as they took it. */
function pick(overrides: Partial<BoutPick> = {}): BoutPick {
  return { corner: "red", method: null, round: null, ...overrides };
}

/** That answer with what each part of it paid at submission (ADR-0002). */
function priced(overrides: Partial<PricedPrediction> = {}): PricedPrediction {
  return {
    boutId: "bout-1",
    corner: "red",
    method: null,
    round: null,
    winnerMultiplier: 2,
    methodMultiplier: null,
    roundMultiplier: null,
    ...overrides,
  };
}

/** A Prediction beside how the Bout it answered ended, if it has. */
function graded(prediction: BoutPick, against: BoutEnding | null = result()): GradedPrediction {
  return { prediction, ending: against };
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

  it("is unresolved while the Bout it answers has not been settled", () => {
    expect(gradePrediction(pick(), null)).toBe("unresolved");
  });
});

describe("grading one Prediction against a No Result", () => {
  it("is a No Result whatever the fan answered", () => {
    expect(gradePrediction(pick({ corner: "blue" }), noResult("withdrawal"))).toBe("no result");
    expect(gradePrediction(pick({ method: "ko_tko", round: 3 }), noResult("cancelled"))).toBe(
      "no result",
    );
  });

  it("is a No Result on each of the four ways a Bout produces nothing", () => {
    const reasons: NoResultReason[] = ["cancelled", "withdrawal", "draw", "no_contest"];

    expect(reasons.map((reason) => gradePrediction(pick(), noResult(reason)))).toEqual([
      "no result",
      "no result",
      "no result",
      "no result",
    ]);
  });
});

describe("grading one Prediction against a disqualification", () => {
  const dq = result({ winner: "red", method: "disqualification", round: null });

  it("settles the winner Question, because the DQ winner did win", () => {
    expect(gradePrediction(pick({ corner: "red" }), dq)).toBe("correct");
    expect(gradePrediction(pick({ corner: "blue" }), dq)).toBe("wrong");
  });

  it("leaves a method and a round with nothing to be wrong about", () => {
    // "Won by DQ" is not one of the three methods offered, so a fan who named
    // one cannot have named it wrongly — those two Questions are No Results
    // and the winner they picked still stands.
    expect(gradePrediction(pick({ corner: "red", method: "ko_tko", round: 2 }), dq)).toBe(
      "correct",
    );
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

  it("has won when a No Result sits beside Predictions that all landed", () => {
    expect(gradeEntry([graded(pick({ corner: "red" })), graded(pick(), noResult())])).toBe("won");
  });

  it("is Lost when a Prediction failed, No Result beside it or not", () => {
    expect(gradeEntry([graded(pick({ corner: "blue" })), graded(pick(), noResult())])).toBe("lost");
  });

  it("is Refunded when every Prediction in it was a No Result", () => {
    expect(gradeEntry([graded(pick(), noResult("cancelled")), graded(pick(), noResult())])).toBe(
      "refunded",
    );
  });

  it("is still open while a No Result waits on the Bouts beside it", () => {
    expect(gradeEntry([graded(pick(), noResult()), graded(pick(), null)])).toBe("open");
  });
});

describe("what a Prediction is worth once its Bout is decided", () => {
  it("pays what each answer was priced at when the Bout produced a Result", () => {
    const prediction = priced({ method: "ko_tko", methodMultiplier: 2.5 });

    expect(predictionMultiplier(settledPrice(prediction, result({ method: "ko_tko" })))).toBe(5);
  });

  it("contributes ×1.0 when the Bout produced no result", () => {
    const prediction = priced({ method: "ko_tko", methodMultiplier: 2.5 });

    expect(predictionMultiplier(settledPrice(prediction, noResult()))).toBe(1);
  });

  it("pays the winner and nothing else on a disqualification", () => {
    const prediction = priced({
      method: "ko_tko",
      round: 2,
      methodMultiplier: 2.5,
      roundMultiplier: 3,
    });
    const dq = result({ winner: "red", method: "disqualification", round: null });

    expect(predictionMultiplier(settledPrice(prediction, dq))).toBe(2);
  });

  it("leaves a Prediction whose Bout has not settled at what it was priced", () => {
    const prediction = priced({ methodMultiplier: 2.5 });

    expect(settledPrice(prediction, null)).toEqual(prediction);
  });

  it("pays the winning Prediction's Multiplier only, chained with a No Result", () => {
    // ADR-0005 in one line: the chain plays on, and the neutral link neither
    // adds to the Reward nor takes the Entry away.
    const chained = [
      settledPrice(priced({ winnerMultiplier: 2.5 }), result({ winner: "red" })),
      settledPrice(priced({ winnerMultiplier: 4 }), noResult("withdrawal")),
    ];

    expect(potentialReward(20, chained)).toMatchObject({ multiplier: 2.5, reward: 50 });
  });

  it("returns the Amount exactly when every Prediction was a No Result", () => {
    const refunded = [
      settledPrice(priced({ winnerMultiplier: 2.5 }), noResult()),
      settledPrice(priced({ winnerMultiplier: 4 }), noResult("cancelled")),
    ];

    expect(potentialReward(37, refunded)).toMatchObject({ multiplier: 1, reward: 37 });
  });
});

describe("reading what an admin entered about a Bout", () => {
  const threeRounder = { scheduledRounds: 3 };

  it("reads a finish and the round it happened in", () => {
    expect(parseEnding({ winner: "blue", method: "submission", round: 3 }, threeRounder)).toEqual({
      ending: { result: { winner: "blue", method: "submission", round: 3 } },
    });
  });

  it("reads a Decision, which has no round", () => {
    expect(parseEnding({ winner: "red", method: "decision", round: null }, threeRounder)).toEqual({
      ending: { result: { winner: "red", method: "decision", round: null } },
    });
  });

  it("reads a disqualification, which settles the winner and nothing else", () => {
    expect(
      parseEnding({ winner: "red", method: "disqualification", round: null }, threeRounder),
    ).toEqual({ ending: { result: { winner: "red", method: "disqualification", round: null } } });
  });

  it("refuses a disqualification that names a round", () => {
    expect(
      parseEnding({ winner: "red", method: "disqualification", round: 2 }, threeRounder),
    ).toEqual({ problem: RESULT_MESSAGES.aDisqualificationHasNoRound });
  });

  it("reads each of the four ways a Bout produces nothing gradable", () => {
    const reasons: NoResultReason[] = ["cancelled", "withdrawal", "draw", "no_contest"];

    expect(reasons.map((reason) => parseEnding({ noResult: reason }, threeRounder))).toEqual(
      reasons.map((reason) => ({ ending: { noResult: reason } })),
    );
  });

  it("names the method as the missing answer before it reads the round", () => {
    // Both are unanswered, and the method is the one that has to be given
    // before a round means anything at all.
    expect(parseEnding({ winner: "red", method: null, round: "two" }, threeRounder)).toEqual({
      problem: RESULT_MESSAGES.methodNotChosen,
    });
  });

  it("refuses a reason no Bout produces nothing for", () => {
    expect(parseEnding({ noResult: "boring" }, threeRounder)).toEqual({
      problem: RESULT_MESSAGES.noResultReasonNotChosen,
    });
  });

  it("asks for the reason when the No Result control was used and left empty", () => {
    // The field being there at all is what says which control was pressed, so
    // an admin who has not said why is asked why — rather than being told to
    // choose a winner, which is the other form's question.
    expect(parseEnding({ noResult: null }, threeRounder)).toEqual({
      problem: RESULT_MESSAGES.noResultReasonNotChosen,
    });
  });

  it("asks for the winner when the result form was the empty one", () => {
    expect(parseEnding({ winner: null, method: null, round: null }, threeRounder)).toEqual({
      problem: RESULT_MESSAGES.winnerNotChosen,
    });
  });

  it("refuses a Result and a No Result entered as one", () => {
    expect(
      parseEnding(
        { winner: "red", method: "decision", round: null, noResult: "draw" },
        threeRounder,
      ),
    ).toEqual({ problem: RESULT_MESSAGES.aNoResultDecidedNothing });
  });

  it("refuses a Decision that names a round", () => {
    expect(parseEnding({ winner: "red", method: "decision", round: 2 }, threeRounder)).toEqual({
      problem: RESULT_MESSAGES.aDecisionHasNoRound,
    });
  });

  it("refuses a finish with no round, because it happened in one", () => {
    expect(parseEnding({ winner: "red", method: "ko_tko", round: null }, threeRounder)).toEqual({
      problem: RESULT_MESSAGES.aFinishHasARound,
    });
  });

  it("refuses a round the Bout was never scheduled for", () => {
    expect(parseEnding({ winner: "red", method: "ko_tko", round: 4 }, threeRounder)).toEqual({
      problem: RESULT_MESSAGES.roundNotScheduled(3),
    });
  });

  it("refuses a corner that is not one", () => {
    expect(parseEnding({ winner: "green", method: "ko_tko", round: 1 }, threeRounder)).toEqual({
      problem: RESULT_MESSAGES.winnerNotChosen,
    });
  });

  it("refuses a method the game does not ask about", () => {
    expect(parseEnding({ winner: "red", method: "knockdown" }, threeRounder)).toEqual({
      problem: RESULT_MESSAGES.methodNotChosen,
    });
  });
});

describe("what a fan is told about an answer that stopped counting", () => {
  const dq = result({ winner: "red", method: "disqualification", round: null });

  it("names the reason a Bout produced nothing, and the ×1.0 it now counts as", () => {
    expect(endingNote(pick(), noResult("withdrawal"))).toBe(
      "No Result — Fighter withdrew. Nothing about this Bout could be graded, so this " +
        "Prediction counts as ×1.00 and the rest of the Entry plays on.",
    );
  });

  it("explains a disqualification to the fan whose method it neutralised", () => {
    expect(endingNote(pick({ method: "ko_tko", round: 2 }), dq)).toBe(
      "Won by disqualification, which is not one of the three methods this Bout offered. " +
        "The winner picked still stands; the method and the round count as ×1.00 each.",
    );
  });

  it("says nothing where there is nothing to explain", () => {
    // A Bout still to be fought, a Bout that ended the way it was asked
    // about, and a winner-only Prediction on a disqualification — which was
    // graded on the one Question it asked and pays what it was priced at.
    expect(endingNote(pick(), null)).toBeNull();
    expect(endingNote(pick({ method: "ko_tko", round: 2 }), result())).toBeNull();
    expect(endingNote(pick(), dq)).toBeNull();
  });
});

describe("how a Bout went, as a sentence", () => {
  it("names the winner, the method and the round", () => {
    expect(resultLabel({ winner: "blue", method: "submission", round: 3 }, CORNERS)).toBe(
      "Levan Beridze by Submission in round 3",
    );
  });

  it("leaves the round off a Decision", () => {
    expect(resultLabel({ winner: "red", method: "decision", round: null }, CORNERS)).toBe(
      "Giorgi Tsiklauri by Decision",
    );
  });

  it("names a disqualification as the way the Bout ended", () => {
    expect(resultLabel({ winner: "red", method: "disqualification", round: null }, CORNERS)).toBe(
      "Giorgi Tsiklauri by Disqualification",
    );
  });

  it("says a No Result and why, because otherwise it reads as arbitrary", () => {
    expect(boutEndingLabel(noResult("withdrawal"), CORNERS)).toBe("No Result — Fighter withdrew");
    expect(boutEndingLabel(noResult("no_contest"), CORNERS)).toBe("No Result — No contest");
    expect(noResultLabel("cancelled")).toBe("No Result — Bout cancelled");
  });

  it("says the Result where there is one", () => {
    expect(boutEndingLabel(result({ method: "decision", round: null }), CORNERS)).toBe(
      "Giorgi Tsiklauri by Decision",
    );
  });
});

/**
 * The question a correction asks before it writes anything: is this a
 * different account of the fight at all?
 *
 * Cheap to get subtly wrong, and expensive when it is. Reading two identical
 * results as different would put a row in the audit log saying a Result was
 * replaced by itself and re-pay Rewards nobody's Coins moved for; reading two
 * different ones as the same would refuse a correction somebody needs to make.
 */
describe("whether two endings are the same account of one Bout", () => {
  it("is the same result entered twice", () => {
    expect(isTheSameEnding(result(), result())).toBe(true);
    expect(isTheSameEnding(noResult("draw"), noResult("draw"))).toBe(true);
  });

  it("is not the same when any one answer moved", () => {
    expect(isTheSameEnding(result(), result({ winner: "blue" }))).toBe(false);
    expect(isTheSameEnding(result(), result({ method: "submission" }))).toBe(false);
    expect(isTheSameEnding(result(), result({ round: 3 }))).toBe(false);
  });

  it("tells the four ways a Bout produces nothing gradable apart", () => {
    // A fan is shown which of them it was (ADR-0005), so correcting a draw to
    // a no contest is a correction like any other.
    expect(isTheSameEnding(noResult("draw"), noResult("no_contest"))).toBe(false);
  });

  it("is never a Result and a No Result", () => {
    expect(isTheSameEnding(result(), noResult())).toBe(false);
    expect(isTheSameEnding(noResult(), result())).toBe(false);
  });

  it("counts an answer nobody gave as part of what was recorded", () => {
    // "Decision, no round" and "KO/TKO in round 2" differ in two answers; the
    // null is as much a statement about the fight as the round is.
    expect(
      isTheSameEnding(result({ method: "decision", round: null }), result({ method: "decision" })),
    ).toBe(false);
  });
});

/**
 * What an admin is told a correction did.
 *
 * The reversal is said first and separately, because it is the half they are
 * uneasy about: Coins have just come off fans who had been told they won, and
 * a net figure would let a correction that reversed 800 Coins and paid 800
 * read as a correction that did nothing.
 */
describe("what correcting a result says it moved", () => {
  const moved = {
    graded: 12,
    won: 3,
    lost: 8,
    refunded: 1,
    stillOpen: 0,
    paid: 240,
    returned: 20,
    reversed: 800,
  };

  it("counts the Entries, the Coins taken back and the Coins handed out", () => {
    expect(RESULT_MESSAGES.corrected(moved)).toBe(
      "Result corrected. 12 Entries re-graded, 800 Coins reversed, 240 Coins returned in " +
        "Rewards, 20 Coins refunded in full.",
    );
  });

  it("leaves the refunds off a correction that made nobody whole", () => {
    expect(RESULT_MESSAGES.corrected({ ...moved, returned: 0 })).toBe(
      "Result corrected. 12 Entries re-graded, 800 Coins reversed, 240 Coins returned in Rewards.",
    );
  });

  it("counts one Entry as one Entry", () => {
    expect(RESULT_MESSAGES.corrected({ ...moved, graded: 1, returned: 0 })).toContain(
      "1 Entry re-graded",
    );
  });
});
