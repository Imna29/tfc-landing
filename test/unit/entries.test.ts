import { describe, expect, it } from "vitest";
import {
  AMOUNT,
  CANCELLATION_MESSAGES,
  COMBINED_MULTIPLIER_CAP,
  ENTRY_MESSAGES,
  ENTRY_PREDICTIONS,
  canAnswer,
  cancellationOf,
  isAnswered,
  parseEntry,
  pickAnswered,
  potentialReward,
  predictionLabel,
  priceOf,
  type BoutPick,
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
  return { question: "winner", corner: null, method: null, round: null, ...overrides };
}

const RED = answer({ question: "winner", corner: "red" });
const BLUE = answer({ question: "winner", corner: "blue" });
const KO = answer({ question: "method", method: "ko_tko" });
const SUBMISSION = answer({ question: "method", method: "submission" });
const DECISION = answer({ question: "method", method: "decision" });
const ROUND_TWO = answer({ question: "round", round: 2 });

/** A Prediction with the Multipliers already frozen onto it (ADR-0002). */
function priced(overrides: Partial<PricedPrediction> = {}): PricedPrediction {
  return {
    boutId: BOUT,
    corner: "red",
    method: null,
    round: null,
    winnerMultiplier: 1.9,
    methodMultiplier: null,
    roundMultiplier: null,
    ...overrides,
  };
}

describe("answering one Bout", () => {
  it("starts a Prediction with the winner, which is the answer it cannot do without", () => {
    expect(pickAnswered(null, RED)).toEqual({ corner: "red", method: null, round: null });
  });

  it("deepens that pick with a method and a round", () => {
    const winner = pickAnswered(null, RED);
    const byKo = pickAnswered(winner, KO);

    expect(byKo).toEqual({ corner: "red", method: "ko_tko", round: null });
    expect(pickAnswered(byKo, ROUND_TWO)).toEqual({
      corner: "red",
      method: "ko_tko",
      round: 2,
    });
  });

  it("takes the Bout out of the Entry when the winner is unpicked", () => {
    // The winner is what a Prediction is: without one there is nothing left to
    // hold a method or a round.
    const byKo = pickAnswered(pickAnswered(null, RED), KO);

    expect(pickAnswered(byKo, RED)).toBe(null);
  });

  it("keeps the read on how it ends when the fan changes their mind about who wins", () => {
    const byKo = pickAnswered(pickAnswered(null, RED), KO);

    expect(pickAnswered(byKo, BLUE)).toEqual({ corner: "blue", method: "ko_tko", round: null });
  });

  it("drops a chosen round when the method becomes a Decision", () => {
    // ADR-0004: a Decision is the Bout going the distance, so there is no
    // round it ends in. Refusing the click would leave a fan looking at a
    // Prediction they cannot submit and no way to see why.
    const inRoundTwo = pickAnswered(pickAnswered(pickAnswered(null, RED), KO), ROUND_TWO);

    expect(pickAnswered(inRoundTwo, DECISION)).toEqual({
      corner: "red",
      method: "decision",
      round: null,
    });
  });

  it("drops the round with the method it belonged to", () => {
    const inRoundTwo = pickAnswered(pickAnswered(pickAnswered(null, RED), KO), ROUND_TWO);

    expect(pickAnswered(inRoundTwo, KO)).toEqual({ corner: "red", method: null, round: null });
  });

  it("unpicks a round on its own", () => {
    const inRoundTwo = pickAnswered(pickAnswered(pickAnswered(null, RED), SUBMISSION), ROUND_TWO);

    expect(pickAnswered(inRoundTwo, ROUND_TWO)).toEqual({
      corner: "red",
      method: "submission",
      round: null,
    });
  });
});

describe("what a fan may answer next", () => {
  it("offers a winner on a Bout nothing has been answered on", () => {
    expect(canAnswer(null, RED)).toBe(true);
  });

  it("offers no method until there is a winner to deepen", () => {
    expect(canAnswer(null, KO)).toBe(false);
    expect(canAnswer({ corner: "red", method: null, round: null }, KO)).toBe(true);
  });

  it("offers a round only alongside a finish", () => {
    // ADR-0004 again, as the card shows it: the rounds are unanswerable until
    // the fan has said the Bout ends inside one.
    expect(canAnswer({ corner: "red", method: null, round: null }, ROUND_TWO)).toBe(false);
    expect(canAnswer({ corner: "red", method: "decision", round: null }, ROUND_TWO)).toBe(false);
    expect(canAnswer({ corner: "red", method: "ko_tko", round: null }, ROUND_TWO)).toBe(true);
    expect(canAnswer({ corner: "red", method: "submission", round: null }, ROUND_TWO)).toBe(true);
  });

  it("says which answers are the ones already given", () => {
    const pick: BoutPick = { corner: "red", method: "ko_tko", round: 2 };

    expect(isAnswered(pick, RED)).toBe(true);
    expect(isAnswered(pick, BLUE)).toBe(false);
    expect(isAnswered(pick, KO)).toBe(true);
    expect(isAnswered(pick, DECISION)).toBe(false);
    expect(isAnswered(pick, ROUND_TWO)).toBe(true);
    expect(isAnswered(null, RED)).toBe(false);
  });
});

describe("what an Entry returns if every Prediction lands", () => {
  it("is the Amount at the winner's Multiplier, on the simplest Entry there is", () => {
    expect(potentialReward(20, [priced({ winnerMultiplier: 1.9 })])).toEqual({
      multiplier: 1.9,
      capped: false,
      reward: 38,
    });
  });

  it("multiplies the method and the round onto the winner, rather than beside it", () => {
    // ADR-0004: deepening a Prediction is not another link in the chain, and
    // the method is priced knowing it is multiplied onto a winner pick.
    const deepened = priced({
      method: "ko_tko",
      round: 2,
      winnerMultiplier: 2,
      methodMultiplier: 2.2,
      roundMultiplier: 3,
    });

    expect(potentialReward(10, [deepened])).toMatchObject({ multiplier: 13.2, reward: 132 });
  });

  it("multiplies the Predictions together across Bouts", () => {
    const chained = [
      priced({ boutId: BOUT, winnerMultiplier: 1.9 }),
      priced({ boutId: ANOTHER_BOUT, winnerMultiplier: 2.5 }),
    ];

    expect(potentialReward(20, chained)).toMatchObject({ multiplier: 4.75, reward: 95 });
  });

  it("writes the combined Multiplier to the places a Multiplier is stored to", () => {
    // 1.95 × 2.15 is 4.1925, which is not a number anybody can be shown as a
    // Multiplier — and the Reward is worked out from what they were shown.
    const uneven = [
      priced({ boutId: BOUT, winnerMultiplier: 1.95 }),
      priced({ boutId: ANOTHER_BOUT, winnerMultiplier: 2.15 }),
    ];

    expect(potentialReward(100, uneven)).toEqual({ multiplier: 4.19, capped: false, reward: 419 });
  });

  it("caps the combined Multiplier, and says so", () => {
    const far = Array.from({ length: 5 }, (_, index) =>
      priced({ boutId: `bout-${index}`, winnerMultiplier: 3 }),
    );

    // 3^5 is 243, and no Entry pays more than the cap however far it is chained.
    expect(potentialReward(10, far)).toEqual({
      multiplier: COMBINED_MULTIPLIER_CAP,
      capped: true,
      reward: 10 * COMBINED_MULTIPLIER_CAP,
    });
  });

  it("returns whole Coins, because there is no half a Coin to return", () => {
    expect(potentialReward(7, [priced({ winnerMultiplier: 1.9 })]).reward).toBe(13);
    expect(potentialReward(5, [priced({ winnerMultiplier: 1.9 })]).reward).toBe(10);
  });

  it("pays nothing extra for an Entry nobody has answered anything on", () => {
    expect(potentialReward(20, [])).toEqual({ multiplier: 1, capped: false, reward: 20 });
  });
});

describe("what a Bout is offering on a Prediction", () => {
  /** The eight answers a three-round Bout offers, priced. */
  const offered = [
    { ...RED, multiplier: 1.9 },
    { ...BLUE, multiplier: 2.1 },
    { ...KO, multiplier: 2.2 },
    { ...SUBMISSION, multiplier: 3.2 },
    { ...DECISION, multiplier: 2 },
    { ...ROUND_TWO, multiplier: 3.2 },
  ];

  it("prices each answer the Prediction is made of", () => {
    expect(priceOf({ corner: "blue", method: "ko_tko", round: 2 }, offered)).toEqual({
      winnerMultiplier: 2.1,
      methodMultiplier: 2.2,
      roundMultiplier: 3.2,
    });
  });

  it("leaves the answers nobody gave unpriced, because there is nothing to pay for", () => {
    expect(priceOf({ corner: "red", method: null, round: null }, offered)).toEqual({
      winnerMultiplier: 1.9,
      methodMultiplier: null,
      roundMultiplier: null,
    });
  });

  it("prices nothing at all when the Bout does not offer one of the answers", () => {
    // Round 4 of a three-round Bout: the fan was never offered it, and there
    // is no Multiplier to freeze onto a Prediction that claims it.
    expect(priceOf({ corner: "red", method: "ko_tko", round: 4 }, offered)).toBe(null);
  });
});

describe("what a Prediction says, in words", () => {
  it("names the fighter on a winner-only Prediction", () => {
    expect(predictionLabel({ corner: "red", method: null, round: null }, CORNERS)).toBe(
      "Giorgi Tsiklauri",
    );
  });

  it("reads out the whole compound answer", () => {
    expect(predictionLabel({ corner: "blue", method: "ko_tko", round: 2 }, CORNERS)).toBe(
      "Levan Beridze by KO/TKO in round 2",
    );
  });

  it("leaves the round off a Decision, which has none", () => {
    expect(predictionLabel({ corner: "red", method: "decision", round: null }, CORNERS)).toBe(
      "Giorgi Tsiklauri by Decision",
    );
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
    expect(ENTRY_MESSAGES.nothingPicked).toMatch(/winner/i);
    expect(ENTRY_MESSAGES.amount).toMatch(new RegExp(String(AMOUNT.minimum)));
    expect(ENTRY_MESSAGES.tooManyPredictions).toContain(String(ENTRY_PREDICTIONS.maximum));
  });
});

describe("the Entry a fan sends", () => {
  /** An Entry as the page posts one. */
  function submitted(overrides: Record<string, unknown> = {}) {
    return {
      amount: 20,
      predictions: [{ boutId: BOUT, corner: "red", method: "ko_tko", round: 2 }],
      ...overrides,
    };
  }

  it("reads a whole Entry, with the answers nobody gave written as nothing", () => {
    expect(parseEntry(submitted({ predictions: [{ boutId: BOUT, corner: "blue" }] }))).toEqual({
      entry: {
        amount: 20,
        predictions: [{ boutId: BOUT, corner: "blue", method: null, round: null }],
      },
    });
  });

  it("chains Predictions across different Bouts", () => {
    const chained = submitted({
      predictions: [
        { boutId: BOUT, corner: "red" },
        { boutId: ANOTHER_BOUT, corner: "blue", method: "decision" },
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
      corner: "red",
    }));

    expect(parseEntry(submitted({ predictions: eleven })).problem).toBe(
      ENTRY_MESSAGES.tooManyPredictions,
    );
  });

  it("refuses two Predictions on one Bout, which is the correlation ADR-0004 rules out", () => {
    const twice = submitted({
      predictions: [
        { boutId: BOUT, corner: "red", method: "ko_tko" },
        { boutId: BOUT, corner: "red", method: "submission" },
      ],
    });

    expect(parseEntry(twice).problem).toBe(ENTRY_MESSAGES.onePredictionPerBout);
  });

  it("refuses a Prediction with nobody picked to win it", () => {
    expect(parseEntry(submitted({ predictions: [{ boutId: BOUT }] })).problem).toBe(
      ENTRY_MESSAGES.unreadable,
    );
    expect(
      parseEntry(submitted({ predictions: [{ boutId: BOUT, corner: "green" }] })).problem,
    ).toBe(ENTRY_MESSAGES.unreadable);
  });

  it("refuses a round alongside a Decision, which cannot both happen", () => {
    const impossible = submitted({
      predictions: [{ boutId: BOUT, corner: "red", method: "decision", round: 2 }],
    });

    expect(parseEntry(impossible).problem).toBe(ENTRY_MESSAGES.roundNeedsAFinish);
  });

  it("refuses a round with no method at all, which nothing could grade", () => {
    const ungradable = submitted({
      predictions: [{ boutId: BOUT, corner: "red", round: 2 }],
    });

    expect(parseEntry(ungradable).problem).toBe(ENTRY_MESSAGES.roundNeedsAFinish);
  });

  it("refuses an Amount that is not a whole number of Coins", () => {
    for (const amount of [0, -5, 1.5, "20", null, Number.NaN]) {
      expect(parseEntry(submitted({ amount })).problem).toBe(ENTRY_MESSAGES.amount);
    }

    expect(parseEntry(submitted({ amount: AMOUNT.minimum })).problem).toBe(undefined);
  });

  it("refuses a Bout that is not named as an id at all", () => {
    expect(parseEntry(submitted({ predictions: [{ boutId: 12, corner: "red" }] })).problem).toBe(
      ENTRY_MESSAGES.unreadable,
    );
  });

  it("refuses a round that is not a round", () => {
    for (const round of [0, 2.5, "two"]) {
      const wrong = submitted({
        predictions: [{ boutId: BOUT, corner: "red", method: "ko_tko", round }],
      });

      expect(parseEntry(wrong).problem).toBe(ENTRY_MESSAGES.unreadable);
    }
  });

  it("refuses a method the game does not ask about", () => {
    const wrong = submitted({
      predictions: [{ boutId: BOUT, corner: "red", method: "disqualification" }],
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

  it("says what cancelling returns, and that it returns all of it", () => {
    expect(CANCELLATION_MESSAGES.cancelled(20)).toContain("20 Coins");
    expect(CANCELLATION_MESSAGES.cancelled(1)).toContain("1 Coin ");
  });
});
