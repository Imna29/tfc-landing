import { describe, expect, it } from "vitest";
import { SCHEDULED_ROUNDS } from "../../shared/events";
import {
  defaultOutcomes,
  MULTIPLIER,
  parseMultipliers,
  PRICING_MESSAGES,
} from "../../shared/pricing";

/**
 * Pricing a Bout: the table every Outcome is seeded from, and what an admin is
 * allowed to change it to.
 *
 * Worth testing on its own because it is what makes pricing a card ten minutes
 * of work rather than an hour (ADR-0002): an admin adjusts eight numbers per
 * Bout instead of authoring them from blank, and every card has to be priced
 * before it opens.
 */
describe("the Outcomes a Bout is seeded with", () => {
  it("asks all three Questions of a three-round Bout in eight numbers", () => {
    const seeded = defaultOutcomes(3);

    expect(
      seeded.map((outcome) => [outcome.question, outcome.corner ?? outcome.method ?? outcome.round]),
    ).toEqual([
      ["winner", "red"],
      ["winner", "blue"],
      ["method", "ko_tko"],
      ["method", "submission"],
      ["method", "decision"],
      ["round", 1],
      ["round", 2],
      ["round", 3],
    ]);
  });
});

describe("the rounds a Bout offers", () => {
  it("offers a round of victory for each round scheduled and no more", () => {
    const threeRounder = defaultOutcomes(3).filter((outcome) => outcome.question === "round");
    const fiveRounder = defaultOutcomes(5).filter((outcome) => outcome.question === "round");

    expect(threeRounder.map((outcome) => outcome.round)).toEqual([1, 2, 3]);
    expect(fiveRounder.map((outcome) => outcome.round)).toEqual([1, 2, 3, 4, 5]);
  });

  it("seeds every Outcome above 1, so a correct Prediction cannot lose Coins", () => {
    const seeded = defaultOutcomes(SCHEDULED_ROUNDS.maximum);

    expect(seeded.every((outcome) => outcome.multiplier > MULTIPLIER.above)).toBe(true);
    expect(seeded.every((outcome) => outcome.multiplier <= MULTIPLIER.maximum)).toBe(true);
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
