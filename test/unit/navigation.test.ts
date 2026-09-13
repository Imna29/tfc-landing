import { describe, expect, it } from "vitest";
import {
  accountPath,
  inPlaySection,
  MARKETING_NAV,
  PLAY_NAV,
  PLAY_SECTION,
  PLAY_TFC,
  returnTo,
  SIGNED_IN_LANDING,
  THE_CARD,
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

/**
 * Where signing in puts a fan down.
 *
 * The card asks a visitor to sign in *before* they answer a Bout, and that
 * advice is only worth taking if signing in brings them back to the card. So a
 * page may name where it wants the fan returned — and the moment a path
 * arrives in a URL, it is somewhere an attacker can write. Every answer here is
 * either a page of this game or the profile.
 */
describe("coming back after signing in", () => {
  it("lands on the fan's own account when nothing asked for them back", () => {
    expect(returnTo(undefined)).toBe(SIGNED_IN_LANDING);
    expect(returnTo(null)).toBe(SIGNED_IN_LANDING);
    expect(returnTo("")).toBe(SIGNED_IN_LANDING);
  });

  it("comes back to the card when the card is what asked", () => {
    expect(returnTo(THE_CARD)).toBe(THE_CARD);
    expect(returnTo("/leaderboard")).toBe("/leaderboard");
    expect(returnTo("/standings/a-season")).toBe("/standings/a-season");
  });

  it("refuses somewhere that is not this site at all", () => {
    // The whole reason this is a function rather than a `route.query.next`
    // read: a link mailed to a fan must not be able to land them on a form
    // wearing TFC's chrome.
    expect(returnTo("https://example.com/sign-in")).toBe(SIGNED_IN_LANDING);
    expect(returnTo("http://example.com")).toBe(SIGNED_IN_LANDING);
    expect(returnTo("javascript:alert(1)")).toBe(SIGNED_IN_LANDING);
  });

  it("refuses a protocol-relative path, which reads as a path and is not one", () => {
    expect(returnTo("//example.com/predictions")).toBe(SIGNED_IN_LANDING);
  });

  it("refuses a backslash, which some browsers read as the other slash", () => {
    expect(returnTo("/\\example.com")).toBe(SIGNED_IN_LANDING);
    expect(returnTo("\\\\example.com")).toBe(SIGNED_IN_LANDING);
  });

  it("refuses a page outside the game, however much it is this site", () => {
    // Nothing on the marketing site asks a fan to sign in, so nothing there
    // has a reason to be returned to — and an allow-list of the pages the
    // game is played on is the narrowest rule that covers every real case.
    expect(returnTo("/events")).toBe(SIGNED_IN_LANDING);
    expect(returnTo("/")).toBe(SIGNED_IN_LANDING);
  });

  it("refuses the account pages themselves, which would be a loop", () => {
    expect(returnTo("/account/sign-in")).toBe(SIGNED_IN_LANDING);
    expect(returnTo("/account/sign-up")).toBe(SIGNED_IN_LANDING);
  });

  it("refuses a second spelling of a path the game is played on", () => {
    // Routes are matched case-sensitively (ADR-0012), so `/PREDICTIONS` is a
    // 404 rather than the card — returning a fan to it would be returning them
    // to nothing.
    expect(returnTo("/PREDICTIONS")).toBe(SIGNED_IN_LANDING);
  });

  it("refuses a path carrying anything but a path", () => {
    expect(returnTo("/predictions?next=https://example.com")).toBe(SIGNED_IN_LANDING);
  });
});

describe("the way to an account from a page that wants the fan back", () => {
  it("names the page to come back to", () => {
    expect(accountPath("sign-in", THE_CARD)).toBe("/account/sign-in?next=%2Fpredictions");
    expect(accountPath("sign-up", THE_CARD)).toBe("/account/sign-up?next=%2Fpredictions");
  });

  it("builds a link the guard above then accepts", () => {
    // The two halves have to agree: a link this writes and `returnTo` refuses
    // would be a fan told to sign in and dropped on their profile.
    const asked = new URL(accountPath("sign-in", THE_CARD), "https://tfc.example");

    expect(returnTo(asked.searchParams.get("next"))).toBe(THE_CARD);
  });

  it("lands inside the game, because the account is part of it", () => {
    expect(inPlaySection(accountPath("sign-in", THE_CARD).split("?")[0] ?? "")).toBe(true);
  });
});
