import { describe, expect, it } from "vitest";
import { SCHEDULED_ROUNDS } from "../../shared/events";
import type { Corner } from "../../shared/events";
import {
  answerLabel,
  CORNERS,
  DEFAULT_MULTIPLIERS,
  defaultOutcomes,
  METHODS,
  MULTIPLIER,
  outcomeLabel,
  outcomeKey,
  parseMultipliers,
  PRICING_MESSAGES,
  QUESTION_LABELS,
  type OutcomeAnswer,
  type Question,
} from "../../shared/pricing";

/**
 * Pricing a Bout: the table every Outcome is seeded from, and what an admin is
 * allowed to change it to.
 *
 * Worth testing on its own because it is what makes pricing a card twenty
 * minutes of work rather than an hour (ADR-0002): an admin adjusts fourteen to
 * eighteen numbers per Bout instead of authoring them from blank, and every
 * card has to be priced before it opens.
 */
describe("the Outcomes a Bout is seeded with", () => {
  it("asks all three Questions of each fighter, in fourteen numbers", () => {
    const seeded = defaultOutcomes(3);

    // Every answer names the corner it is about (ADR-0015), so each of the
    // three Questions is asked of both fighters: two winner Outcomes, six
    // method Outcomes, and two for each scheduled round.
    expect(
      seeded.map((outcome) => [outcome.question, outcome.corner, outcome.method ?? outcome.round]),
    ).toEqual([
      ["winner", "red", null],
      ["winner", "blue", null],
      ["method", "red", "ko_tko"],
      ["method", "red", "submission"],
      ["method", "red", "decision"],
      ["method", "blue", "ko_tko"],
      ["method", "blue", "submission"],
      ["method", "blue", "decision"],
      ["round", "red", 1],
      ["round", "red", 2],
      ["round", "red", 3],
      ["round", "blue", 1],
      ["round", "blue", 2],
      ["round", "blue", 3],
    ]);
  });

  it("asks a five-round Bout the same three Questions in eighteen numbers", () => {
    expect(defaultOutcomes(5).length).toBe(18);
    expect(defaultOutcomes(3).length).toBe(14);
  });

  it("tells two answers apart when the only difference is the fighter", () => {
    // What `outcomeKey` is for: an Entry is priced by matching the answer a
    // fan gave against the answers the Bout offered, and "Tsiklauri by KO/TKO"
    // and "Beridze by KO/TKO" are two answers at two prices.
    const [red, blue] = defaultOutcomes(3).filter(
      (outcome) => outcome.question === "method" && outcome.method === "ko_tko",
    );

    expect(outcomeKey(red!)).not.toBe(outcomeKey(blue!));
    expect(new Set(defaultOutcomes(5).map(outcomeKey)).size).toBe(18);
  });
});

describe("the rounds a Bout offers", () => {
  it("offers a round of victory for each round scheduled and no more", () => {
    const rounds = (scheduledRounds: number, corner: Corner) =>
      defaultOutcomes(scheduledRounds)
        .filter((outcome) => outcome.question === "round" && outcome.corner === corner)
        .map((outcome) => outcome.round);

    // Both fighters, and only the rounds the Bout is actually booked over: a
    // three-round Bout offers no round 4 to either of them.
    expect(rounds(3, "red")).toEqual([1, 2, 3]);
    expect(rounds(3, "blue")).toEqual([1, 2, 3]);
    expect(rounds(5, "red")).toEqual([1, 2, 3, 4, 5]);
    expect(rounds(5, "blue")).toEqual([1, 2, 3, 4, 5]);
  });

  it("seeds every Outcome above 1, so a correct Prediction cannot lose Coins", () => {
    // Both formats TFC books and the deepest a Bout may be scheduled for, so
    // no row is seeded to something an admin would then be refused for typing.
    const seeded = [3, 5, SCHEDULED_ROUNDS.maximum].flatMap((scheduledRounds) =>
      defaultOutcomes(scheduledRounds),
    );

    expect(seeded.every((outcome) => outcome.multiplier > MULTIPLIER.above)).toBe(true);
    expect(seeded.every((outcome) => outcome.multiplier <= MULTIPLIER.maximum)).toBe(true);

    // To the places the column stores, so Postgres rounds nothing on the way in.
    expect(
      seeded.every(
        (outcome) => Number(outcome.multiplier.toFixed(MULTIPLIER.decimals)) === outcome.multiplier,
      ),
    ).toBe(true);
  });
});

describe("what an Outcome is seeded to pay", () => {
  /** Every seeded Multiplier of a Bout, keyed the way an admin reads them. */
  function seeded(scheduledRounds: number): Record<string, number> {
    return Object.fromEntries(
      defaultOutcomes(scheduledRounds).map((outcome) => [outcomeKey(outcome), outcome.multiplier]),
    );
  }

  /**
   * What one corner's answers to one Question are seeded at, in asked order.
   *
   * One corner rather than both, because both are seeded from the same numbers
   * and reading the pair back would say each of them twice. Which corner is
   * arbitrary, and {@link seeded} is where that is proved rather than assumed.
   */
  function pays(question: Question, scheduledRounds: number, corner: Corner = "red"): number[] {
    return defaultOutcomes(scheduledRounds)
      .filter((outcome) => outcome.question === question && outcome.corner === corner)
      .map((outcome) => outcome.multiplier);
  }

  /** The chances a set of Multipliers implies, totalled: 1 ÷ each of them. */
  function implied(multipliers: readonly number[]): number {
    return multipliers.reduce((total, multiplier) => total + 1 / multiplier, 0);
  }

  /** A Question's seeded answers as a whole Bout offers them: both corners. */
  function acrossBothCorners(question: Question, scheduledRounds: number): number[] {
    return CORNERS.flatMap((corner) => pays(question, scheduledRounds, corner));
  }

  it("prices each answer to stand on its own, for the fighter it names", () => {
    // ADR-0014: nothing here is conditional on anything else, so an admin can
    // read one number against one answer. ADR-0015: that answer names a
    // corner, so every number is what one fighter pays.
    expect(seeded(3)).toEqual({
      "winner:red:": 1.9,
      "winner:blue:": 1.9,
      "method:red:ko_tko": 4.4,
      "method:red:submission": 8.1,
      "method:red:decision": 5.3,
      "method:blue:ko_tko": 4.4,
      "method:blue:submission": 8.1,
      "method:blue:decision": 5.3,
      "round:red:1": 6.3,
      "round:red:2": 9.5,
      "round:red:3": 11.4,
      "round:blue:1": 6.3,
      "round:blue:2": 9.5,
      "round:blue:3": 11.4,
    });
  });

  it("seeds the two corners level, because nothing here knows who is favoured", () => {
    // Said of every Question now that every answer names a fighter: the same
    // number against both names, all the way down the Bout.
    expect(pays("winner", 3, "red")).toEqual(pays("winner", 3, "blue"));
    expect(pays("method", 3, "red")).toEqual(pays("method", 3, "blue"));
    expect(pays("round", 5, "red")).toEqual(pays("round", 5, "blue"));

    // And it is level because the table has nothing to be uneven from: three
    // method numbers and one row per format, with no corner in either of them.
    expect(Object.keys(DEFAULT_MULTIPLIERS.method).sort()).toEqual([...METHODS].sort());
    expect(Object.keys(DEFAULT_MULTIPLIERS.round).sort()).toEqual(["3", "5"]);
  });

  it("prices a five-round Bout's rounds from a row of its own", () => {
    expect(pays("round", 5)).toEqual([7.5, 11.9, 17.8, 23.7, 28.5]);
  });

  it("asks a different question of round 3 in each format TFC books", () => {
    // Round 3 ends a three-round Bout and catches everything still standing;
    // on a five-rounder it is a middle round with two more behind it.
    expect(pays("round", 3).at(2)).toBe(11.4);
    expect(pays("round", 5).at(2)).toBe(17.8);
  });

  it("seeds a Bout booked over any other number of rounds from the five-round row", () => {
    // `SCHEDULED_ROUNDS` allows one to twelve as a guard against a stuck key,
    // not because anybody books one.
    expect(pays("round", 4)).toEqual([7.5, 11.9, 17.8, 23.7]);

    // Past the fifth the row has nothing to say, so it repeats its deepest
    // number rather than inventing one. That number is the end of the row it
    // repeats, so it is on the row's terms rather than on terms of its own.
    expect(pays("round", 7)).toEqual([7.5, 11.9, 17.8, 23.7, 28.5, 28.5, 28.5]);
  });

  it("charges the thinnest margin on the Question it already knows the answer to", () => {
    // Read back as chances: 1 ÷ each Multiplier, totalled across a Question
    // and across both corners. 50/50 is known before anybody looks at the
    // fighters, so the winner Question has no estimate to be wrong about;
    // method rests on a prior and carries three more points against that prior
    // being off.
    expect(implied(acrossBothCorners("winner", 3))).toBeCloseTo(1.05, 2);
    expect(implied(acrossBothCorners("method", 3))).toBeCloseTo(1.08, 2);
  });

  it("totals a round Question to the finishes rather than to the whole Bout", () => {
    // About 65% of Bouts at this level end in a finish, and the other 35% end
    // in no round at all. Both formats carry the same prior and the same
    // margin, which is what makes them comparable at all.
    expect(implied(acrossBothCorners("round", 3))).toBeCloseTo(0.7, 2);
    expect(implied(acrossBothCorners("round", 5))).toBeCloseTo(0.7, 2);
  });
});

describe("what one Outcome is called", () => {
  /** The two names a Bout is fought under, which is what every answer names. */
  const corners = { red: "Giorgi Tsiklauri", blue: "Levan Beridze" };

  /** An Outcome's answer as a Bout holds one: a Question, a corner, an answer. */
  function answer(asked: Partial<OutcomeAnswer> & Pick<OutcomeAnswer, "question">): OutcomeAnswer {
    return { corner: "red", method: null, round: null, ...asked };
  }

  it("names the fighter a winner Outcome is a win for", () => {
    expect(outcomeLabel(answer({ question: "winner", corner: "red" }), corners)).toBe(
      "Giorgi Tsiklauri",
    );
    expect(outcomeLabel(answer({ question: "winner", corner: "blue" }), corners)).toBe(
      "Levan Beridze",
    );
  });

  it("names the fighter a method of victory is a victory for", () => {
    // The defect ADR-0015 exists for: "KO/TKO" beside a column of two names
    // read as a KO/TKO for one of them, and never said which.
    expect(outcomeLabel(answer({ question: "method", method: "ko_tko" }), corners)).toBe(
      "Giorgi Tsiklauri by KO/TKO",
    );
    expect(
      outcomeLabel(answer({ question: "method", corner: "blue", method: "submission" }), corners),
    ).toBe("Levan Beridze by Submission");
  });

  it("names the fighter a round of victory is a victory for", () => {
    expect(outcomeLabel(answer({ question: "round", round: 2 }), corners)).toBe(
      "Giorgi Tsiklauri in round 2",
    );
    expect(outcomeLabel(answer({ question: "round", corner: "blue", round: 1 }), corners)).toBe(
      "Levan Beridze in round 1",
    );
  });

  it("calls each Question what it always called it, because the answers name the victor", () => {
    // ADR-0015 changes no Question's name: "Method of victory" was always
    // describing a victory, and it is the answers underneath that changed.
    expect(QUESTION_LABELS).toEqual({
      winner: "Winner",
      method: "Method of victory",
      round: "Round of victory",
    });
  });

  it("names the answer without the fighter, for a screen that has named them already", () => {
    // What the admin pricing screen groups by: fourteen to eighteen inputs a
    // Bout, laid out a corner at a time with the fighter named once above
    // them. The full name is still what a fan reads and what the input is
    // labelled to a screen reader.
    expect(answerLabel(answer({ question: "winner" }))).toBe("Wins");
    expect(answerLabel(answer({ question: "method", method: "ko_tko" }))).toBe("KO/TKO");
    expect(answerLabel(answer({ question: "round", round: 2 }))).toBe("Round 2");
  });

  it("falls back to the Question for an answer that cannot be missing", () => {
    // `outcomes_answers_its_question` is what makes these unreachable. The
    // point of the fallback is that an Outcome quietly renamed to nothing
    // would be a Multiplier with no words beside it.
    expect(outcomeLabel(answer({ question: "method" }), corners)).toBe("Method of victory");
    expect(outcomeLabel(answer({ question: "round" }), corners)).toBe("Round of victory");
    expect(answerLabel(answer({ question: "method" }))).toBe("Method of victory");
    expect(answerLabel(answer({ question: "round" }))).toBe("Round of victory");
  });
});

describe("adjusting a Multiplier", () => {
  const OUTCOME = "0f6d0f5a-2c0e-4b0a-9d51-6a0a3f0f9c11";

  it("reads what an admin typed into each Outcome's Multiplier", () => {
    expect(parseMultipliers({ [OUTCOME]: 2.75 })).toEqual({
      multipliers: [{ outcomeId: OUTCOME, multiplier: 2.75 }],
    });
  });

  it("refuses a Multiplier of 1, which returns a correct Prediction its own Coins", () => {
    const { multipliers, problem } = parseMultipliers({ [OUTCOME]: 1 });

    expect(multipliers).toBeUndefined();
    expect(problem).toBe(PRICING_MESSAGES.multiplier);
  });

  it("refuses a Multiplier below 1, which loses a fan Coins for being right", () => {
    expect(parseMultipliers({ [OUTCOME]: 0.5 }).problem).toBe(PRICING_MESSAGES.multiplier);
    expect(parseMultipliers({ [OUTCOME]: -2 }).problem).toBe(PRICING_MESSAGES.multiplier);
  });

  it("refuses a Multiplier nothing could pay, which is a number typed with a stuck key", () => {
    expect(parseMultipliers({ [OUTCOME]: 190 }).problem).toBe(PRICING_MESSAGES.multiplier);
  });

  it("refuses a Multiplier finer than the two decimal places it is stored to", () => {
    // Postgres would round 1.955 to 1.96 on the way in, leaving an admin
    // looking at a number they did not type.
    expect(parseMultipliers({ [OUTCOME]: 1.955 }).problem).toBe(PRICING_MESSAGES.multiplier);
  });

  it("refuses anything that is not a number", () => {
    expect(parseMultipliers({ [OUTCOME]: "2.75" }).problem).toBe(PRICING_MESSAGES.multiplier);
    expect(parseMultipliers({ [OUTCOME]: null }).problem).toBe(PRICING_MESSAGES.multiplier);
    expect(parseMultipliers({ [OUTCOME]: Number.NaN }).problem).toBe(PRICING_MESSAGES.multiplier);
  });

  it("refuses a save that prices nothing at all", () => {
    expect(parseMultipliers({}).problem).toBe(PRICING_MESSAGES.nothingToPrice);
    expect(parseMultipliers(undefined).problem).toBe(PRICING_MESSAGES.nothingToPrice);
    expect(parseMultipliers("2.75").problem).toBe(PRICING_MESSAGES.nothingToPrice);
  });
});
