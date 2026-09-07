import { describe, expect, it } from "vitest";
import {
  inPlaySection,
  MARKETING_NAV,
  PLAY_NAV,
  PLAY_SECTION,
  PLAY_TFC,
} from "../../app/utils/navigation";

/**
 * The site is two sites: the marketing one TFC publishes, and the game a fan
 * plays. This module is where that line is drawn, and these are the rules it
 * has to keep — a link that crosses it is how the two quietly become one
 * again.
 */
describe("the way into the game", () => {
  it("is one button, and it lands inside the section", () => {
    expect(PLAY_TFC.label).toBe("PlayTFC");
    expect(inPlaySection(PLAY_TFC.to)).toBe(true);
  });

  it("lands on the card, because that is what a fan came to play", () => {
    expect(PLAY_TFC.to).toBe("/predictions");
  });
});

describe("the marketing navigation", () => {
  it("points at no part of the game", () => {
    // The whole brief in one assertion: the marketing site is what TFC is,
    // and the game is reached through the one button rather than sprinkled
    // through the header beside Events and Fighters.
    const inside = MARKETING_NAV.filter((link) => inPlaySection(link.to));

    expect(inside).toEqual([]);
  });

  it("still reaches everything the marketing site is", () => {
    expect(MARKETING_NAV.map((link) => link.to)).toEqual([
      "/events",
      "/fighters",
      "/media",
      "/about",
    ]);
  });
});

describe("the play navigation", () => {
  it("never leaves the section it navigates", () => {
    const outside = PLAY_NAV.filter((link) => !inPlaySection(link.to));

    expect(outside).toEqual([]);
  });

  it("carries the card and the board it is climbed on", () => {
    // Two since ADR-0018 retired the prizes and contest rules pages. The
    // Season's deadline and the Seasons that have ended are both reachable
    // from the leaderboard, so neither needs a nav item of its own.
    expect(PLAY_NAV.map((link) => link.to)).toEqual(["/predictions", "/leaderboard"]);
  });

  it("names each of them, because a nav item with no label is not one", () => {
    for (const link of PLAY_NAV) expect(link.label.length).toBeGreaterThan(0);
  });
});

describe("what counts as being in the section", () => {
  it("counts the paths the game is played on", () => {
    for (const path of PLAY_SECTION) expect(inPlaySection(path)).toBe(true);
  });

  it("counts a page underneath one of them", () => {
    expect(inPlaySection("/standings/a-season")).toBe(true);
    expect(inPlaySection("/account/sign-in")).toBe(true);
  });

  it("does not count a path that merely starts with the same letters", () => {
    // `/predictions-explained` is a marketing page somebody may well write,
    // and a `startsWith` that swallowed it would put the marketing header's
    // own page inside the game.
    expect(inPlaySection("/predictions-explained")).toBe(false);
    expect(inPlaySection("/leaderboards-of-other-sports")).toBe(false);
  });

  it("does not count the marketing site", () => {
    expect(inPlaySection("/")).toBe(false);
    expect(inPlaySection("/events")).toBe(false);
    expect(inPlaySection("/fighters/giorgi-tsiklauri")).toBe(false);
  });
});
