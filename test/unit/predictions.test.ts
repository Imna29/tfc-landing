import { describe, expect, it } from "vitest";
import type { FightCard, FightCardBout } from "../../shared/fightCard";
import {
  boutState,
  BOUT_STATE_LABELS,
  locksAt,
  multiplierLabel,
  PREDICTION_MESSAGES,
} from "../../shared/predictions";

/**
 * What TFC Predictions adds to a fight card, and what a fan is told about it.
 *
 * The card itself is `shared/fightCard.ts` and knows none of this. Here is the
 * half that does: whether a Bout is still taking Predictions, when it stops,
 * and what an answer pays — the three things #10 says a fan has to see before
 * they can form an opinion about a card.
 */

function bout(overrides: Partial<FightCardBout> = {}): FightCardBout {
  const corner = { fighterUid: null, imageUrl: null, record: null };

  return {
    cardOrder: 1,
    red: { name: "Giorgi Tsiklauri", ...corner },
    blue: { name: "Levan Beridze", ...corner },
    division: "Lightweight",
    scheduledRounds: 3,
    mainEvent: false,
    titleFight: false,
    ...overrides,
  };
}

function card(bouts: FightCardBout[]): FightCard {
  return {
    title: "TFC 12",
    scheduledStart: "2026-09-12T19:00:00.000Z",
    venue: "Tbilisi Sports Palace",
    bouts,
  };
}

const at = (when: string) => Date.parse(when);
const BEFORE = at("2026-09-12T18:00:00.000Z");
const AFTER = at("2026-09-12T19:30:00.000Z");

describe("where a Bout is, as a fan reads it", () => {
  it("is not open yet while nobody has opened it", () => {
    expect(boutState({ status: "closed", locksAt: null }, BEFORE)).toBe("closed");
  });

  it("is open once an admin has opened it", () => {
    expect(boutState({ status: "open", locksAt: null }, BEFORE)).toBe("open");
  });

  it("stays open until the moment it locks at", () => {
    const start = "2026-09-12T19:00:00.000Z";

    expect(boutState({ status: "open", locksAt: start }, BEFORE)).toBe("open");
    expect(boutState({ status: "open", locksAt: start }, at(start) - 1)).toBe("open");
  });

  it("is locked from that moment on, whether or not anybody pressed a button", () => {
    // ADR-0006: the first Bout locks automatically at the card's scheduled
    // start. A page still saying "open" while the fight is under way is the
    // one thing #10 exists to prevent.
    const start = "2026-09-12T19:00:00.000Z";

    expect(boutState({ status: "open", locksAt: start }, at(start))).toBe("locked");
    expect(boutState({ status: "open", locksAt: start }, AFTER)).toBe("locked");
  });

  it("does not reopen a Bout nobody opened, however late it gets", () => {
    expect(boutState({ status: "closed", locksAt: "2026-09-12T19:00:00.000Z" }, AFTER)).toBe(
      "closed",
    );
  });

  it("tells a fan apart from one another in words, not only in colour", () => {
    expect(new Set(Object.values(BOUT_STATE_LABELS)).size).toBe(3);
  });
});

describe("the Bout that locks without an admin", () => {
  it("is the one fought first, at the moment the card starts", () => {
    const tfc12 = card([bout({ cardOrder: 2 }), bout({ cardOrder: 1 })]);

    expect(locksAt(bout({ cardOrder: 1 }), tfc12)).toBe("2026-09-12T19:00:00.000Z");
  });

  it("is nowhere else on the card: an admin advances the rest as it progresses", () => {
    const tfc12 = card([bout({ cardOrder: 1 }), bout({ cardOrder: 2 })]);

    expect(locksAt(bout({ cardOrder: 2 }), tfc12)).toBe(null);
  });

  it("is the first Bout still, on a card whose places start above 1", () => {
    // Card order says which is fought first, not that a card counts from 1 —
    // a Bout dropped from the lineup leaves the place it had.
    const tfc12 = card([bout({ cardOrder: 4 }), bout({ cardOrder: 7 })]);

    expect(locksAt(bout({ cardOrder: 4 }), tfc12)).toBe("2026-09-12T19:00:00.000Z");
    expect(locksAt(bout({ cardOrder: 7 }), tfc12)).toBe(null);
  });
});

describe("what an answer pays", () => {
  it("is written with the sign a fan reads and the places it is stored to", () => {
    expect(multiplierLabel(1.9)).toBe("×1.90");
    expect(multiplierLabel(3.25)).toBe("×3.25");
    expect(multiplierLabel(12)).toBe("×12.00");
  });
});

describe("what the page says when there is nothing to show", () => {
  it("says so rather than rendering an empty card", () => {
    expect(PREDICTION_MESSAGES.noCard).toMatch(/card/i);
  });
});
