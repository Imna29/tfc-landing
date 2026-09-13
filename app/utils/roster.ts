/**
 * The roster page's search box and filter buttons, as one decision.
 *
 * Here rather than in the slice because it is the only part of that page with
 * rules rather than markup, and because the rules are about what a fan means
 * rather than about Prismic: what someone types into a search box is never the
 * string an editor typed into the CMS. They type lowercase, they leave the
 * accent off, they skip the apostrophe, they remember the surname first. None
 * of those is a different fighter, so none of them is allowed to empty the
 * page.
 */

/** What the first division button says, and what it means: no division filter. */
export const ALL_DIVISIONS_LABEL = "All Divisions";

/** The same for disciplines. */
export const ALL_DISCIPLINES_LABEL = "All Disciplines";

/** The parts of a fighter a fan can search by. */
export interface SearchableFighter {
  name: string;
  nickname: string;
  division: string;
  disciplines: string[];
}

/** What the page's three controls are set to. */
export interface RosterFilters {
  /** A division name, or {@link ALL_DIVISIONS_LABEL}. */
  division: string;
  /** A discipline name, or {@link ALL_DISCIPLINES_LABEL}. */
  discipline: string;
  /** Whatever is in the search box, exactly as typed. */
  query: string;
}

/** The three controls as they sit before a fan has touched any of them. */
export const NO_ROSTER_FILTERS: RosterFilters = {
  division: ALL_DIVISIONS_LABEL,
  discipline: ALL_DISCIPLINES_LABEL,
  query: "",
};

/**
 * Case and accents gone, so that two spellings of one name meet in the middle.
 *
 * NFD splits `é` into `e` and a combining mark, so dropping the marks leaves
 * the letter behind. It runs over both sides — what the fan typed and what the
 * editor authored — which is what lets `andre` find `André` and `André` find
 * `Andre`.
 */
function foldAccents(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase();
}

/**
 * The words a query is asking about.
 *
 * A query is words rather than one string so that word order stops mattering:
 * a fan who types `kobalia levan` is looking for Levan Kobalia, and so is one
 * who types `heavyweight nika`. Each word has to be found somewhere in the
 * fighter, which is what keeps the search narrowing as more is typed.
 *
 * Punctuation ends a word here, while {@link searchTextOf} rubs it out of the
 * fighter entirely. The asymmetry is the point: a fan who types `jean-claude`
 * is asking for both words, and gets them whether the editor wrote the name
 * hyphenated or spaced. Folding the hyphen away on this side instead would ask
 * for the single word `jeanclaude` and find nobody called `Jean Claude`.
 *
 * A query that comes to nothing — spaces, a stray hyphen, a half-typed
 * apostrophe — has no words in it and so asks nothing, which is what brings
 * the whole roster back rather than emptying the page.
 */
export function searchTerms(query: string): string[] {
  return foldAccents(query)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/**
 * Everything about a fighter a search runs against, folded and joined.
 *
 * Division and discipline are in here beside the name because they are how a
 * fan describes a fighter they cannot quite name — "the heavyweight", "the
 * grappler" — and the filter buttons above the grid only reach them one at a
 * time.
 *
 * Punctuation is rubbed out rather than spaced, so that a fan who leaves it
 * out still matches: Georgian names are transliterated with apostrophes
 * (`T'ornike`) and nobody types that one. Whitespace survives, and that is
 * what keeps a word whole — no term can bridge two fields, so `levankobalia`
 * finds nobody.
 */
function searchTextOf(fighter: SearchableFighter): string {
  return foldAccents(
    [fighter.name, fighter.nickname, fighter.division, ...fighter.disciplines].join(" "),
  ).replace(/[^\p{L}\p{N}\s]+/gu, "");
}

/** Whether anything is narrowing the roster, which is to say: is this page filtered. */
export function isRosterFiltered(filters: RosterFilters): boolean {
  return (
    filters.division !== ALL_DIVISIONS_LABEL ||
    filters.discipline !== ALL_DISCIPLINES_LABEL ||
    searchTerms(filters.query).length > 0
  );
}

/**
 * The fighters the grid shows, in the order an editor authored them.
 *
 * The three controls narrow rather than replace one another: a division button
 * and a search term asked together mean both.
 */
export function filterRoster<Fighter extends SearchableFighter>(
  roster: readonly Fighter[],
  filters: RosterFilters,
): Fighter[] {
  const terms = searchTerms(filters.query);

  return roster.filter((fighter) => {
    if (filters.division !== ALL_DIVISIONS_LABEL && fighter.division !== filters.division) {
      return false;
    }

    if (
      filters.discipline !== ALL_DISCIPLINES_LABEL &&
      !fighter.disciplines.includes(filters.discipline)
    ) {
      return false;
    }

    if (terms.length === 0) {
      return true;
    }

    const searchText = searchTextOf(fighter);

    return terms.every((term) => searchText.includes(term));
  });
}
