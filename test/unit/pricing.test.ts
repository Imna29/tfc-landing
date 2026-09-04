import { describe, expect, it } from "vitest";
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
 * Worth testing on its own because it is what makes pricing a card minutes of
 * work rather than an hour (ADR-0002): an admin adjusts eight numbers per Bout
 * instead of authoring them from blank, and every card has to be priced before
 * it opens.
 */
describe("the Outcomes a Bout is seeded with", () => {
  it("asks both Questions of each fighter, in eight numbers", () => {
    const seeded = defaultOutcomes();

    // Every answer names the corner it is about (ADR-0015), so each of the two
    // Questions the game asks (ADR-0016) is asked of both fighters: two winner
    // Outcomes and six method Outcomes.
    expect(seeded.map((outcome) => [outcome.question, outcome.corner, outcome.method])).toEqual([
      ["winner", "red", null],
      ["winner", "blue", null],
      ["method", "red", "ko_tko"],
      ["method", "red", "submission"],
      ["method", "red", "decision"],
      ["method", "blue", "ko_tko"],
      ["method", "blue", "submission"],
      ["method", "blue", "decision"],
    ]);
  });

  it("asks a Bout the same eight things however many rounds it is booked over", () => {
    // The round of victory is not a Question the game asks (ADR-0016), so how
    // long a Bout is scheduled for no longer decides what it offers. It is a
    // fact about the fight a fan reads on the card and nothing prices.
    expect(defaultOutcomes().length).toBe(8);
  });

  it("tells two answers apart when the only difference is the fighter", () => {
    // What `outcomeKey` is for: an Entry is priced by matching the answer a
    // fan gave against the answers the Bout offered, and "Tsiklauri by KO/TKO"
    // and "Beridze by KO/TKO" are two answers at two prices.
    const [red, blue] = defaultOutcomes().filter(
      (outcome) => outcome.question === "method" && outcome.method === "ko_tko",
    );

    expect(outcomeKey(red!)).not.toBe(outcomeKey(blue!));
    expect(new Set(defaultOutcomes().map(outcomeKey)).size).toBe(8);
  });

  it("seeds every Outcome above 1, so a correct Prediction cannot lose Coins", () => {
    const seeded = defaultOutcomes();

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
  function seeded(): Record<string, number> {
    return Object.fromEntries(
      defaultOutcomes().map((outcome) => [outcomeKey(outcome), outcome.multiplier]),
    );
  }

  /**
   * What one corner's answers to one Question are seeded at, in asked order.
   *
   * One corner rather than both, because both are seeded from the same numbers
   * and reading the pair back would say each of them twice. Which corner is
   * arbitrary, and {@link seeded} is where that is proved rather than assumed.
   */
  function pays(question: Question, corner: Corner = "red"): number[] {
    return defaultOutcomes()
      .filter((outcome) => outcome.question === question && outcome.corner === corner)
      .map((outcome) => outcome.multiplier);
  }

  /** The chances a set of Multipliers implies, totalled: 1 ÷ each of them. */
  function implied(multipliers: readonly number[]): number {
    return multipliers.reduce((total, multiplier) => total + 1 / multiplier, 0);
  }

  /** A Question's seeded answers as a whole Bout offers them: both corners. */
  function acrossBothCorners(question: Question): number[] {
    return CORNERS.flatMap((corner) => pays(question, corner));
  }

  it("prices each answer to stand on its own, for the fighter it names", () => {
    // ADR-0014: nothing here is conditional on anything else, so an admin can
    // read one number against one answer. ADR-0015: that answer names a
    // corner, so every number is what one fighter pays.
    expect(seeded()).toEqual({
      "winner:red:": 1.9,
      "winner:blue:": 1.9,
      "method:red:ko_tko": 4.4,
      "method:red:submission": 8.1,
      "method:red:decision": 5.3,
      "method:blue:ko_tko": 4.4,
      "method:blue:submission": 8.1,
      "method:blue:decision": 5.3,
    });
  });

  it("seeds the two corners level, because nothing here knows who is favoured", () => {
    // Said of both Questions now that every answer names a fighter: the same
    // number against both names, all the way down the Bout.
    expect(pays("winner", "red")).toEqual(pays("winner", "blue"));
    expect(pays("method", "red")).toEqual(pays("method", "blue"));

    // And it is level because the table has nothing to be uneven from: three
    // method numbers with no corner in them.
    expect(Object.keys(DEFAULT_MULTIPLIERS.method).sort()).toEqual([...METHODS].sort());
  });

  it("charges the thinnest margin on the Question it already knows the answer to", () => {
    // Read back as chances: 1 ÷ each Multiplier, totalled across a Question
    // and across both corners. 50/50 is known before anybody looks at the
    // fighters, so the winner Question has no estimate to be wrong about;
    // method rests on a prior and carries three more points against that prior
    // being off.
    expect(implied(acrossBothCorners("winner"))).toBeCloseTo(1.05, 2);
    expect(implied(acrossBothCorners("method"))).toBeCloseTo(1.08, 2);
  });

  it("prices the method Question over every way a Bout can end with a winner", () => {
    // The three methods are exhaustive of a gradable ending, which is what
    // lets the Question's implied total be read as the whole Bout plus a
    // margin. Nothing is missing from it now that no round is priced beside
    // it: a round was never part of this total (ADR-0016).
    expect(pays("method")).toEqual([4.4, 8.1, 5.3]);
  });
});

describe("what one Outcome is called", () => {
  /** The two names a Bout is fought under, which is what every answer names. */
  const corners = { red: "Giorgi Tsiklauri", blue: "Levan Beridze" };

  /** An Outcome's answer as a Bout holds one: a Question, a corner, an answer. */
  function answer(asked: Partial<OutcomeAnswer> & Pick<OutcomeAnswer, "question">): OutcomeAnswer {
    return { corner: "red", method: null, ...asked };
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

  it("calls each Question what it always called it, because the answers name the victor", () => {
    // ADR-0015 changes no Question's name: "Method of victory" was always
    // describing a victory, and it is the answers underneath that changed.
    // ADR-0016 takes a Question away rather than renaming one.
    expect(QUESTION_LABELS).toEqual({
      winner: "Winner",
      method: "Method of victory",
    });
  });

  it("names the answer without the fighter, for a screen that has named them already", () => {
    // What the admin pricing screen groups by: eight inputs a Bout, laid out a
    // corner at a time with the fighter named once above them. The full name
    // is still what a fan reads and what the input is labelled to a screen
    // reader.
    expect(answerLabel(answer({ question: "winner" }))).toBe("Wins");
    expect(answerLabel(answer({ question: "method", method: "ko_tko" }))).toBe("KO/TKO");
  });

  it("falls back to the Question for an answer that cannot be missing", () => {
    // `outcomes_answers_its_question` is what makes these unreachable. The
    // point of the fallback is that an Outcome quietly renamed to nothing
    // would be a Multiplier with no words beside it.
    expect(outcomeLabel(answer({ question: "method" }), corners)).toBe("Method of victory");
    expect(answerLabel(answer({ question: "method" }))).toBe("Method of victory");
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
