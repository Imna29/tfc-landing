import { describe, expect, it } from "vitest";
import {
  ALL_DISCIPLINES_LABEL,
  ALL_DIVISIONS_LABEL,
  filterRoster,
  isRosterFiltered,
  NO_ROSTER_FILTERS,
  searchTerms,
} from "../../app/utils/roster";

/**
 * The roster page is one long grid and one search box, and the search box is
 * the only way a fan finds the fighter they came for. These are the rules it
 * has to keep: what a fan types is never the exact string a Prismic editor
 * typed, so the matching has to forgive everything that isn't a difference —
 * case, accents, apostrophes, word order, a stray space — and forgive nothing
 * that is.
 *
 * Divisions here are free text, the way a card shows them, and disciplines are
 * the closed set the game recognises. See `CONTEXT.md`.
 */

const roster = [
  {
    name: "Levan Kobalia",
    nickname: "The Anvil",
    division: "Heavyweight",
    disciplines: ["MMA", "CageBox"],
  },
  {
    name: "André Lopes",
    nickname: "",
    division: "Lightweight",
    disciplines: ["MMA"],
  },
  {
    name: "T'ornike Beridze",
    nickname: "Iron Fist",
    division: "Bantamweight",
    disciplines: ["Cage Grappling"],
  },
  {
    name: "Jean-Claude Mensah",
    nickname: "",
    division: "Welterweight",
    disciplines: ["CageBox"],
  },
  {
    name: "Nika Dvalishvili",
    nickname: "The Wolf",
    division: "Heavyweight",
    disciplines: ["CageBox"],
  },
];

const named = (fighters: { name: string }[]) => fighters.map((fighter) => fighter.name);

const search = (query: string) => named(filterRoster(roster, { ...NO_ROSTER_FILTERS, query }));

describe("a roster nobody has searched", () => {
  it("is the whole roster, in the order an editor authored it", () => {
    expect(search("")).toEqual([
      "Levan Kobalia",
      "André Lopes",
      "T'ornike Beridze",
      "Jean-Claude Mensah",
      "Nika Dvalishvili",
    ]);
  });

  it("is what a box holding only spaces leaves, because that is not a search", () => {
    expect(search("   ")).toHaveLength(roster.length);
  });

  it("is what a box holding only punctuation leaves, for the same reason", () => {
    // A half-typed hyphen or apostrophe is a fan mid-word, not a fan asking
    // for nobody, and the grid it is typed over has to survive it.
    expect(search("-")).toHaveLength(roster.length);
    expect(search("'")).toHaveLength(roster.length);
  });
});

describe("what a fan types", () => {
  it("finds a fighter whatever case it is typed in", () => {
    expect(search("KOBALIA")).toEqual(["Levan Kobalia"]);
    expect(search("kobalia")).toEqual(["Levan Kobalia"]);
  });

  it("is trimmed, so a trailing space does not empty the page", () => {
    expect(search("  kobalia  ")).toEqual(["Levan Kobalia"]);
  });

  it("finds a fighter by the name they are fought under", () => {
    expect(search("wolf")).toEqual(["Nika Dvalishvili"]);
  });

  it("matches the middle of a name, not only its start", () => {
    expect(search("bali")).toEqual(["Levan Kobalia"]);
  });

  it("narrows as it lengthens, and never to nothing on the way", () => {
    // The shape of the reported bug: typing a name one letter at a time used
    // to blank the grid on the keystroke that changed the query without
    // changing who matched it. Every prefix of a real name has to answer.
    for (let length = 1; length <= "kobalia".length; length++) {
      expect(search("kobalia".slice(0, length))).toContain("Levan Kobalia");
    }
  });

  it("brings the roster back one letter at a time as it is deleted", () => {
    for (let length = "kobalia".length; length >= 0; length--) {
      expect(search("kobalia".slice(0, length)).length).toBeGreaterThan(0);
    }
  });
});

describe("the differences that are not differences", () => {
  it("ignores accents, typed or authored", () => {
    expect(search("andre")).toEqual(["André Lopes"]);
    expect(search("andré")).toEqual(["André Lopes"]);
  });

  it("ignores an apostrophe, typed or authored", () => {
    expect(search("tornike")).toEqual(["T'ornike Beridze"]);
    expect(search("t'ornike")).toEqual(["T'ornike Beridze"]);
  });

  it("ignores whether a double name is hyphenated or spaced", () => {
    // Both directions, because the fan and the editor each pick one: a hyphen
    // typed against a spaced name is the case that used to find nobody.
    expect(search("jean-claude")).toEqual(["Jean-Claude Mensah"]);
    expect(search("jean claude")).toEqual(["Jean-Claude Mensah"]);
    expect(search("claude")).toEqual(["Jean-Claude Mensah"]);
  });

  it("ignores the order the words come in", () => {
    // A fan who remembers the surname first is looking for the same fighter.
    expect(search("kobalia levan")).toEqual(["Levan Kobalia"]);
  });

  it("ignores however many spaces fall between the words", () => {
    expect(search("levan     kobalia")).toEqual(["Levan Kobalia"]);
  });

  it("reads a name and a nickname as one thing to search", () => {
    expect(search("anvil levan")).toEqual(["Levan Kobalia"]);
  });
});

describe("the differences that are", () => {
  it("keeps a word whole: two names do not run into one", () => {
    expect(search("levankobalia")).toEqual([]);
  });

  it("answers with nothing when nobody matches", () => {
    expect(search("mcgregor")).toEqual([]);
  });

  it("holds every word against the fighter, not just one of them", () => {
    expect(search("levan wolf")).toEqual([]);
  });
});

describe("the weight class and the discipline", () => {
  it("are searchable too, because they are how a fan describes a fighter", () => {
    expect(search("heavyweight")).toEqual(["Levan Kobalia", "Nika Dvalishvili"]);
    expect(search("grappling")).toEqual(["T'ornike Beridze"]);
  });

  it("narrow a name when both are typed", () => {
    expect(search("heavyweight nika")).toEqual(["Nika Dvalishvili"]);
  });
});

describe("the filter buttons", () => {
  it("hold the roster to one division", () => {
    const filtered = filterRoster(roster, { ...NO_ROSTER_FILTERS, division: "Heavyweight" });

    expect(named(filtered)).toEqual(["Levan Kobalia", "Nika Dvalishvili"]);
  });

  it("hold the roster to one discipline, which a fighter may have several of", () => {
    const filtered = filterRoster(roster, { ...NO_ROSTER_FILTERS, discipline: "MMA" });

    expect(named(filtered)).toEqual(["Levan Kobalia", "André Lopes"]);
  });

  it("narrow what the search box found, rather than replacing it", () => {
    const filtered = filterRoster(roster, {
      division: "Heavyweight",
      discipline: ALL_DISCIPLINES_LABEL,
      query: "nika",
    });

    expect(named(filtered)).toEqual(["Nika Dvalishvili"]);
  });
});

describe("whether the page is filtered at all", () => {
  it("is no, for the controls as a fan first meets them", () => {
    expect(isRosterFiltered(NO_ROSTER_FILTERS)).toBe(false);
  });

  it("is no for a query that asks nothing, however much is in the box", () => {
    // What decides the empty state's wording, and whether a way out of it is
    // offered: a box holding spaces is a box a fan has not searched with.
    expect(isRosterFiltered({ ...NO_ROSTER_FILTERS, query: "  " })).toBe(false);
  });

  it("is yes for any one of the three", () => {
    expect(isRosterFiltered({ ...NO_ROSTER_FILTERS, query: "nika" })).toBe(true);
    expect(isRosterFiltered({ ...NO_ROSTER_FILTERS, division: "Heavyweight" })).toBe(true);
    expect(isRosterFiltered({ ...NO_ROSTER_FILTERS, discipline: "MMA" })).toBe(true);
  });

  it("agrees with the labels the buttons carry", () => {
    expect(NO_ROSTER_FILTERS.division).toBe(ALL_DIVISIONS_LABEL);
    expect(NO_ROSTER_FILTERS.discipline).toBe(ALL_DISCIPLINES_LABEL);
  });
});

describe("the words a query is broken into", () => {
  it("are what is left once case and accents are gone", () => {
    expect(searchTerms("  André   Lopes ")).toEqual(["andre", "lopes"]);
  });

  it("end at punctuation, so a hyphen asks for both words", () => {
    expect(searchTerms("Jean-Claude")).toEqual(["jean", "claude"]);
  });

  it("are none at all for a query that says nothing", () => {
    expect(searchTerms("   ")).toEqual([]);
    expect(searchTerms("- '")).toEqual([]);
  });
});
