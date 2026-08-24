import { describe, expect, it } from "vitest";
import { contentSurfaceFiles, findBannedTerms } from "../helpers/vocabulary";

/**
 * `CONTEXT.md` bans sportsbook vocabulary outright: this is a free-to-play
 * prediction game, and one stray "bet" in a heading changes what the product
 * legally looks like. The rule is easy to state and easy to forget, so it is
 * checked rather than remembered.
 */
describe("findBannedTerms", () => {
  it("finds a banned term", () => {
    expect(findBannedTerms("Place your bet")).toEqual([{ term: "bet", match: "bet", line: 1 }]);
  });

  it("does not care about case", () => {
    expect(findBannedTerms("The Odds Are Good")).toEqual([
      { term: "odds", match: "Odds", line: 1 },
    ]);
  });

  it("catches the inflections the same word arrives in", () => {
    expect(findBannedTerms("betting").at(0)?.term).toBe("bet");
    expect(findBannedTerms("wagering").at(0)?.term).toBe("wager");
    expect(findBannedTerms("payouts").at(0)?.term).toBe("payout");
    expect(findBannedTerms("voided").at(0)?.term).toBe("void");
  });

  it("leaves innocent words that merely contain a banned one alone", () => {
    expect(findBannedTerms("a mistake in the alphabet, to avoid a slipway")).toEqual([]);
  });

  it("does not read an ordinary word as a banned one wearing a suffix", () => {
    // "better" is "bet" with the doubling English puts before a suffix, and
    // is not the word being banned.
    expect(findBannedTerms("a better slipper than the last one")).toEqual([]);
  });

  it("says which line each one is on", () => {
    expect(findBannedTerms("clean\nyour stake\nclean\nthe payout")).toEqual([
      { term: "stake", match: "stake", line: 2 },
      { term: "payout", match: "payout", line: 4 },
    ]);
  });

  it("passes the approved vocabulary", () => {
    const approved =
      "An Entry holds Predictions. Each Outcome carries a Multiplier, the Amount is " +
      "committed in Coins, and a winning Entry pays a Reward. A No Result Bout is neutral.";

    expect(findBannedTerms(approved)).toEqual([]);
  });
});

describe("the content surface", () => {
  const files = contentSurfaceFiles();

  it("is actually finding files to check", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it("covers the modules that hold copy of their own", () => {
    expect(files.map((file) => file.path)).toContain("app/utils/eligibilityRules.ts");
    expect(files.map((file) => file.path)).toContain("shared/signUp.ts");
  });

  it.each(files.map((file) => [file.path, file.text] as const))(
    "%s uses the approved vocabulary",
    (path, text) => {
      const found = findBannedTerms(text);
      const report = found.map((m) => `${path}:${m.line} — "${m.match}" (banned: ${m.term})`);

      expect(report).toEqual([]);
    },
  );
});
