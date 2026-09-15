import { describe, expect, it } from "vitest";
import { hasStarted, nextToLock, type ConsoleBout } from "../../shared/console";

/**
 * Which Bout an admin locks next, cageside.
 *
 * The console's whole job is that this is never a decision: the card is being
 * fought, an admin is watching it one-handed in the dark, and the one control
 * on the screen has to be about the right fight. ADR-0006 says which that is —
 * Bouts lock in card order as the card progresses — and this is where that is
 * said once.
 */

const START = "2026-09-12T19:00:00.000Z";
const SWEEP = "2026-09-13T01:00:00.000Z";
const DURING = Date.parse("2026-09-12T19:40:00.000Z");

function consoleBout(overrides: Partial<ConsoleBout> = {}): ConsoleBout {
  return {
    id: `bout-${overrides.cardOrder ?? 1}`,
    cardOrder: 1,
    redName: "Giorgi Tsiklauri",
    blueName: "Levan Beridze",
    mainEvent: false,
    status: "open",
    lock: null,
    locksAt: SWEEP,
    locksAs: "sweep",
    ...overrides,
  };
}

/** A card whose opener has locked and whose other two Bouts are still open. */
function cardBeingFought(): ConsoleBout[] {
  return [
    consoleBout({
      cardOrder: 1,
      status: "locked",
      locksAt: START,
      locksAs: "scheduled",
      lock: { kind: "scheduled", at: START, by: null },
    }),
    consoleBout({ cardOrder: 2 }),
    consoleBout({ cardOrder: 3, mainEvent: true }),
  ];
}

describe("the Bout an admin locks next", () => {
  it("is the open Bout fought first", () => {
    expect(nextToLock(cardBeingFought(), DURING)?.cardOrder).toBe(2);
  });

  it("is read in card order, whatever order the Bouts arrive in", () => {
    const card = cardBeingFought();

    expect(nextToLock([card[2]!, card[0]!, card[1]!], DURING)?.cardOrder).toBe(2);
  });

  it("is never a Bout nobody has opened", () => {
    // Locking one is refused — a Bout that never took Predictions has nothing
    // to stop taking — so offering it would be offering a refusal.
    const card = [consoleBout({ cardOrder: 1, status: "closed" }), consoleBout({ cardOrder: 2 })];

    expect(nextToLock(card, DURING)?.cardOrder).toBe(2);
  });

  it("is nothing at all once every Bout has locked", () => {
    const card = cardBeingFought().map((bout) => ({ ...bout, status: "locked" }) as ConsoleBout);

    expect(nextToLock(card, DURING)).toBe(null);
  });

  it("is nothing on a card whose Bouts have all settled", () => {
    const card = cardBeingFought().map((bout) => ({ ...bout, status: "settled" }) as ConsoleBout);

    expect(nextToLock(card, DURING)).toBe(null);
  });

  it("is not a Bout whose own backstop has passed while the page sat open", () => {
    // The sweep falls due with nobody looking, and the row saying so is
    // written by the next request. Between those two the column still says
    // open — and a console offering that Bout would be offering a press that
    // is about to be refused, on the one screen where a refusal costs an admin
    // the fight they are actually trying to close.
    const after = Date.parse("2026-09-13T01:30:00.000Z");

    expect(nextToLock(cardBeingFought(), after)).toBe(null);
  });
});

describe("whether the card is under way", () => {
  const card = { scheduledStart: START };

  it("is under way from the moment it is scheduled to start", () => {
    // The moment the card turns on: it is when the Bout fought first locks by
    // itself, and from it closing the fight in the cage is one press.
    expect(hasStarted(card, Date.parse(START))).toBe(true);
    expect(hasStarted(card, DURING)).toBe(true);
  });

  it("is not under way a minute before, however ready the card is", () => {
    // A card is priced and opened at a desk days ahead, so the console has a
    // full lineup and an armed control long before anybody is in an arena.
    // Locking then closes a fight nobody is fighting, and a Lock is final.
    expect(hasStarted(card, Date.parse("2026-09-12T18:59:00.000Z"))).toBe(false);
    expect(hasStarted(card, Date.parse("2026-08-30T12:00:00.000Z"))).toBe(false);
  });
});
