import { describe, expect, it } from "vitest";
import {
  AMOUNT,
  CANCELLATION_MESSAGES,
  COMBINED_MULTIPLIER_CAP,
  ENTRY_MESSAGES,
  ENTRY_PREDICTIONS,
  cancellationOf,
  isAnswered,
  parseEntry,
  pickAnswered,
  potentialReward,
  priceOf,
  type CommittedEntry,
  type CommittedPrediction,
  type PricedPrediction,
} from "../../shared/entries";
import type { OutcomeAnswer } from "../../shared/pricing";

/**
 * The Entry a fan builds, before any of it reaches the server.
 *
 * Every rule here is one a fan meets while they are still choosing: what a
 * Prediction may be made of, what the Entry pays if it lands, and what the
 * Amount may be. The server asks all of it again, and Postgres asks the ones
 * worth asking twice — this is the half that can answer while a fan is still
 * looking at the card.
 */

const BOUT = "0f6d0f5a-2c0e-4b0a-9d51-6a0a3f0f9c11";
const ANOTHER_BOUT = "3a1f9c2e-8b4d-4f1a-9c62-1b7e5d0a2f34";

const CORNERS = { red: "Giorgi Tsiklauri", blue: "Levan Beridze" };

/** An answer as the card offers one, which is what a fan clicks. */
function answer(overrides: Partial<OutcomeAnswer>): OutcomeAnswer {
  return { question: "winner", corner: "red", method: null, round: null, ...overrides };
}

// Every answer names the fighter it is about (ADR-0015), so each of these is
// about the red corner unless it says otherwise.
const RED = answer({ question: "winner", corner: "red" });
const BLUE = answer({ question: "winner", corner: "blue" });
const KO = answer({ question: "method", method: "ko_tko" });
const SUBMISSION = answer({ question: "method", method: "submission" });
const DECISION = answer({ question: "method", method: "decision" });
const BLUE_BY_KO = answer({ question: "method", corner: "blue", method: "ko_tko" });
const ROUND_TWO = answer({ question: "round", round: 2 });
const ROUND_THREE = answer({ question: "round", round: 3 });
const BLUE_IN_ROUND_TWO = answer({ question: "round", corner: "blue", round: 2 });

/** A Prediction with the Multiplier already frozen onto it (ADR-0002). */
function priced(overrides: Partial<PricedPrediction> = {}): PricedPrediction {
  return { boutId: BOUT, ...RED, multiplier: 1.9, ...overrides };
}

describe("answering one Bout", () => {
  it("starts a Prediction with the answer, which is the whole of one", () => {
    expect(pickAnswered(null, RED)).toEqual(RED);
  });

  it("replaces the answer when a second one is given on the same Bout", () => {
    // An Entry holds one Prediction per Bout (ADR-0014), so a fan who answers
    // again has changed their mind rather than added to it — whether that is
    // the other corner or another Question entirely.
    expect(pickAnswered(RED, BLUE)).toEqual(BLUE);
    expect(pickAnswered(RED, SUBMISSION)).toEqual(SUBMISSION);
    expect(pickAnswered(SUBMISSION, RED)).toEqual(RED);
    expect(pickAnswered(SUBMISSION, ROUND_TWO)).toEqual(ROUND_TWO);
    expect(pickAnswered(ROUND_TWO, KO)).toEqual(KO);

    // The one the card makes easiest to reach now the method Question is on
    // it (#42): six method answers in one column, and moving between two of
    // them is one answer replacing another rather than two being held.
    expect(pickAnswered(KO, SUBMISSION)).toEqual(SUBMISSION);
    expect(pickAnswered(SUBMISSION, DECISION)).toEqual(DECISION);

    // And the same again down the round column #43 puts beside it, which is
    // three to five answers deep: a fan moving from round 2 to round 3 has
    // changed how long they think the Bout lasts, not added a second view.
    expect(pickAnswered(ROUND_TWO, ROUND_THREE)).toEqual(ROUND_THREE);
    expect(pickAnswered(ROUND_THREE, ROUND_TWO)).toEqual(ROUND_TWO);
  });

  it("takes the Bout out of the Entry when the same answer is given twice", () => {
    // The only way to unpick something: there is no separate clear control,
    // and a Prediction with no answer on it is not a Prediction.
    expect(pickAnswered(RED, RED)).toBe(null);
    expect(pickAnswered(SUBMISSION, SUBMISSION)).toBe(null);
    expect(pickAnswered(ROUND_TWO, ROUND_TWO)).toBe(null);
  });

  it("says which answer is the one already given", () => {
    expect(isAnswered(RED, RED)).toBe(true);
    expect(isAnswered(RED, BLUE)).toBe(false);
    expect(isAnswered(KO, KO)).toBe(true);
    expect(isAnswered(KO, DECISION)).toBe(false);
    expect(isAnswered(ROUND_TWO, ROUND_TWO)).toBe(true);
    expect(isAnswered(null, RED)).toBe(false);
  });

  it("tells two answers apart when the only difference is the fighter", () => {
    // The card offers "Tsiklauri by KO/TKO" and "Beridze by KO/TKO" side by
    // side, and a fan who taps the second has changed their answer rather than
    // taken the first one back (ADR-0015).
    expect(isAnswered(KO, BLUE_BY_KO)).toBe(false);
    expect(isAnswered(ROUND_TWO, BLUE_IN_ROUND_TWO)).toBe(false);
    expect(pickAnswered(KO, BLUE_BY_KO)).toEqual(BLUE_BY_KO);
    expect(pickAnswered(ROUND_TWO, BLUE_IN_ROUND_TWO)).toEqual(BLUE_IN_ROUND_TWO);
  });
});

describe("what an Entry returns if every Prediction lands", () => {
  it("is the Amount at the answer's Multiplier, on the simplest Entry there is", () => {
    expect(potentialReward(20, [priced({ multiplier: 1.9 })])).toEqual({
      multiplier: 1.9,
      capped: false,
      reward: 38,
    });
  });

  it("is the same arithmetic whichever Question the Prediction answered", () => {
    // Every Multiplier stands for its own answer outright (ADR-0014), so a
    // method Prediction at ×4.05 is one link worth ×4.05 — there is nothing
    // for it to be conditional on.
    expect(potentialReward(10, [priced({ ...SUBMISSION, multiplier: 4.05 })])).toMatchObject({
      multiplier: 4.05,
      reward: 41,
    });
  });

  it("multiplies the Predictions together across Bouts", () => {
    const chained = [
      priced({ boutId: BOUT, multiplier: 1.9 }),
      priced({ boutId: ANOTHER_BOUT, multiplier: 2.5 }),
    ];

    expect(potentialReward(20, chained)).toMatchObject({ multiplier: 4.75, reward: 95 });
  });

  it("writes the combined Multiplier to the places a Multiplier is stored to", () => {
    // 1.95 × 2.15 is 4.1925, which is not a number anybody can be shown as a
    // Multiplier — and the Reward is worked out from what they were shown.
    const uneven = [
      priced({ boutId: BOUT, multiplier: 1.95 }),
      priced({ boutId: ANOTHER_BOUT, multiplier: 2.15 }),
    ];

    expect(potentialReward(100, uneven)).toEqual({ multiplier: 4.19, capped: false, reward: 419 });
  });

  it("caps the combined Multiplier, and says so", () => {
    const far = Array.from({ length: 5 }, (_, index) =>
      priced({ boutId: `bout-${index}`, multiplier: 3 }),
    );

    // 3^5 is 243, and no Entry pays more than the cap however far it is chained.
    expect(potentialReward(10, far)).toEqual({
      multiplier: COMBINED_MULTIPLIER_CAP,
      capped: true,
      reward: 10 * COMBINED_MULTIPLIER_CAP,
    });
  });

  it("returns whole Coins, because there is no half a Coin to return", () => {
    expect(potentialReward(7, [priced({ multiplier: 1.9 })]).reward).toBe(13);
    expect(potentialReward(5, [priced({ multiplier: 1.9 })]).reward).toBe(10);
  });

  it("pays nothing extra for an Entry nobody has answered anything on", () => {
    expect(potentialReward(20, [])).toEqual({ multiplier: 1, capped: false, reward: 20 });
  });
});

describe("what a Bout is offering on a Prediction", () => {
  /** Some of the fourteen answers a three-round Bout offers, priced. */
  const offered = [
    { ...RED, multiplier: 1.9 },
    { ...BLUE, multiplier: 2.1 },
    { ...KO, multiplier: 2.2 },
    { ...SUBMISSION, multiplier: 3.2 },
    { ...DECISION, multiplier: 2 },
    { ...BLUE_BY_KO, multiplier: 4.6 },
    { ...ROUND_TWO, multiplier: 3.2 },
    { ...BLUE_IN_ROUND_TWO, multiplier: 5.4 },
  ];

  it("prices the one answer the Prediction gave, whichever Question it answered", () => {
    expect(priceOf(BLUE, offered)).toBe(2.1);
    expect(priceOf(KO, offered)).toBe(2.2);
    expect(priceOf(ROUND_TWO, offered)).toBe(3.2);
  });

  it("prices the fighter the answer names, not just the answer", () => {
    // The two corners are priced apart the moment an admin has looked at the
    // matchup (ADR-0015), and pricing one at the other's Multiplier would pay
    // a fan a number nobody offered them.
    expect(priceOf(BLUE_BY_KO, offered)).toBe(4.6);
    expect(priceOf(BLUE_IN_ROUND_TWO, offered)).toBe(5.4);
  });

  it("prices nothing at all when the Bout does not offer that answer", () => {
    // Round 4 of a three-round Bout: the fan was never offered it, and there
    // is no Multiplier to freeze onto a Prediction that claims it.
    expect(priceOf(answer({ question: "round", round: 4 }), offered)).toBe(null);
  });
});

describe("what the panel tells a fan", () => {
  // The panel itself is held by `vue-tsc` and by these functions being the
  // ones it renders from — this repo has no component-test setup, and adding
  // one is a bigger decision than #11. What can be checked here is that the
  // sentences it shows say the thing the criterion asks for.
  it("names the cap when the cap is what decided the Reward", () => {
    expect(ENTRY_MESSAGES.capped).toContain(String(COMBINED_MULTIPLIER_CAP));
  });

  it("confirms an accepted Entry with the Coins committed and the Coins returned", () => {
    expect(ENTRY_MESSAGES.accepted(20, 240)).toContain("20 Coins");
    expect(ENTRY_MESSAGES.accepted(20, 240)).toContain("240 Coins");
    expect(ENTRY_MESSAGES.accepted(1, 2)).toContain("1 Coin ");
  });

  it("says how many Coins a fan holds when they commit more than that", () => {
    expect(ENTRY_MESSAGES.notEnoughCoins(7)).toContain("7 Coins");
  });

  it("says what an Entry is missing before it can be submitted", () => {
    expect(ENTRY_MESSAGES.nothingPicked).toMatch(/answer/i);
    expect(ENTRY_MESSAGES.amount).toMatch(new RegExp(String(AMOUNT.minimum)));
    expect(ENTRY_MESSAGES.tooManyPredictions).toContain(String(ENTRY_PREDICTIONS.maximum));
  });
});

describe("the Entry a fan sends", () => {
  /** An Entry as the page posts one. */
  function submitted(overrides: Record<string, unknown> = {}) {
    return {
      amount: 20,
      predictions: [{ boutId: BOUT, question: "winner", corner: "red" }],
      ...overrides,
    };
  }

  it("reads a whole Entry, with the Questions nobody answered written as nothing", () => {
    expect(parseEntry(submitted())).toEqual({
      entry: {
        amount: 20,
        predictions: [
          { boutId: BOUT, question: "winner", corner: "red", method: null, round: null },
        ],
      },
    });
  });

  it("reads an answer to each of the three Questions, each naming a fighter", () => {
    const answers = [
      { boutId: BOUT, question: "method", corner: "blue", method: "submission" },
      { boutId: ANOTHER_BOUT, question: "round", corner: "red", round: 2 },
    ];

    expect(parseEntry(submitted({ predictions: answers })).entry?.predictions).toEqual([
      { boutId: BOUT, question: "method", corner: "blue", method: "submission", round: null },
      { boutId: ANOTHER_BOUT, question: "round", corner: "red", method: null, round: 2 },
    ]);
  });

  it("refuses a method or a round answer that names no fighter", () => {
    // ADR-0015: every answer is about a corner, and one that names none is not
    // an answer the card ever offered. `predictions_answers_its_question` and
    // the `not null` on the column refuse the same row underneath.
    for (const prediction of [
      { boutId: BOUT, question: "method", method: "submission" },
      { boutId: BOUT, question: "method", corner: null, method: "submission" },
      { boutId: BOUT, question: "round", round: 2 },
      { boutId: BOUT, question: "round", corner: "green", round: 2 },
    ]) {
      expect(parseEntry(submitted({ predictions: [prediction] })).problem).toBe(
        ENTRY_MESSAGES.unreadable,
      );
    }
  });

  it("chains Predictions across different Bouts", () => {
    const chained = submitted({
      predictions: [
        { boutId: BOUT, question: "winner", corner: "red" },
        { boutId: ANOTHER_BOUT, question: "winner", corner: "blue" },
      ],
    });

    expect(parseEntry(chained).entry?.predictions.length).toBe(2);
  });

  it("refuses an Entry with nothing answered on it", () => {
    expect(parseEntry(submitted({ predictions: [] })).problem).toBe(ENTRY_MESSAGES.nothingPicked);
    expect(parseEntry(submitted({ predictions: "all of them" })).problem).toBe(
      ENTRY_MESSAGES.nothingPicked,
    );
    expect(parseEntry(null).problem).toBe(ENTRY_MESSAGES.nothingPicked);
  });

  it("refuses more Predictions than an Entry holds", () => {
    const eleven = Array.from({ length: ENTRY_PREDICTIONS.maximum + 1 }, (_, index) => ({
      boutId: `bout-${index}`,
      question: "winner",
      corner: "red",
    }));

    expect(parseEntry(submitted({ predictions: eleven })).problem).toBe(
      ENTRY_MESSAGES.tooManyPredictions,
    );
  });

  it("refuses two Predictions on one Bout, which is the correlation ADR-0014 rules out", () => {
    // Harder than it reads now that a method answer names a corner: "Tsiklauri
    // by Submission" says everything "Tsiklauri wins" says and more, so an
    // Entry holding both would pay for two answers a fan gave nearly one of
    // (ADR-0015).
    const twice = submitted({
      predictions: [
        { boutId: BOUT, question: "winner", corner: "red" },
        { boutId: BOUT, question: "method", corner: "red", method: "submission" },
      ],
    });

    expect(parseEntry(twice).problem).toBe(ENTRY_MESSAGES.onePredictionPerBout);
  });

  it("refuses a Prediction that answers no Question", () => {
    expect(parseEntry(submitted({ predictions: [{ boutId: BOUT }] })).problem).toBe(
      ENTRY_MESSAGES.unreadable,
    );
    expect(
      parseEntry(submitted({ predictions: [{ boutId: BOUT, question: "the winner" }] })).problem,
    ).toBe(ENTRY_MESSAGES.unreadable);
  });

  it("refuses an answer that is not one the Question asks for", () => {
    for (const prediction of [
      { boutId: BOUT, question: "winner", corner: null },
      { boutId: BOUT, question: "winner", corner: "green" },
      { boutId: BOUT, question: "method", corner: "red", method: null },
      { boutId: BOUT, question: "round", corner: "red", round: null },
    ]) {
      expect(parseEntry(submitted({ predictions: [prediction] })).problem).toBe(
        ENTRY_MESSAGES.unreadable,
      );
    }
  });

  it("refuses a Prediction carrying more than one answer", () => {
    // The rule `predictions_answers_its_question` holds underneath: two
    // answers on one row is a Prediction nothing could grade, because there
    // would be no saying which of them the fan gave.
    for (const prediction of [
      { boutId: BOUT, question: "winner", corner: "red", round: 2 },
      { boutId: BOUT, question: "winner", corner: "red", method: "ko_tko" },
      { boutId: BOUT, question: "method", corner: "red", method: "ko_tko", round: 2 },
      { boutId: BOUT, question: "round", corner: "red", round: 2, method: "ko_tko" },
    ]) {
      expect(parseEntry(submitted({ predictions: [prediction] })).problem).toBe(
        ENTRY_MESSAGES.unreadable,
      );
    }
  });

  it("refuses an Amount that is not a whole number of Coins", () => {
    for (const amount of [0, -5, 1.5, "20", null, Number.NaN]) {
      expect(parseEntry(submitted({ amount })).problem).toBe(ENTRY_MESSAGES.amount);
    }

    expect(parseEntry(submitted({ amount: AMOUNT.minimum })).problem).toBe(undefined);
  });

  it("refuses a Bout that is not named as an id at all", () => {
    expect(
      parseEntry(submitted({ predictions: [{ boutId: 12, question: "winner", corner: "red" }] }))
        .problem,
    ).toBe(ENTRY_MESSAGES.unreadable);
  });

  it("refuses a round that is not a round", () => {
    for (const round of [0, 2.5, "two"]) {
      const wrong = submitted({
        predictions: [{ boutId: BOUT, question: "round", corner: "red", round }],
      });

      expect(parseEntry(wrong).problem).toBe(ENTRY_MESSAGES.unreadable);
    }
  });

  it("refuses a method the game does not ask about", () => {
    // A disqualification is how a Bout can end and is not one of the three
    // answers the method Question offers, so no fan was ever shown it.
    const wrong = submitted({
      predictions: [{ boutId: BOUT, question: "method", method: "disqualification" }],
    });

    expect(parseEntry(wrong).problem).toBe(ENTRY_MESSAGES.unreadable);
  });
});

describe("the Entry a fan takes back", () => {
  const AN_HOUR = 60 * 60 * 1000;
  const NOW = Date.parse("2026-09-12T18:00:00Z");

  /** One Prediction of a submitted Entry, and where its Bout stands. */
  function held(overrides: Partial<CommittedPrediction> = {}): CommittedPrediction {
    return {
      ...priced(),
      cardOrder: 1,
      corners: CORNERS,
      status: "open",
      // An hour out, so the Bout is open until a case says otherwise.
      locksAt: new Date(NOW + AN_HOUR).toISOString(),
      // Nothing has been entered about it, which is every Bout of an Entry a
      // fan could still take back.
      ending: null,
      ...overrides,
    };
  }

  /** An Entry as the fan's own listing shows it back to them. */
  function committed(overrides: Partial<CommittedEntry> = {}): CommittedEntry {
    return {
      id: "0d1a4f8e-6c3b-4a2d-9e17-5f8b0c2a4d63",
      status: "open",
      amount: 20,
      submittedAt: new Date(NOW - AN_HOUR).toISOString(),
      predictions: [held()],
      ...overrides,
    };
  }

  it("lets a fan cancel while every Bout in it is still open", () => {
    const chained = committed({
      predictions: [held({ cardOrder: 1 }), held({ boutId: ANOTHER_BOUT, cardOrder: 2 })],
    });

    expect(cancellationOf(chained, NOW)).toEqual({ cancellable: true });
  });

  it("refuses once one Bout in it has locked, whatever the others are doing", () => {
    const chained = committed({
      predictions: [held({ cardOrder: 1, status: "locked" }), held({ boutId: ANOTHER_BOUT })],
    });

    expect(cancellationOf(chained, NOW)).toEqual({
      cancellable: false,
      reason: CANCELLATION_MESSAGES.boutLocked,
    });
  });

  it("refuses once a Bout's own Lock moment has passed, though the row still says open", () => {
    // The Lock nobody has written down yet: it falls due while nobody is
    // looking, and is applied by the next request to arrive. The Entry stops
    // being cancellable at the moment itself, not at the moment somebody
    // noticed.
    const passed = committed({
      predictions: [held({ locksAt: new Date(NOW - 1000).toISOString() })],
    });

    expect(cancellationOf(passed, NOW)).toMatchObject({ cancellable: false });
    expect(cancellationOf(passed, NOW - 2000)).toMatchObject({ cancellable: true });
  });

  it("refuses an Entry that has already been cancelled", () => {
    expect(cancellationOf(committed({ status: "cancelled" }), NOW)).toEqual({
      cancellable: false,
      reason: CANCELLATION_MESSAGES.alreadyCancelled,
    });
  });

  it("refuses an Entry a Result has already decided", () => {
    for (const status of ["won", "lost"] as const) {
      expect(cancellationOf(committed({ status }), NOW)).toEqual({
        cancellable: false,
        reason: CANCELLATION_MESSAGES.alreadyGraded,
      });
    }
  });

  it("refuses an Entry the game has already made whole, and does not call it graded", () => {
    // Every Bout in it produced nothing gradable, so "this Entry has been
    // graded against what happened" is the one thing that did not happen to
    // it (ADR-0005). Its Coins are back all the same.
    expect(cancellationOf(committed({ status: "refunded" }), NOW)).toEqual({
      cancellable: false,
      reason: CANCELLATION_MESSAGES.alreadyRefunded,
    });
  });

  it("says what cancelling returns, and that it returns all of it", () => {
    expect(CANCELLATION_MESSAGES.cancelled(20)).toContain("20 Coins");
    expect(CANCELLATION_MESSAGES.cancelled(1)).toContain("1 Coin ");
  });
});
