import { describe, expect, it } from "vitest";
import type { PricedPrediction } from "../../shared/entries";
import { potentialReward } from "../../shared/entries";
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
import type { Corner } from "../../shared/events";
import type { Method, OutcomeAnswer } from "../../shared/pricing";

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
 * disqualification is the same rule applied to one Question out of two — which,
 * now that a Prediction answers one of them (ADR-0014), is a statement about
 * which Predictions on that Bout count for nothing rather than about parts of
 * one.
 */

const CORNERS = { red: "Giorgi Tsiklauri", blue: "Levan Beridze" };

/** A Result as an admin records one: who won, and how. */
function result(overrides: Partial<BoutResult> = {}): BoutEnding {
  return { result: { winner: "red", method: "ko_tko", ...overrides } };
}

/** A Bout that produced nothing gradable, and why (ADR-0005). */
function noResult(reason: NoResultReason = "draw"): BoutEnding {
  return { noResult: reason };
}

/** A fan's answer to that Bout: one answer to one of its two Questions. */
function pick(overrides: Partial<OutcomeAnswer> = {}): OutcomeAnswer {
  return { question: "winner", corner: "red", method: null, ...overrides };
}

/**
 * The method Prediction a case gives: this fighter wins this way.
 *
 * Names a corner like every other answer (ADR-0015), and defaults to the red
 * one — which is the corner `result()` records as winning, so a case that
 * means "the right fighter, the wrong method" says only the method.
 */
function byMethod(method: Method, corner: Corner = "red"): OutcomeAnswer {
  return pick({ question: "method", corner, method });
}

/** That answer with what it paid at submission (ADR-0002). */
function priced(overrides: Partial<PricedPrediction> = {}): PricedPrediction {
  return { boutId: "bout-1", ...pick(), multiplier: 2, ...overrides };
}

/** A Prediction beside how the Bout it answered ended, if it has. */
function graded(
  prediction: OutcomeAnswer,
  against: BoutEnding | null = result(),
): GradedPrediction {
  return { prediction, ending: against };
}

describe("grading one Prediction against a Result", () => {
  it("is correct when the fan picked the fighter who won", () => {
    expect(gradePrediction(pick({ corner: "red" }), result({ winner: "red" }))).toBe("correct");
  });

  it("is wrong when they picked the other corner", () => {
    expect(gradePrediction(pick({ corner: "blue" }), result({ winner: "red" }))).toBe("wrong");
  });

  it("is correct when the fighter named won by the method named", () => {
    expect(
      gradePrediction(byMethod("ko_tko", "blue"), result({ winner: "blue", method: "ko_tko" })),
    ).toBe("correct");
  });

  it("is wrong when it ended by a different method", () => {
    expect(gradePrediction(byMethod("submission"), result({ method: "ko_tko" }))).toBe("wrong");
  });

  it("is wrong when the method was right and the fighter was not", () => {
    // The case ADR-0015 exists to make gradable: the Bout did end by
    // Submission, and the fan named the fighter who was submitted. Under the
    // corner-free answer they were paid for it.
    expect(
      gradePrediction(
        byMethod("submission", "blue"),
        result({ winner: "red", method: "submission" }),
      ),
    ).toBe("wrong");
  });

  it("is correct when a Decision was named and the Bout went the distance", () => {
    expect(gradePrediction(byMethod("decision"), result({ method: "decision" }))).toBe("correct");
  });

  it("asks only about the Question the fan answered", () => {
    // A winner Prediction is graded on who won and nothing else about the
    // Bout: the method is a Question they did not ask.
    expect(gradePrediction(pick(), result({ method: "submission" }))).toBe("correct");
  });

  it("asks a method Prediction about the winner as well as the method", () => {
    // Both halves have to be right, and neither half is enough: naming the
    // winner without the method is not a method answer, and naming the method
    // without the winner is not one either (ADR-0015).
    const submittedByRed = result({ winner: "red", method: "submission" });

    expect(gradePrediction(byMethod("submission", "red"), submittedByRed)).toBe("correct");
    expect(gradePrediction(byMethod("ko_tko", "red"), submittedByRed)).toBe("wrong");
    expect(gradePrediction(byMethod("submission", "blue"), submittedByRed)).toBe("wrong");
  });

  it("is unresolved while the Bout it answers has not been settled", () => {
    expect(gradePrediction(pick(), null)).toBe("unresolved");
  });
});

describe("grading one Prediction against a No Result", () => {
  it("is a No Result whatever the fan answered", () => {
    expect(gradePrediction(pick({ corner: "blue" }), noResult("withdrawal"))).toBe("no result");
    expect(gradePrediction(byMethod("ko_tko"), noResult("cancelled"))).toBe("no result");
    expect(gradePrediction(byMethod("submission", "blue"), noResult("draw"))).toBe("no result");
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

describe("grading a Bout its discipline asked no method about", () => {
  const grappled: BoutEnding = { result: { winner: "red", method: null } };

  it("grades the winner Question the way every other Bout does", () => {
    expect(gradePrediction(pick({ corner: "red" }), grappled)).toBe("correct");
    expect(gradePrediction(pick({ corner: "blue" }), grappled)).toBe("wrong");
  });

  it("counts a method answer for nothing rather than against the fan", () => {
    // Unreachable through the game — a Bout with no method Question offers no
    // method Outcome, so there is no such Prediction to make (ADR-0017). Graded
    // the way a disqualification is anyway, because the shape allows it and
    // "wrong" would mark a fan down for an answer nobody offered them.
    expect(gradePrediction(byMethod("submission"), grappled)).toBe("no result");
    expect(settledPrice(priced(byMethod("submission")), grappled)).toMatchObject({
      multiplier: 1,
    });
  });
});

describe("grading one Prediction against a disqualification", () => {
  const dq = result({ winner: "red", method: "disqualification" });

  it("settles the winner Question, because the DQ winner did win", () => {
    expect(gradePrediction(pick({ corner: "red" }), dq)).toBe("correct");
    expect(gradePrediction(pick({ corner: "blue" }), dq)).toBe("wrong");
  });

  it("leaves a method Prediction with nothing to be wrong about", () => {
    // "Won by DQ" is not one of the three methods offered, so a fan who named
    // one cannot have named it wrongly — that Question is a No Result on this
    // Bout, and a fan is never marked wrong for failing to predict an answer
    // that was never on the card. Naming a corner changes none of that
    // (ADR-0015): it counts for nothing whichever fighter it named, the one
    // who was disqualified included.
    expect(gradePrediction(byMethod("ko_tko"), dq)).toBe("no result");
    expect(gradePrediction(byMethod("ko_tko", "blue"), dq)).toBe("no result");
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
  it("pays what its answer was priced at when the Bout produced a Result", () => {
    const prediction = priced({ ...byMethod("ko_tko"), multiplier: 2.5 });

    expect(settledPrice(prediction, result({ method: "ko_tko" })).multiplier).toBe(2.5);
  });

  it("contributes ×1.0 when the Bout produced no result", () => {
    const prediction = priced({ ...byMethod("ko_tko"), multiplier: 2.5 });

    expect(settledPrice(prediction, noResult()).multiplier).toBe(1);
  });

  it("pays a winner Prediction and neutralises a method one on a disqualification", () => {
    const dq = result({ winner: "red", method: "disqualification" });

    expect(settledPrice(priced(), dq).multiplier).toBe(2);
    expect(settledPrice(priced({ ...byMethod("ko_tko"), multiplier: 2.5 }), dq).multiplier).toBe(1);
  });

  it("leaves a Prediction whose Bout has not settled at what it was priced", () => {
    const prediction = priced({ multiplier: 2.5 });

    expect(settledPrice(prediction, null)).toEqual(prediction);
  });

  it("pays the winning Prediction's Multiplier only, chained with a No Result", () => {
    // ADR-0005 in one line: the chain plays on, and the neutral link neither
    // adds to the Reward nor takes the Entry away.
    const chained = [
      settledPrice(priced({ multiplier: 2.5 }), result({ winner: "red" })),
      settledPrice(priced({ multiplier: 4 }), noResult("withdrawal")),
    ];

    expect(potentialReward(20, chained)).toMatchObject({ multiplier: 2.5, reward: 50 });
  });

  it("returns the Amount exactly when every Prediction was a No Result", () => {
    const refunded = [
      settledPrice(priced({ multiplier: 2.5 }), noResult()),
      settledPrice(priced({ multiplier: 4 }), noResult("cancelled")),
    ];

    expect(potentialReward(37, refunded)).toMatchObject({ multiplier: 1, reward: 37 });
  });
});

describe("reading what an admin entered about a Bout", () => {
  it("reads a finish", () => {
    expect(parseEnding({ winner: "blue", method: "submission" }, "mma")).toEqual({
      ending: { result: { winner: "blue", method: "submission" } },
    });
  });

  it("reads a Decision", () => {
    expect(parseEnding({ winner: "red", method: "decision" }, "mma")).toEqual({
      ending: { result: { winner: "red", method: "decision" } },
    });
  });

  it("reads a disqualification, which settles the winner and nothing else", () => {
    expect(parseEnding({ winner: "red", method: "disqualification" }, "mma")).toEqual({
      ending: { result: { winner: "red", method: "disqualification" } },
    });
  });

  it("reads a body still carrying the round a Result used to record", () => {
    // A card left open in an admin's tab from before ADR-0016 sends one. The
    // round is not part of a Result any more, so it is read past rather than
    // refused: the two answers this Bout is settled on are both there.
    expect(parseEnding({ winner: "blue", method: "submission", round: 3 }, "mma")).toEqual({
      ending: { result: { winner: "blue", method: "submission" } },
    });
  });

  it("reads each of the four ways a Bout produces nothing gradable", () => {
    const reasons: NoResultReason[] = ["cancelled", "withdrawal", "draw", "no_contest"];

    expect(reasons.map((reason) => parseEnding({ noResult: reason }, "mma"))).toEqual(
      reasons.map((reason) => ({ ending: { noResult: reason } })),
    );
  });

  it("asks for the method when the winner is the only answer given", () => {
    expect(parseEnding({ winner: "red", method: null }, "mma")).toEqual({
      problem: RESULT_MESSAGES.methodNotChosen("mma"),
    });
  });

  it("refuses a reason no Bout produces nothing for", () => {
    expect(parseEnding({ noResult: "boring" }, "mma")).toEqual({
      problem: RESULT_MESSAGES.noResultReasonNotChosen,
    });
  });

  it("asks for the reason when the No Result control was used and left empty", () => {
    // The field being there at all is what says which control was pressed, so
    // an admin who has not said why is asked why — rather than being told to
    // choose a winner, which is the other form's question.
    expect(parseEnding({ noResult: null }, "mma")).toEqual({
      problem: RESULT_MESSAGES.noResultReasonNotChosen,
    });
  });

  it("asks for the winner when the result form was the empty one", () => {
    expect(parseEnding({ winner: null, method: null }, "mma")).toEqual({
      problem: RESULT_MESSAGES.winnerNotChosen,
    });
  });

  it("refuses a Result and a No Result entered as one", () => {
    expect(parseEnding({ winner: "red", method: "decision", noResult: "draw" }, "mma")).toEqual({
      problem: RESULT_MESSAGES.aNoResultDecidedNothing,
    });
  });

  it("refuses a corner that is not one", () => {
    expect(parseEnding({ winner: "green", method: "ko_tko" }, "mma")).toEqual({
      problem: RESULT_MESSAGES.winnerNotChosen,
    });
  });

  it("refuses a method the game does not ask about", () => {
    expect(parseEnding({ winner: "red", method: "knockdown" }, "mma")).toEqual({
      problem: RESULT_MESSAGES.methodNotChosen("mma"),
    });
  });

  it("reads a Cage Grappling Bout, which is settled on its winner alone", () => {
    // ADR-0017: the discipline asks no method Question, so a Result records
    // none — and the method is null rather than missing, because that is the
    // shape everything downstream reads a Result in.
    expect(parseEnding({ winner: "blue" }, "cage_grappling")).toEqual({
      ending: { result: { winner: "blue", method: null } },
    });
  });

  it("refuses a method on a Bout whose discipline asks for none", () => {
    // Not read past, the way the retired round is. A round arrived from a page
    // that no longer exists; a method here is somebody telling the game
    // something about a fight it never asked about, and the two would settle
    // the Bout differently.
    expect(parseEnding({ winner: "blue", method: "submission" }, "cage_grappling")).toEqual({
      problem: RESULT_MESSAGES.methodNotAsked("cage_grappling"),
    });
  });

  it("refuses a disqualification where no method Question was asked", () => {
    // A DQ is recorded at all because it turns the method Question into a No
    // Result (ADR-0005). On a Bout with no method Question there is nothing for
    // it to do, and the fighter who was awarded the win still won.
    expect(parseEnding({ winner: "red", method: "disqualification" }, "cage_grappling")).toEqual({
      problem: RESULT_MESSAGES.methodNotAsked("cage_grappling"),
    });
  });

  it("still asks a Cage Grappling Bout who won", () => {
    expect(parseEnding({ winner: null }, "cage_grappling")).toEqual({
      problem: RESULT_MESSAGES.winnerNotChosen,
    });
  });

  it("reads a No Result on a Bout with no method Question", () => {
    // A Cage Grappling Bout is cancelled and withdrawn from like any other.
    expect(parseEnding({ noResult: "withdrawal" }, "cage_grappling")).toEqual({
      ending: { noResult: "withdrawal" },
    });
  });

  it("refuses a Submission on a CageBox Bout, which cannot end in one", () => {
    // A method the game knows and this Bout could never produce (ADR-0017), so
    // no fan was offered it and a Result naming it is a fight somebody has
    // mixed up with the one before it.
    expect(parseEnding({ winner: "red", method: "submission" }, "cagebox")).toEqual({
      problem: RESULT_MESSAGES.methodNotChosen("cagebox"),
    });
  });

  it("reads the two endings a CageBox Bout has, and the disqualification behind them", () => {
    expect(parseEnding({ winner: "red", method: "ko_tko" }, "cagebox")).toEqual({
      ending: { result: { winner: "red", method: "ko_tko" } },
    });
    expect(parseEnding({ winner: "blue", method: "decision" }, "cagebox")).toEqual({
      ending: { result: { winner: "blue", method: "decision" } },
    });
    expect(parseEnding({ winner: "blue", method: "disqualification" }, "cagebox")).toEqual({
      ending: { result: { winner: "blue", method: "disqualification" } },
    });
  });

  it("names only the endings this Bout has when it asks for one", () => {
    // The refusal is the list an admin picks from, so it cannot name a
    // Submission on a Bout that has none.
    expect(RESULT_MESSAGES.methodNotChosen("cagebox")).toContain("KO/TKO");
    expect(RESULT_MESSAGES.methodNotChosen("cagebox")).not.toContain("Submission");
    expect(RESULT_MESSAGES.methodNotChosen("mma")).toContain("Submission");
  });
});

describe("what a fan is told about an answer that stopped counting", () => {
  const dq = result({ winner: "red", method: "disqualification" });

  it("names the reason a Bout produced nothing, and the ×1.0 it now counts as", () => {
    expect(endingNote(pick(), noResult("withdrawal"))).toBe(
      "No Result — Fighter withdrew. Nothing about this Bout could be graded, so this " +
        "Prediction counts as ×1.00 and the rest of the Entry plays on.",
    );
  });

  it("explains a disqualification to the fan whose method it neutralised", () => {
    expect(endingNote(byMethod("ko_tko"), dq)).toBe(
      "Won by disqualification, which is not one of the methods this Bout offered, so " +
        "there was nothing here to be right or wrong about. This Prediction counts as ×1.00 " +
        "and the rest of the Entry plays on.",
    );
  });

  it("says nothing where there is nothing to explain", () => {
    // A Bout still to be fought, a Bout that ended the way it was asked
    // about, and a winner Prediction on a disqualification — which was graded
    // on the Question it asked and pays what it was priced at.
    expect(endingNote(pick(), null)).toBeNull();
    expect(endingNote(byMethod("ko_tko"), result({ method: "ko_tko" }))).toBeNull();
    expect(endingNote(pick(), dq)).toBeNull();
  });
});

describe("how a Bout went, as a sentence", () => {
  it("names the winner and the method", () => {
    expect(resultLabel({ winner: "blue", method: "submission" }, CORNERS)).toBe(
      "Levan Beridze by Submission",
    );
    expect(resultLabel({ winner: "red", method: "decision" }, CORNERS)).toBe(
      "Giorgi Tsiklauri by Decision",
    );
  });

  it("names a disqualification as the way the Bout ended", () => {
    expect(resultLabel({ winner: "red", method: "disqualification" }, CORNERS)).toBe(
      "Giorgi Tsiklauri by Disqualification",
    );
  });

  it("names the winner alone where the Bout had no method to record", () => {
    // A Cage Grappling Bout (ADR-0017). "by" with nothing after it would be a
    // sentence missing its end, and the bare name reads as a caption rather
    // than as a statement about a fight.
    expect(resultLabel({ winner: "blue", method: null }, CORNERS)).toBe("Levan Beridze wins");
  });

  it("says a No Result and why, because otherwise it reads as arbitrary", () => {
    expect(boutEndingLabel(noResult("withdrawal"), CORNERS)).toBe("No Result — Fighter withdrew");
    expect(boutEndingLabel(noResult("no_contest"), CORNERS)).toBe("No Result — No contest");
    expect(noResultLabel("cancelled")).toBe("No Result — Bout cancelled");
  });

  it("says the Result where there is one", () => {
    expect(boutEndingLabel(result({ method: "decision" }), CORNERS)).toBe(
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

  it("is not the same when either answer moved", () => {
    expect(isTheSameEnding(result(), result({ winner: "blue" }))).toBe(false);
    expect(isTheSameEnding(result(), result({ method: "submission" }))).toBe(false);
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

  it("tells a disqualification from the methods the game offers", () => {
    // A Bout corrected from a KO/TKO to a disqualification is the correction
    // ADR-0005 turns a whole Question into a No Result over, so it is
    // emphatically a different account of the fight.
    expect(
      isTheSameEnding(result({ method: "ko_tko" }), result({ method: "disqualification" })),
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
