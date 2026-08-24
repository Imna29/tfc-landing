import { describe, expect, it } from "vitest";
import { formatSeasonDeadline } from "../../app/utils/seasonDeadline";

/**
 * A fan needs to know the deadline they are playing against, and it has to be
 * the same deadline for all of them. See `app/utils/seasonDeadline.ts` for why
 * the time zone is pinned rather than taken from wherever the page rendered.
 */
describe("formatSeasonDeadline", () => {
  it("reads as a date and a time a fan can act on", () => {
    expect(formatSeasonDeadline("2026-12-31T19:59:00+0000")).toEqual({
      iso: "2026-12-31T19:59:00.000Z",
      display: "31 December 2026 at 23:59 GMT+4",
    });
  });

  it("is the same deadline wherever the page was rendered", () => {
    // 21:00 UTC on the 31st is already the 1st in Tbilisi. A server rendering
    // in its own time zone would put a different day in the edge cache.
    expect(formatSeasonDeadline("2026-12-31T21:00:00+0000")?.display).toBe(
      "1 January 2027 at 01:00 GMT+4",
    );
  });

  it("has nothing to say about a Season whose end is not set", () => {
    expect(formatSeasonDeadline(null)).toBeNull();
    expect(formatSeasonDeadline(undefined)).toBeNull();
    expect(formatSeasonDeadline("")).toBeNull();
  });

  it("has nothing to say about a value it cannot read", () => {
    expect(formatSeasonDeadline("the end of the season")).toBeNull();
  });
});
