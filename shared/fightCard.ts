/**
 * A fight card, as anything that shows one reads it: an Event, its Bouts in
 * card order, and the two fighters in each.
 *
 * Deliberately knows nothing about the game played on top of a card. What the
 * game adds to a Bout — what each answer pays, whether it is still taking
 * answers, how long is left — is `shared/predictions.ts`, and it reaches
 * `app/components/FightCard.vue` as an optional prop that can be left off
 * entirely. So the same card renders on a marketing page, in an archive, or
 * anywhere else a lineup is worth showing, with nothing from the game
 * involved. `test/unit/fight-card.test.ts` holds this module to that.
 *
 * The moments here are ISO strings rather than `Date`s: a card crosses JSON to
 * reach a browser whichever side it was read on, and a model that claimed
 * otherwise would be true only on the server. Formatting one, and counting
 * down to one, is `app/utils/moments.ts` — this module holds the card, not the
 * clock.
 *
 * It depends on nothing at all, which `test/unit/fight-card.test.ts` checks
 * rather than trusts. That is why {@link Discipline} is here and not beside the
 * import that reads it: what is being fought is part of what a fight *is*, the
 * way its weight class is, and a card model reaching into the import to say so
 * would be the card knowing where it came from.
 */

/**
 * What is being fought: TFC runs three formats, and they are not three names
 * for one sport.
 *
 * A fact about the Bout, read off the `discipline` document it links to in
 * Prismic — and the only such fact the game *asks a different question*
 * because of. The weight class and how long a Bout is booked for are read on
 * the card and nothing else; the discipline decides what a Bout is asked at
 * all, because a Cage Grappling Bout has no method of victory to ask about and
 * a CageBox Bout cannot end in a Submission. See ADR-0017, and
 * `methodsAsked` in `shared/pricing.ts`, which is where that becomes the
 * Outcomes a Bout carries.
 *
 * A closed set rather than whatever an editor has typed, unlike the division
 * beside it. The game prices and grades against these values, so one it does
 * not recognise is not a discipline it can run a Bout in — which is why
 * `disciplineFor` in `shared/events.ts` refuses a card carrying one rather than
 * importing a Bout nothing knows what to ask.
 *
 * Spelled out again in the `bouts_discipline_known` check constraint, for the
 * reason given on `Role` in `server/db/schema.ts`.
 */
export type Discipline = "mma" | "cagebox" | "cage_grappling";

/** The three formats, in the order they are listed wherever all three are. */
export const DISCIPLINES = [
  "mma",
  "cagebox",
  "cage_grappling",
] as const satisfies readonly Discipline[];

/** What each is called wherever one is shown, which is TFC's own spelling. */
export const DISCIPLINE_LABELS = {
  mma: "MMA",
  cagebox: "CageBox",
  cage_grappling: "Cage Grappling",
} as const satisfies Record<Discipline, string>;

/**
 * One side of a Bout: the name it is fought under, and — when that fighter has
 * a `fighter` document — their photo, their record, and the uid their profile
 * page is reached by.
 *
 * A corner with only a name is a fallback name, which is how a late
 * replacement booked days before a card appears on it at all. It renders as a
 * name and nothing else rather than as a broken link to a page nobody has
 * written. See ADR-0001.
 */
export interface FightCardCorner {
  name: string;
  /** What `/fighters/:uid` is reached by, or null for a fallback name. */
  fighterUid: string | null;
  imageUrl: string | null;
  /** Their professional record, as the `fighter` document states it. */
  record: string | null;
}

/** One scheduled fight on a card. */
export interface FightCardBout {
  /** Where on the card it is fought: 1 is first, and no two Bouts share one. */
  cardOrder: number;
  red: FightCardCorner;
  blue: FightCardCorner;
  /**
   * What is being fought: MMA, CageBox or Cage Grappling.
   *
   * Here rather than only in the game half, because a card of three formats
   * reads as three different fights and a fan has to be told which is which —
   * on a marketing page as much as in TFC Predictions. That it also decides
   * what the Bout is asked is ADR-0017, and `shared/pricing.ts` is where that
   * happens; this module still knows nothing about the game.
   */
  discipline: Discipline;
  /** The weight class, as the `division` document names it. */
  division: string;
  scheduledRounds: number;
  mainEvent: boolean;
  titleFight: boolean;
}

/**
 * One fight card: a set of Bouts on a single date at a single venue.
 *
 * The poster is deliberately not here. It is imported and sits in Postgres,
 * and the day something renders one this gains a field; a model carrying what
 * nothing shows is a model nobody can trust the rest of.
 */
export interface FightCard {
  title: string;
  /** When the card starts, as an ISO string. */
  scheduledStart: string;
  venue: string;
  bouts: FightCardBout[];
}

/**
 * Where a corner's profile page is, or null for a fallback name.
 *
 * The one place the path is written, so that a fighter reached from a card is
 * reached the same way as one clicked on the fighters listing.
 */
export function fighterProfile(corner: FightCardCorner): string | null {
  return corner.fighterUid === null ? null : `/fighters/${corner.fighterUid}`;
}

/** A Bout named the way it is announced: the red corner first. */
export function boutHeadline(bout: FightCardBout): string {
  return `${bout.red.name} vs ${bout.blue.name}`;
}

/** How many rounds a Bout is scheduled for, written out. */
export function roundsLabel(scheduledRounds: number): string {
  return `${scheduledRounds} ${scheduledRounds === 1 ? "round" : "rounds"}`;
}

/**
 * The Bouts in the order they are fought, which is rarely the order they are
 * authored in: a card is written main event first and fought the other way
 * round.
 *
 * Copies rather than sorting in place, so that rendering a card cannot reorder
 * something the caller is still holding.
 */
export function inCardOrder(bouts: readonly FightCardBout[]): FightCardBout[] {
  return [...bouts].sort((one, another) => one.cardOrder - another.cardOrder);
}
