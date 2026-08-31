import { describe, expect, it } from "vitest";
import { remainingLabel, remainingUntil } from "../../app/utils/moments";

/**
 * Counting down to a moment: the wait a fan reads on the Bout that locks by
 * itself, and the one the marketing site shows to the start of a card.
 *
 * Nothing here knows what it is counting down to. That is the point of it
 * living beside the other moment formatting rather than inside either the card
 * or the game.
 */
describe("counting down to a moment", () => {
  const moment = "2026-09-12T19:00:00.000Z";
  const at = (when: string) => Date.parse(when);

  it("breaks the wait down into days, hours, minutes and seconds", () => {
    expect(remainingUntil(moment, at("2026-09-10T14:48:51.000Z"))).toEqual({
      days: 2,
      hours: 4,
      minutes: 11,
      seconds: 9,
    });
  });

  it("is nothing at all once the moment has passed", () => {
    expect(remainingUntil(moment, at("2026-09-12T19:00:00.000Z"))).toBe(null);
    expect(remainingUntil(moment, at("2026-09-12T19:00:01.000Z"))).toBe(null);
  });

  it("is still counting a second before it", () => {
    expect(remainingUntil(moment, at("2026-09-12T18:59:59.000Z"))).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 1,
    });
  });

  it("writes the wait as a clock, with the days only when there are some", () => {
    expect(remainingLabel({ days: 2, hours: 4, minutes: 11, seconds: 9 })).toBe("2d 04:11:09");
    expect(remainingLabel({ days: 0, hours: 4, minutes: 11, seconds: 9 })).toBe("04:11:09");
    expect(remainingLabel({ days: 0, hours: 0, minutes: 0, seconds: 0 })).toBe("00:00:00");
  });
});
