/**
 * What importing a fight card says to the admin doing it.
 *
 * Shared for the same reason `shared/seasons.ts` is: the server sends the
 * sentence the admin area shows, and `test/unit/vocabulary.test.ts` holds all
 * of it to `CONTEXT.md` at once.
 *
 * Every refusal names the thing to go and fix in Prismic. An import is refused
 * as a whole rather than in part — a card missing half its Bouts would look
 * imported, and ADR-0001 makes what lands in Postgres the copy settlement
 * reads afterwards.
 */
import { DISCIPLINES, type Discipline } from "./fightCard";

/** Which corner of a Bout, as a fan and an editor both read it. */
export type Corner = "red" | "blue";

/**
 * The uid of the `discipline` document each one is authored as.
 *
 * The uid rather than the name, because it is the identifier of the document
 * and the name is display text an editor may reword — "CageBox" becoming "Cage
 * Box" one afternoon should change what a fan reads and nothing about what the
 * game asks. Written out rather than derived from the value beside it, so that
 * an editor who creates the document under a uid of their own choosing is
 * answered by a line somebody can change here rather than by a rule nobody
 * wrote down.
 *
 * Named in {@link EVENT_MESSAGES.disciplineNotKnown}, so an admin refused an
 * import is told which uids the game answers to.
 */
export const DISCIPLINE_UIDS = {
  mma: "mma",
  cagebox: "cagebox",
  cage_grappling: "cage-grappling",
} as const satisfies Record<Discipline, string>;

/**
 * Which discipline a `discipline` document is, or null for one the game does
 * not run.
 *
 * The whole of the mapping from Prismic's vocabulary to this one, in the
 * module the import refuses from — so a card pointing at a document nobody has
 * taught the game about is refused while the fix is still an edit in a CMS
 * (ADR-0001).
 */
export function disciplineFor(uid: string | null | undefined): Discipline | null {
  return DISCIPLINES.find((discipline) => DISCIPLINE_UIDS[discipline] === uid) ?? null;
}

/**
 * How many rounds a Bout may be scheduled for.
 *
 * A fact about the fight rather than about the game: a fan reads it on the
 * card beside the weight class, and since ADR-0016 retired the round Question
 * nothing prices it and nothing is graded against it. The bounds are the guard
 * against a number typed with a stuck key — a Bout booked over fifty rounds is
 * a card somebody has to look at — rather than a rule about the sport.
 * Spelled out again in the `bouts_rounds_are_scheduled` check constraint, and
 * again as the bounds on the field in `customtypes/event/index.json`.
 */
export const SCHEDULED_ROUNDS = { minimum: 1, maximum: 12 } as const;

/**
 * Where a Bout is: not yet taking Predictions, taking them, done taking them,
 * or graded against what happened in it.
 *
 * `closed` is where a Bout starts. An admin prices its Outcomes and opens it
 * (#9), and from that moment it is a Bout fans hold Coins against — which is
 * what the `bouts` table in `server/db/schema.ts` is careful about. `locked`
 * is where it ends up, by an admin's hand or by one of the backstops behind
 * them (ADR-0006), and it is the end: a locked Bout is never reopened, which
 * `a_locked_bout_is_never_reopened` holds in Postgres rather than in whichever
 * route remembers to ask.
 *
 * `settled` is where it stops: the Result is in and the Coins have moved. It
 * is reached from `locked` and from nowhere else, and a Bout still open when a
 * Result is entered is locked on the way through — a Result recorded beside a
 * Bout still taking Predictions is the gap ADR-0006's backstops exist for. The
 * two rules are held in Postgres by `a_locked_bout_is_never_reopened` and
 * `results_are_entered_on_settled_bouts`.
 *
 * Everything that asks whether a Bout is still untouched asks whether it is
 * `closed`, and everything that asks whether it takes Predictions asks whether
 * it is `open`, so neither had to change when this arrived — and `boutState` in
 * `shared/predictions.ts` is what turns this into the word a fan reads.
 *
 * Shared rather than kept in the schema because the public card is the other
 * place that reads it: what a fan is told about a Bout is decided from the
 * same values Postgres holds.
 */
export type BoutStatus = "closed" | "open" | "locked" | "settled";

/** Everything importing a card says to the admin doing it. */
export const EVENT_MESSAGES = {
  cardNotChosen: "Choose a card to import.",
  notInPrismic:
    "That card is not in Prismic any more. Somebody may have deleted the " +
    "document since this page was opened.",
  noSeasonOpen:
    "No Season is open. A card is imported into the Season its Coins are " +
    "committed in, so open one first.",
  alreadyOpened:
    "Bouts on this card are open for predictions, so it can no longer be " +
    "re-imported. Fans hold Coins against these Bouts, and replacing them " +
    "would leave those Predictions pointing at fights that no longer exist.",
  titleMissing: "This card has no title. Fans see it above every Bout on it.",
  startMissing:
    "This card has no scheduled start. The first Bout locks automatically at " +
    "it, so a card without one has no Lock to count down to.",
  venueMissing: "This card has no venue.",
  boutsMissing: "This card has no Bouts on it yet, so there is nothing to import.",
  cardOrderUnreadable: (position: number) =>
    `The ${ordinal(position)} Bout is not numbered a whole place on the card, ` +
    "counting from 1. Card order is the order the Bouts are fought, and it is " +
    "how a fan reads the card and how the Bouts are locked in turn.",
  cardOrderRepeated: (order: number) =>
    `Two Bouts are both number ${order} on the card. No two can share a ` +
    "place, or there is no saying which of them is fought first.",
  fighterUnnamed: (position: number, corner: Corner) =>
    `The ${ordinal(position)} Bout's ${corner} corner links a fighter document ` +
    "with no name typed into it, so there is nothing to put on the card.",
  cornerUnpublished: (position: number, corner: Corner) =>
    `The ${ordinal(position)} Bout's ${corner} corner links a fighter document ` +
    "that is not published, so there is no name to put on the card. Publish " +
    "the fighter, or clear the link and type the name instead.",
  sameFighter: (position: number) =>
    `The ${ordinal(position)} Bout has the same fighter in both corners.`,
  divisionMissing: (position: number) =>
    `The ${ordinal(position)} Bout has no division. It is the weight class a ` +
    "fan reads beside the two names.",
  disciplineMissing: (position: number) =>
    `The ${ordinal(position)} Bout has no discipline, or links one that is not ` +
    "published. It is what the Bout is asked \u2014 an MMA Bout can end by " +
    "Submission, a CageBox Bout cannot, and a Cage Grappling Bout is asked for " +
    "a winner and nothing else \u2014 so there is no way to price a Bout without it.",
  disciplineNotKnown: (position: number, uid: string) =>
    `The ${ordinal(position)} Bout is fought in "${uid}", which is not a ` +
    "discipline the game runs. It knows " +
    DISCIPLINES.map((discipline) => `"${DISCIPLINE_UIDS[discipline]}"`).join(", ") +
    ", by the UID of the discipline document. Point the Bout at one of those, " +
    "or the discipline needs adding to the game before a card using it can be " +
    "imported.",
  roundsUnreadable: (position: number) =>
    `The ${ordinal(position)} Bout is not scheduled for a whole number of ` +
    `rounds between ${SCHEDULED_ROUNDS.minimum} and ${SCHEDULED_ROUNDS.maximum}. ` +
    "It is how long the fight is booked for, and a fan reads it on the card " +
    "beside the weight class.",
  mainEventRepeated:
    "Two Bouts on this card are both flagged the main event. Only one Bout " + "closes a card.",
  cornerUnnamed: (position: number, corner: Corner) =>
    `The ${ordinal(position)} Bout's ${corner} corner has neither a fighter ` +
    "document nor a name. A late replacement with no profile page yet only " +
    "needs their name typed into the corner name field.",
} as const;

/**
 * A position as a person reads one: 1st, 2nd, 3rd, 11th, 21st.
 *
 * Bouts are named to an admin by where they sit in the `bouts` group rather
 * than by their card order, because a card order that is missing or shared
 * with another Bout is one of the things this refuses an import for — and a
 * refusal that named the Bout by the field that is wrong would not tell
 * anybody which row to open.
 */
export function ordinal(position: number): string {
  const lastTwo = position % 100;

  if (lastTwo >= 11 && lastTwo <= 13) return `${position}th`;

  return `${position}${["th", "st", "nd", "rd"][position % 10] ?? "th"}`;
}
