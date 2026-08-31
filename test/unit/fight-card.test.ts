import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  boutHeadline,
  fighterProfile,
  inCardOrder,
  roundsLabel,
  type FightCardBout,
  type FightCardCorner,
} from "../../shared/fightCard";

/**
 * The fight card as anything that shows one reads it.
 *
 * This is the half of #10 that has nothing to do with TFC Predictions: two
 * fighters, a weight class, how many rounds, and where on the card it is. A
 * card is worth showing on the marketing site as well as on the page a fan
 * predicts from, so nothing here knows what a Multiplier is — and the last
 * test in this file is what keeps it that way.
 */

function corner(overrides: Partial<FightCardCorner> = {}): FightCardCorner {
  return {
    name: "Giorgi Tsiklauri",
    fighterUid: "giorgi-tsiklauri",
    imageUrl: "https://images.prismic.io/tfc/tsiklauri.png",
    record: "12-3-0",
    ...overrides,
  };
}

function bout(overrides: Partial<FightCardBout> = {}): FightCardBout {
  return {
    cardOrder: 1,
    red: corner(),
    blue: corner({ name: "Levan Beridze", fighterUid: "levan-beridze" }),
    division: "Lightweight",
    scheduledRounds: 3,
    mainEvent: false,
    titleFight: false,
    ...overrides,
  };
}

describe("a fighter's profile page", () => {
  it("is reached by the uid the corner was imported with", () => {
    expect(fighterProfile(corner())).toBe("/fighters/giorgi-tsiklauri");
  });

  it("is nowhere for a fallback name, which is a fighter with no document yet", () => {
    // A late replacement booked days before a card has a name and nothing
    // else. A link to a page nobody has written is worse than no link.
    expect(fighterProfile(corner({ fighterUid: null, imageUrl: null, record: null }))).toBe(null);
  });
});

describe("how a Bout reads", () => {
  it("names both corners, red first", () => {
    expect(boutHeadline(bout())).toBe("Giorgi Tsiklauri vs Levan Beridze");
  });

  it("counts the rounds it is scheduled for", () => {
    expect(roundsLabel(3)).toBe("3 rounds");
    expect(roundsLabel(5)).toBe("5 rounds");
  });

  it("says one round in the singular", () => {
    expect(roundsLabel(1)).toBe("1 round");
  });
});

describe("the order a card is read in", () => {
  it("puts the Bout fought first at the top, whatever order they arrived in", () => {
    const card = [bout({ cardOrder: 3 }), bout({ cardOrder: 1 }), bout({ cardOrder: 2 })];

    expect(inCardOrder(card).map((one) => one.cardOrder)).toEqual([1, 2, 3]);
  });

  it("leaves what it was given alone", () => {
    const card = [bout({ cardOrder: 2 }), bout({ cardOrder: 1 })];

    inCardOrder(card);

    expect(card.map((one) => one.cardOrder)).toEqual([2, 1]);
  });
});

describe("the model itself", () => {
  const model = readFileSync(
    fileURLToPath(new URL("../../shared/fightCard.ts", import.meta.url)),
    "utf8",
  );

  it("depends on nothing, so a card can be shown wherever one is read", () => {
    // Not the game, not Prismic, not the database. A card arriving from any of
    // them is the same card, and this is what says so.
    expect(model).not.toMatch(/^\s*import\b/m);
  });

  it("names nothing from the prediction game in the model itself", () => {
    // The point of this module: `app/components/FightCard.vue` renders a card
    // from it alone, and takes what the game adds — what an answer pays, and
    // whether a Bout is still taking answers — as an optional prop it can be
    // given nothing for. A game word finding its way into the model is how
    // that stops being true, and it would stop being true quietly.
    //
    // The prose is left out of this: a comment is allowed to explain what the
    // game does with a card. It is the code that has to be free of it.
    const code = model.replaceAll(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");

    const found = ["Multiplier", "Coin", "Prediction", "Entry", "Outcome", "Reward", "Lock"].filter(
      (word) => new RegExp(`\\b${word}`, "i").test(code),
    );

    expect(found).toEqual([]);
  });
});
