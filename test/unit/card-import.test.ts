import { describe, expect, it } from "vitest";
import { EVENT_MESSAGES } from "../../shared/events";
import {
  readCard,
  type PrismicBout,
  type PrismicEvent,
  type PrismicReference,
} from "../../server/utils/cardImport";

/**
 * Reading a fight card out of Prismic: the half of the import that decides
 * what a Bout *is*, before any of it reaches Postgres.
 *
 * It is worth testing on its own because it is where the authoring surface
 * meets the game. Prismic will hand this whatever an editor typed at eleven at
 * night the day before a card — a Bout with no rounds, two Bouts both numbered
 * 3, a corner that is neither a fighter document nor a name — and ADR-0001
 * says what is written into Postgres is what settlement will read months
 * later. Everything refused here is refused while it is still cheap.
 */

/** A fighter document, as the import fetches one. */
function fighter(
  overrides: Partial<PrismicReference> & Pick<PrismicReference, "id">,
): PrismicReference {
  return {
    uid: "a-fighter",
    data: {
      name: "A Fighter",
      image: { url: "https://images.prismic.io/tfc/a-fighter.png" },
      record: "10-0-0",
    },
    ...overrides,
  };
}

/** A division document, which carries a name and nothing the import wants. */
function division(id: string, name: string): PrismicReference {
  return { id, uid: name.toLowerCase(), data: { name } };
}

/**
 * A discipline document, which the import wants for its uid alone.
 *
 * The name is what an editor picks it by in Prismic; the game recognises the
 * uid, and writes the label itself (ADR-0017).
 */
function discipline(id: string, uid: string, name: string): PrismicReference {
  return { id, uid, data: { name } };
}

/** A link to a document, as the Document API answers with one. */
function linkTo(id: string) {
  return { link_type: "Document" as const, id, type: "fighter", tags: [], lang: "en-us" };
}

/** A link an editor left empty. */
const NOTHING = { link_type: "Any" as const };

/** One row of the `bouts` group, filled in enough to be importable. */
function boutRow(overrides: Partial<PrismicBout> = {}): PrismicBout {
  return {
    card_order: 1,
    red_corner: linkTo("fighter-red"),
    red_corner_name: null,
    blue_corner: linkTo("fighter-blue"),
    blue_corner_name: null,
    discipline: linkTo("discipline-mma"),
    division: linkTo("division-lightweight"),
    scheduled_rounds: 3,
    main_event: false,
    title_fight: false,
    ...overrides,
  };
}

/** An `event` document, filled in enough to be importable. */
function eventDocument(overrides: Partial<PrismicEvent["data"]> = {}): PrismicEvent {
  return {
    id: "event-tfc-12",
    data: {
      title: "TFC 12",
      scheduled_start: "2026-09-12T19:00:00+0000",
      venue: "Tbilisi Sports Palace",
      poster: { url: "https://images.prismic.io/tfc/tfc-12.png" },
      bouts: [boutRow()],
      ...overrides,
    },
  };
}

/** The fighter and division documents the fixtures above link to. */
const REFERENCED: PrismicReference[] = [
  fighter({
    id: "fighter-red",
    uid: "giorgi-tsiklauri",
    data: {
      name: "Giorgi Tsiklauri",
      image: { url: "https://images.prismic.io/tfc/tsiklauri.png" },
      record: "12-3-0",
    },
  }),
  fighter({
    id: "fighter-blue",
    uid: "levan-beridze",
    data: {
      name: "Levan Beridze",
      image: { url: "https://images.prismic.io/tfc/beridze.png" },
      record: "9-2-1",
    },
  }),
  division("division-lightweight", "Lightweight"),
  discipline("discipline-mma", "mma", "MMA"),
  discipline("discipline-cagebox", "cagebox", "CageBox"),
  discipline("discipline-grappling", "cage-grappling", "Cage Grappling"),
  discipline("discipline-kickboxing", "kickboxing", "Kickboxing"),
];

describe("reading a card out of Prismic", () => {
  it("resolves each corner's fighter document into everything a card shows of them", () => {
    const { card, problem } = readCard(eventDocument(), REFERENCED);

    expect(problem).toBeUndefined();
    expect(card).toEqual({
      prismicId: "event-tfc-12",
      title: "TFC 12",
      scheduledStart: new Date("2026-09-12T19:00:00+0000"),
      venue: "Tbilisi Sports Palace",
      posterUrl: "https://images.prismic.io/tfc/tfc-12.png",
      bouts: [
        {
          cardOrder: 1,
          red: {
            name: "Giorgi Tsiklauri",
            fighterId: "fighter-red",
            fighterUid: "giorgi-tsiklauri",
            imageUrl: "https://images.prismic.io/tfc/tsiklauri.png",
            record: "12-3-0",
          },
          blue: {
            name: "Levan Beridze",
            fighterId: "fighter-blue",
            fighterUid: "levan-beridze",
            imageUrl: "https://images.prismic.io/tfc/beridze.png",
            record: "9-2-1",
          },
          discipline: "mma",
          division: "Lightweight",
          scheduledRounds: 3,
          mainEvent: false,
          titleFight: false,
        },
      ],
    });
  });

  it("reads a Bout authored before main_event and title_fight existed as neither", () => {
    // Prismic leaves a Boolean field `null` on a document saved before the
    // field was added to the custom type, rather than backfilling it — the
    // same as an editor leaving a checkbox unchecked.
    const olderBout = eventDocument({
      bouts: [boutRow({ main_event: null, title_fight: null })],
    });

    const { card, problem } = readCard(olderBout, REFERENCED);

    expect(problem).toBeUndefined();
    expect(card?.bouts.at(0)).toMatchObject({ mainEvent: false, titleFight: false });
  });

  it("reads which discipline a Bout is fought in, by the document's uid", () => {
    const grappling = eventDocument({
      bouts: [boutRow({ discipline: linkTo("discipline-grappling") })],
    });

    const { card, problem } = readCard(grappling, REFERENCED);

    expect(problem).toBeUndefined();
    expect(card?.bouts.at(0)?.discipline).toBe("cage_grappling");
  });

  it("reads a card whose Bouts are fought in different disciplines", () => {
    // One card, three formats — which is how TFC actually books them, and the
    // reason the discipline is a fact about a Bout rather than about an Event.
    const mixed = eventDocument({
      bouts: [
        boutRow({ card_order: 1, discipline: linkTo("discipline-grappling") }),
        boutRow({ card_order: 2, discipline: linkTo("discipline-cagebox") }),
        boutRow({ card_order: 3, discipline: linkTo("discipline-mma") }),
      ],
    });

    const { card, problem } = readCard(mixed, REFERENCED);

    expect(problem).toBeUndefined();
    expect(card?.bouts.map((bout) => bout.discipline)).toEqual([
      "cage_grappling",
      "cagebox",
      "mma",
    ]);
  });

  it("refuses a card whose Bout has no discipline", () => {
    // Not defaulted to MMA. What a Bout is asked follows from this (ADR-0017),
    // so guessing it would price a card on a guess.
    const unnamed = eventDocument({ bouts: [boutRow({ discipline: NOTHING })] });

    expect(readCard(unnamed, REFERENCED)).toEqual({
      problem: EVENT_MESSAGES.disciplineMissing(1),
    });
  });

  it("refuses a card pointing at a discipline document that is not published", () => {
    const draft = eventDocument({ bouts: [boutRow({ discipline: linkTo("discipline-sumo") })] });

    expect(readCard(draft, REFERENCED)).toEqual({
      problem: EVENT_MESSAGES.disciplineMissing(1),
    });
  });

  it("refuses a discipline the game does not run, naming the ones it does", () => {
    // A published document the game has never been taught about. Refused while
    // the fix is still an edit in a CMS, rather than imported as a Bout nothing
    // knows what to ask about.
    const kickboxing = eventDocument({
      bouts: [boutRow({ discipline: linkTo("discipline-kickboxing") })],
    });

    const { problem } = readCard(kickboxing, REFERENCED);

    expect(problem).toBe(EVENT_MESSAGES.disciplineNotKnown(1, "kickboxing"));
    expect(problem).toContain("cage-grappling");
  });

  it("imports a Bout whose corner is only a name, for a replacement with no profile yet", () => {
    const lateReplacement = eventDocument({
      bouts: [
        boutRow(),
        boutRow({
          card_order: 2,
          blue_corner: NOTHING,
          blue_corner_name: "Zurab Kapanadze",
          scheduled_rounds: 5,
          main_event: true,
          title_fight: true,
        }),
      ],
    });

    const { card } = readCard(lateReplacement, REFERENCED);

    expect(card?.bouts.map((bout) => [bout.cardOrder, bout.red.name, bout.blue.name])).toEqual([
      [1, "Giorgi Tsiklauri", "Levan Beridze"],
      [2, "Giorgi Tsiklauri", "Zurab Kapanadze"],
    ]);

    // Nothing invented for a fighter who has no document: the card shows the
    // name, and #10 renders that corner without a photo or a profile link.
    expect(card?.bouts.at(1)?.blue).toEqual({
      name: "Zurab Kapanadze",
      fighterId: null,
      fighterUid: null,
      imageUrl: null,
      record: null,
    });

    expect(card?.bouts.at(1)).toMatchObject({
      scheduledRounds: 5,
      mainEvent: true,
      titleFight: true,
    });
  });

  it("carries a fighter with no record typed into them, rather than refusing the card", () => {
    // A record is what a fan judges a matchup on, and a fighter document is
    // published before somebody has filled every field of it. A missing one is
    // a gap on the card, not a reason a card cannot be predicted on.
    const unrecorded = REFERENCED.map((document) =>
      document.id === "fighter-red"
        ? { ...document, data: { ...document.data, record: null } }
        : document,
    );

    const { card, problem } = readCard(eventDocument(), unrecorded);

    expect(problem).toBeUndefined();
    expect(card?.bouts.at(0)?.red).toMatchObject({ name: "Giorgi Tsiklauri", record: null });
  });

  it("puts the Bouts in card order, whatever order the rows were authored in", () => {
    // A card is usually written main event first and fought the other way
    // round, so the order of the group is not the order of the card.
    const authoredBackwards = eventDocument({
      bouts: [boutRow({ card_order: 3 }), boutRow({ card_order: 1 }), boutRow({ card_order: 2 })],
    });

    const { card } = readCard(authoredBackwards, REFERENCED);

    expect(card?.bouts.map((bout) => bout.cardOrder)).toEqual([1, 2, 3]);
  });

  it("refuses a Bout with no card order", () => {
    const unordered = eventDocument({
      bouts: [boutRow(), boutRow({ card_order: null })],
    });

    const { card, problem } = readCard(unordered, REFERENCED);

    expect(card).toBeUndefined();
    expect(problem).toMatch(/2nd Bout/i);
  });

  it("refuses two Bouts that claim the same place on the card", () => {
    const bothThird = eventDocument({
      bouts: [boutRow({ card_order: 3 }), boutRow({ card_order: 3 })],
    });

    const { card, problem } = readCard(bothThird, REFERENCED);

    expect(card).toBeUndefined();
    expect(problem).toMatch(/3/);
  });

  it("refuses a card with no Bouts on it", () => {
    const { card, problem } = readCard(eventDocument({ bouts: [] }), REFERENCED);

    expect(card).toBeUndefined();
    expect(problem).toMatch(/no Bouts/i);
  });

  it("refuses a corner that is neither a fighter document nor a name", () => {
    const nobody = eventDocument({
      bouts: [boutRow(), boutRow({ card_order: 2, red_corner: NOTHING, red_corner_name: "  " })],
    });

    const { card, problem } = readCard(nobody, REFERENCED);

    expect(card).toBeUndefined();
    expect(problem).toMatch(/2nd Bout's red corner/i);
  });

  it("refuses a corner linking a fighter document that is not published", () => {
    // The editor picked a fighter, then the document went back to a draft.
    // Falling back to an empty name would put a nameless corner on the card.
    const unpublished = eventDocument({
      bouts: [boutRow({ blue_corner: { ...linkTo("fighter-drafted"), isBroken: true } })],
    });

    const { card, problem } = readCard(unpublished, REFERENCED);

    expect(card).toBeUndefined();
    expect(problem).toMatch(/not published/i);
  });

  it("refuses a corner whose fighter document has no name typed into it", () => {
    // Refused here rather than written as an empty name for
    // `bouts_corners_are_named` to refuse, which would reach the admin as a
    // failure naming no row.
    const nameless = eventDocument({
      bouts: [boutRow({ blue_corner: linkTo("fighter-nameless") })],
    });

    const { card, problem } = readCard(nameless, [
      ...REFERENCED,
      fighter({ id: "fighter-nameless", uid: "nameless", data: { name: "  " } }),
    ]);

    expect(card).toBeUndefined();
    expect(problem).toMatch(/no name/i);
  });

  it("takes the typed name when the fighter document behind it is gone", () => {
    const both = eventDocument({
      bouts: [
        boutRow({
          blue_corner: { ...linkTo("fighter-drafted"), isBroken: true },
          blue_corner_name: "Zurab Kapanadze",
        }),
      ],
    });

    expect(readCard(both, REFERENCED).card?.bouts.at(0)?.blue.name).toBe("Zurab Kapanadze");
  });

  it("prefers the fighter document to a name left behind beside it", () => {
    // Both filled in: the document is the fighter, and the text field is the
    // stand-in for not having one.
    const both = eventDocument({
      bouts: [boutRow({ blue_corner_name: "Someone Else Entirely" })],
    });

    expect(readCard(both, REFERENCED).card?.bouts.at(0)?.blue.name).toBe("Levan Beridze");
  });

  it("refuses a Bout with the same fighter in both corners", () => {
    const shadowBoxing = eventDocument({
      bouts: [boutRow({ blue_corner: linkTo("fighter-red") })],
    });

    const { card, problem } = readCard(shadowBoxing, REFERENCED);

    expect(card).toBeUndefined();
    expect(problem).toMatch(/both corners/i);
  });

  it("refuses a Bout with no division, which is the weight class a fan is shown", () => {
    const { card, problem } = readCard(
      eventDocument({ bouts: [boutRow({ division: NOTHING })] }),
      REFERENCED,
    );

    expect(card).toBeUndefined();
    expect(problem).toMatch(/division/i);
  });

  it("refuses a Bout with no scheduled rounds, which a fan reads on the card", () => {
    const { card, problem } = readCard(
      eventDocument({ bouts: [boutRow({ scheduled_rounds: null })] }),
      REFERENCED,
    );

    expect(card).toBeUndefined();
    expect(problem).toMatch(/rounds/i);
  });

  it("refuses a card with two main events", () => {
    const twoHeadliners = eventDocument({
      bouts: [
        boutRow({ card_order: 1, main_event: true }),
        boutRow({ card_order: 2, main_event: true }),
      ],
    });

    const { card, problem } = readCard(twoHeadliners, REFERENCED);

    expect(card).toBeUndefined();
    expect(problem).toMatch(/main event/i);
  });
});
