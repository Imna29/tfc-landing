import { describe, expect, it } from "vitest";
import { STANDING_MESSAGES, rankLabel } from "../../shared/standings";

/**
 * Where a fan stands in the Season being played.
 *
 * Only the words are decided here. The Rank itself is an ordering of the
 * materialised Balance and belongs to Postgres — `server/utils/standings.ts`
 * asks for it and `test/server/history.test.ts` holds it to what the ledger
 * says.
 */
describe("a Rank as a fan reads it", () => {
  it("writes the ordinal English puts on a number", () => {
    expect(rankLabel(1)).toBe("1st");
    expect(rankLabel(2)).toBe("2nd");
    expect(rankLabel(3)).toBe("3rd");
    expect(rankLabel(4)).toBe("4th");
  });

  it("knows the teens are not the ordinals their last digit suggests", () => {
    expect(rankLabel(11)).toBe("11th");
    expect(rankLabel(12)).toBe("12th");
    expect(rankLabel(13)).toBe("13th");
  });

  it("keeps counting past them", () => {
    expect(rankLabel(21)).toBe("21st");
    expect(rankLabel(102)).toBe("102nd");
    expect(rankLabel(113)).toBe("113th");
    expect(rankLabel(340)).toBe("340th");
  });
});

describe("what a standing tells a fan", () => {
  it("says where they are out of how many", () => {
    expect(STANDING_MESSAGES.ranked(12, 340)).toContain("12th");
    expect(STANDING_MESSAGES.ranked(12, 340)).toContain("340");
  });

  it("has something to say to a fan who is not ranked yet", () => {
    expect(STANDING_MESSAGES.unranked).not.toBe("");
  });

  it("has something to say between Seasons", () => {
    expect(STANDING_MESSAGES.noSeason).not.toBe("");
  });
});
