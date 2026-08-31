import { describe, expect, it } from "vitest";
import {
  automaticLock,
  isAutomatic,
  LOCK_KIND_LABELS,
  LOCK_KINDS,
  LOCK_MESSAGES,
  SWEEP_AFTER,
} from "../../shared/locks";

/**
 * When a Bout locks with nobody pressing anything.
 *
 * ADR-0006 keeps later Bouts open while earlier ones are being fought, and
 * pays for it with an admin at a keyboard for the whole event. These are the
 * backstops behind that person: the first Bout locks when the card starts, and
 * every other one locks a window later whatever anybody remembered to do. A
 * Bout still taking Predictions while it is being fought is the one failure
 * that lets a fan win with certainty.
 */

const START = "2026-09-12T19:00:00.000Z";

describe("when a Bout locks by itself", () => {
  it("locks the Bout fought first at the moment the card starts", () => {
    expect(automaticLock(1, 1, START, SWEEP_AFTER)).toEqual({ at: START, kind: "scheduled" });
  });

  it("locks every other Bout a window after the card starts", () => {
    // Six hours past 19:00 is 01:00 the next morning, which is a moment
    // written out here rather than computed the way the code does it.
    expect(automaticLock(2, 1, START, SWEEP_AFTER)).toEqual({
      at: "2026-09-13T01:00:00.000Z",
      kind: "sweep",
    });
  });

  it("counts the first Bout by where it is fought, not by the number 1", () => {
    // A Bout dropped from the lineup leaves the place it had, so a card can
    // start at 4.
    expect(automaticLock(4, 4, START, SWEEP_AFTER).kind).toBe("scheduled");
    expect(automaticLock(7, 4, START, SWEEP_AFTER).kind).toBe("sweep");
  });

  it("takes the window it is given, so TFC can shorten it without a deploy", () => {
    expect(automaticLock(2, 1, START, 90 * 60 * 1000).at).toBe("2026-09-12T20:30:00.000Z");
  });

  it("defaults that window to six hours, which is an evening of fights", () => {
    expect(SWEEP_AFTER).toBe(6 * 60 * 60 * 1000);
  });
});

describe("how a Bout came to be locked", () => {
  it("is automatic unless an admin did it", () => {
    expect(isAutomatic("manual")).toBe(false);
    expect(isAutomatic("scheduled")).toBe(true);
    expect(isAutomatic("sweep")).toBe(true);
    expect(isAutomatic("result")).toBe(true);
  });

  it("says which one it was in words an admin can hand to a fan", () => {
    expect(Object.keys(LOCK_KIND_LABELS).sort()).toEqual([...LOCK_KINDS].sort());
    expect(new Set(Object.values(LOCK_KIND_LABELS)).size).toBe(LOCK_KINDS.length);
  });

  it("refuses a reopening in a sentence that says a Lock is final", () => {
    expect(LOCK_MESSAGES.alreadyLocked).toMatch(/never/i);
  });
});
