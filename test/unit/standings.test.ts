import { describe, expect, it } from "vitest";
import {
  LEADERBOARD_MESSAGES,
  STANDING_MESSAGES,
  rankLabel,
  whereYouStand,
  type Leaderboard,
  type LeaderboardPlace,
} from "../../shared/standings";

/**
 * Where a fan stands in the Season being played, and where everybody else
 * does.
 *
 * Only the words and the reading are decided here. The Rank itself is an
 * ordering of the materialised Balance and belongs to Postgres —
 * `server/utils/standings.ts` asks for it, `test/server/history.test.ts` holds
 * one fan's own to what the ledger says, and `test/server/leaderboard.test.ts`
 * holds the page of them to the same thing.
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

describe("where the fan reading the leaderboard stands on it", () => {
  function place(overrides: Partial<LeaderboardPlace> = {}): LeaderboardPlace {
    return {
      rank: 1,
      username: "ironmike",
      balance: 100,
      entriesPlayed: 0,
      you: false,
      ...overrides,
    };
  }

  function board(overrides: Partial<Leaderboard> = {}): Leaderboard {
    return {
      season: { name: "Season 1" },
      top: [place()],
      you: null,
      fans: 340,
      ...overrides,
    };
  }

  it("pins a fan outside the top ten below it, and says where they are", () => {
    const you = place({ rank: 42, username: "you", you: true });
    const standing = whereYouStand(board({ you }), true, LEADERBOARD_MESSAGES);

    expect(standing.pinned).toBe(you);
    expect(standing.note).toBe(STANDING_MESSAGES.ranked(42, 340));
  });

  it("pins nothing for a fan already in the top ten, and still says where", () => {
    // The row is up there with everybody else's, marked as theirs. Pinning a
    // second copy under it would be the same fan twice on one page.
    const listed = board({ top: [place({ rank: 3, username: "you", you: true })] });
    const standing = whereYouStand(listed, true, LEADERBOARD_MESSAGES);

    expect(standing.pinned).toBeNull();
    expect(standing.note).toBe(STANDING_MESSAGES.ranked(3, 340));
  });

  it("tells a fan holding no Coins in the Season that they are not in it yet", () => {
    expect(whereYouStand(board(), true, LEADERBOARD_MESSAGES)).toEqual({
      pinned: null,
      note: STANDING_MESSAGES.unranked,
    });
  });

  it("invites a signed-out visitor to find out where they would stand", () => {
    const standing = whereYouStand(board(), false, LEADERBOARD_MESSAGES);

    expect(standing.pinned).toBeNull();
    expect(standing.note).toBe(LEADERBOARD_MESSAGES.signedOut);
  });

  it("has nothing to say about a fan between Seasons", () => {
    // The page says what it says about a Season nobody is playing; a Rank in
    // one that does not exist is not a second thing to tell them.
    expect(
      whereYouStand(board({ season: null, top: [], fans: 0 }), true, LEADERBOARD_MESSAGES),
    ).toEqual({
      pinned: null,
      note: "",
    });
  });
});
