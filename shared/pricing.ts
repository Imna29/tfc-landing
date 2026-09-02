/**
 * Pricing a Bout: the three Questions asked about it, the Outcomes that answer
 * them, and the table every Multiplier starts from.
 *
 * ADR-0002 chose fixed Multipliers set by hand over a self-balancing pool,
 * because a fan has to know what they stand to win at the moment they commit.
 * The bill for that choice is this module: somebody at TFC prices every card
 * before it opens, for every card, forever. Seeding each Outcome from a
 * default is what keeps that bill payable — an admin adjusts eight numbers per
 * Bout rather than authoring them from blank.
 *
 * Shared for the same reason `shared/events.ts` is: the server refuses with the
 * sentence the admin area shows, and `test/unit/vocabulary.test.ts` holds all
 * of it to `CONTEXT.md` at once.
 */
import type { Corner } from "./events";

/**
 * One thing asked about a Bout. There are three and there will only ever be
 * three — a Question is not a field somebody adds, it is what a Prediction
 * answers one of (ADR-0014).
 *
 * Spelled out again in the `outcomes_question_known` and
 * `predictions_question_known` check constraints, for the reason given on
 * `Role` in `server/db/schema.ts`.
 */
export type Question = "winner" | "method" | "round";

/** How a Bout ends, when it ends in something gradable. */
export type Method = "ko_tko" | "submission" | "decision";

/**
 * The three Questions, in the order they are asked: who wins, how it ends, and
 * the round it ends in.
 *
 * The order every Outcome is seeded, priced and offered in, said once here.
 * Each is asked on its own terms and answered on its own (ADR-0014), so this
 * is the order they are read in rather than an order they are answered in.
 */
export const QUESTIONS = ["winner", "method", "round"] as const satisfies readonly Question[];

/** The methods of victory, in the order an admin prices them. */
export const METHODS = ["ko_tko", "submission", "decision"] as const satisfies readonly Method[];

/** The corners, in the order they are asked about: red is the home corner. */
export const CORNERS = ["red", "blue"] as const satisfies readonly Corner[];

/** What each Question is called wherever one is shown. */
export const QUESTION_LABELS = {
  winner: "Winner",
  method: "Method of victory",
  round: "Round of victory",
} as const satisfies Record<Question, string>;

/** What each method of victory is called wherever one is shown. */
export const METHOD_LABELS = {
  ko_tko: "KO/TKO",
  submission: "Submission",
  decision: "Decision",
} as const satisfies Record<Method, string>;

/**
 * What one Outcome is called, given the two names the Bout is fought under.
 *
 * Read from the Question the Outcome answers, which is the column that says
 * which of the three answers it carries. The Question's own name stands in for
 * an answer that cannot be missing — `outcomes_answers_its_question` is what
 * makes that unreachable, and an Outcome quietly renamed to the empty string
 * would be a Multiplier with nothing beside it.
 *
 * The corners are passed in rather than looked up because who is in the red
 * corner is a fact about the Bout, not about the Outcome — and because this is
 * said once for the admin pricing a card and the fan reading it, so the two
 * cannot come to call the same Outcome different things.
 */
export function outcomeLabel(outcome: OutcomeAnswer, corners: Record<Corner, string>): string {
  if (outcome.question === "winner") {
    return outcome.corner ? corners[outcome.corner] : QUESTION_LABELS.winner;
  }

  if (outcome.question === "method") {
    return outcome.method ? METHOD_LABELS[outcome.method] : QUESTION_LABELS.method;
  }

  return outcome.round === null ? QUESTION_LABELS.round : `Round ${outcome.round}`;
}

/**
 * Which Question an Outcome answers, and which answer it carries.
 *
 * Exactly one of `corner`, `method` and `round` is ever set, and which one is
 * decided by `question`. Written as three columns rather than one answer field
 * because a round is a number that has to stay a number — the round Outcomes
 * offered are the rounds the Bout is scheduled for, and that is arithmetic, not
 * a string somebody parses back out.
 *
 * This much of an Outcome is what tells it from the others on its Bout, and is
 * all anything sorting or naming them needs. What it pays, who priced it and
 * what its id is are each somebody's else's business.
 */
export interface OutcomeAnswer {
  question: Question;
  corner: Corner | null;
  method: Method | null;
  round: number | null;
}

/**
 * Whether this is one of the three Questions a Bout is asked.
 *
 * Read off the wire in one place — the Prediction a fan submits, which says
 * which Question it answers before it says the answer — and spelled out again
 * in `predictions_question_known`.
 */
export function isQuestion(value: unknown): value is Question {
  return value === "winner" || value === "method" || value === "round";
}

/**
 * Whether this is one of the three methods a Bout can end by.
 *
 * Here rather than beside either of its callers, because both of them are
 * reading the same thing off the wire — a fan's Prediction and an admin's
 * Result — and a Bout ends the same three ways whichever of them is asking.
 * Spelled out again in `outcomes_method_known`, `predictions_method_known` and
 * `bout_results_method_known`.
 */
export function isMethod(value: unknown): value is Method {
  return value === "ko_tko" || value === "submission" || value === "decision";
}

/**
 * Whether this is a round a Bout could be scheduled for.
 *
 * Which rounds *this* Bout has is a fact about the Bout — a three-round card
 * opener has no round 4 — and is checked against the Outcomes it was opened
 * with, by the `predictions_round_is_offered` and `bout_results_round_was_offered`
 * keys underneath that.
 */
export function isRound(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

/**
 * One Outcome as it is seeded: which answer it is, and what it pays until an
 * admin says otherwise.
 */
export interface SeededOutcome extends OutcomeAnswer {
  multiplier: number;
}

/**
 * What a round deeper than its format's row is seeded at.
 *
 * Only a Bout booked over some other number of rounds reaches one: each
 * format's row covers its own rounds. `SCHEDULED_ROUNDS` allows one to twelve,
 * which is the guard against a stuck key rather than a format anybody books, so
 * a round past the fifth repeats the deepest number the table has rather than
 * the table inventing an opinion about a round nobody schedules.
 *
 * The deepest number of the five-round row, said here so that it stays the
 * deepest: the row ends with it. It is on that row's terms rather than on terms
 * of its own — per corner, like every number beside it — so it moves whenever
 * the row does. A deepest number left behind while the row was re-priced around
 * it would pay the deepest round of all on the terms of a table that no longer
 * exists.
 */
const DEEPEST_ROUND_MULTIPLIER = 28.5;

/**
 * What a finish in each round pays on a five-round Bout — a main event or a
 * title fight — and the row every other format is seeded from.
 *
 * Named because it is read twice: as the five-round row of
 * {@link DEFAULT_MULTIPLIERS}, and as the fallback for a Bout booked over some
 * other number of rounds, which is the more forgiving of the two rows to be
 * wrong with. Its numbers climb steeply because a finish is far likelier early
 * than late: reaching round 5 at all means four rounds already failed to end
 * the Bout.
 */
const FIVE_ROUND_MULTIPLIERS = [7.5, 11.9, 17.8, 23.7, DEEPEST_ROUND_MULTIPLIER] as const;

/**
 * What each Outcome pays before anybody has looked at the Bout.
 *
 * A starting point, deliberately not a price: nothing here knows which fighter
 * is favoured, and the two corners are seeded level because the table cannot
 * tell them apart. What it is for is the shape of a card — that a Submission
 * pays more than a KO/TKO, and a deep round more than an early one — so an
 * admin pricing a card is correcting numbers rather than inventing them.
 *
 * **Every number here is what one corner pays, which is why the method and
 * round rows are twice what a Bout-level table would carry.** Every answer
 * names a fighter (ADR-0015) and this table cannot tell the two apart, so a
 * chance about the Bout — that it ends by Submission, that it ends in round 2 —
 * splits evenly between the corners, and half a chance is twice the Multiplier.
 * That is not a new principle: it is the one already seeding both winner
 * Outcomes at 1.90, applied to the other two Questions now that they have
 * corners to be level between. The winner row does not move, because "red
 * wins" always named a fighter. There is no per-corner row here for the same
 * reason there is no favourite: nothing that writes this knows which fighter is
 * which, so one number is what each of the two is seeded from.
 *
 * The split is a fact about these numbers before it is a fact about the
 * Outcomes they seed. {@link defaultOutcomes} still writes one method Outcome
 * and one round Outcome per Bout rather than one per corner — #41 is what gives
 * them their corners — so until it lands a card offers half the answers these
 * numbers are priced for, and implies half the totals below.
 *
 * Every number stands for its own answer outright (ADR-0014): "Submission at
 * 8.10" means 8.10 if that fighter wins the Bout that way. Nothing here is
 * conditional on anything else, which is what lets a Question be read back as
 * the chances it implies — 1 ÷ each Multiplier, across both corners — and each
 * Question implies a total somebody chose rather than a total nobody noticed.
 * **Those totals are exactly what they were before the answers named a
 * fighter**: the split spreads each of them over twice as many answers rather
 * than moving any of them.
 *
 * That total is what the Question is worth plus a margin, and **the margin
 * scales with how well the table knows the answer.** The winner Question
 * carries about 5%: 50/50 is *known* before anybody looks at the two fighters,
 * so there is no estimate here to be wrong about and no reason to charge for
 * one. Method and round carry about 8%, because they rest on a prior — a
 * regional promotion finishes something like 65% of its Bouts — and the three
 * extra points are protection against that estimate being off, not a wider
 * spread taken for its own sake.
 *
 * **Decision at 5.30 is the cell that reads like a typo**, and it is the one an
 * admin is most likely to "correct" back. Two numbers look righter than it and
 * both are expensive. 2.65 is this one with the corner split undone, and pays a
 * Decision by a named fighter at the chance of a Decision by either of them.
 * 2.00 is the older mistake beneath that: it implies a Decision every other
 * Bout, where at regional level roughly two Bouts in three end in a finish,
 * which leaves a Decision at about 35%. Split between the corners and carrying
 * the method Question's 8%, that 35% is 5.30 — an 18.9% implied chance for each
 * fighter, 37.7% across the pair. Halved back to 2.65 the method Question
 * implies about 146% rather than 108%, and at 2.00 about 170%: a margin charged
 * almost entirely on one answer, and on the ending a fan is second most likely
 * to be right about.
 *
 * **Round 5 of a five-round Bout seeds at 28.50, and that is the cell of the
 * round rows that reads like a typo.** It is the deepest round of the format
 * least likely to reach it, split between two corners: reaching round 5 at all
 * means four rounds already failed to end the Bout, and then it has to be that
 * fighter who ends it. An admin who "corrects" it back to 14.25 is pricing a
 * Bout ending in round 5 at twice its chance, and paying for it every card.
 */
export const DEFAULT_MULTIPLIERS = {
  winner: { red: 1.9, blue: 1.9 },
  method: { ko_tko: 4.4, submission: 8.1, decision: 5.3 },
  /**
   * By the rounds the Bout is scheduled for, then by the round.
   *
   * Two rows rather than one map, because the same round is a different
   * question in each format TFC books: round 3 of a three-round Bout is the
   * last one and catches everything still standing, where round 3 of a
   * five-rounder is a middle round with two more behind it. One row served
   * both, and it was wrong for at least one of them everywhere they differ.
   *
   * A row read across both corners totals to the finishes, not to the whole
   * Bout: about 70%, which is the same 65% prior the method row carries with
   * the same 8% on it. What is missing from 100% is the Decisions — 35% as a
   * prior, and the 37.7% the method row prices them at — because a Decision
   * ends in no round at all. A round Prediction on a Bout that went the
   * distance is wrong rather than unanswered (ADR-0014).
   */
  round: {
    3: [6.3, 9.5, 11.4],
    5: FIVE_ROUND_MULTIPLIERS,
  } as Record<number, readonly number[]>,
} as const satisfies {
  winner: Record<Corner, number>;
  method: Record<Method, number>;
  round: Record<number, readonly number[]>;
};

/**
 * Every Outcome a Bout is imported with, in the order an admin prices them.
 *
 * The round Outcomes are generated from the rounds the Bout is actually
 * scheduled for, so a three-round Bout offers no round 4 to predict and a fan
 * cannot be shown a round that does not exist (#10 renders exactly these).
 */
export function defaultOutcomes(scheduledRounds: number): SeededOutcome[] {
  const winners: SeededOutcome[] = CORNERS.map((corner) => ({
    question: "winner",
    corner,
    method: null,
    round: null,
    multiplier: DEFAULT_MULTIPLIERS.winner[corner],
  }));

  const methods: SeededOutcome[] = METHODS.map((method) => ({
    question: "method",
    corner: null,
    method,
    round: null,
    multiplier: DEFAULT_MULTIPLIERS.method[method],
  }));

  // The row this Bout is booked in, or the five-round row for a Bout booked in
  // neither of the two formats TFC runs.
  const booked = DEFAULT_MULTIPLIERS.round[scheduledRounds] ?? FIVE_ROUND_MULTIPLIERS;

  const rounds: SeededOutcome[] = Array.from({ length: scheduledRounds }, (_, index) => ({
    question: "round",
    corner: null,
    method: null,
    round: index + 1,
    multiplier: booked[index] ?? DEEPEST_ROUND_MULTIPLIER,
  }));

  return [...winners, ...methods, ...rounds];
}

/**
 * What a Multiplier may be set to.
 *
 * The floor is the whole point of the number: a Multiplier is what a correct
 * Prediction pays, so at 1 a fan who was right gets their Coins back and below
 * it they are punished for it. Neither is a price anybody meant to type.
 *
 * The ceiling is not a rule about pricing but a guard against a stuck key —
 * 190 where 1.90 was meant. A combined Multiplier is capped at ×100 whatever
 * it multiplies out to, so nothing above that could be paid anyway.
 *
 * Spelled out again in the `outcomes_multiplier_pays` check constraint and in
 * the `numeric(5, 2)` the column is stored as.
 */
export const MULTIPLIER = { above: 1, maximum: 100, decimals: 2 } as const;

/** Everything pricing a Bout and opening it says to the admin doing it. */
export const PRICING_MESSAGES = {
  cardNotImported:
    "That card is not in the game. Import it first, and its Bouts arrive with " +
    "a Multiplier on every Outcome to adjust.",
  boutNotFound:
    "That Bout is no longer on the card. Re-importing replaces every Bout, so " +
    "one may have been replaced since this page was opened. Reload it.",
  notThisBout:
    "One of those Outcomes is not on this Bout. Reload the page — the card may " +
    "have been re-imported since it was opened, and a re-imported Bout is a " +
    "new Bout with Outcomes of its own.",
  unpriced:
    "This Bout has Outcomes nobody has priced, so it cannot be opened. A " +
    "seeded Multiplier is a starting point rather than a price: nothing that " +
    "wrote it knows which fighter is favoured, and nothing corrects it once " +
    "fans are committing Coins against it.",
  alreadyOpen: "This Bout is already open for predictions.",
  multiplier:
    `A Multiplier has to be above ${MULTIPLIER.above} and no higher than ` +
    `${MULTIPLIER.maximum}, to ${MULTIPLIER.decimals} decimal places. At ` +
    `${MULTIPLIER.above} a correct Prediction returns exactly the Coins ` +
    "committed, and below it a fan is left worse off for having been right.",
  nothingToPrice: "Nothing was sent to price, so nothing was changed.",
} as const satisfies Record<string, string>;

/**
 * How one Outcome is told from another on the same Bout: the Question it
 * answers and which answer it is.
 *
 * Not an id — this is the identity an Outcome has before it is written, so
 * that the order an admin prices Outcomes in can be the order they were seeded
 * in, said once in {@link defaultOutcomes} rather than again in SQL.
 */
export function outcomeKey(outcome: OutcomeAnswer): string {
  return `${outcome.question}:${outcome.corner ?? outcome.method ?? outcome.round}`;
}

/**
 * Outcomes in the order they were seeded, which is the order an admin prices
 * them in and the order a fan is offered them in.
 *
 * Sorted here rather than in SQL because the order is a fact about the domain
 * — winner, then method, then round; red before blue; round 1 before round 2 —
 * and {@link defaultOutcomes} is where that is written down. Ordering by the
 * columns would put "blue" before "red" and "method" before "winner", and
 * would need saying again in every query.
 */
export function inAskedOrder<Outcome extends OutcomeAnswer>(
  unordered: readonly Outcome[],
  scheduledRounds: number,
): Outcome[] {
  const asked = defaultOutcomes(scheduledRounds).map(outcomeKey);
  const place = (outcome: Outcome) => {
    const at = asked.indexOf(outcomeKey(outcome));

    // An Outcome the table no longer asks about — a Bout whose scheduled
    // rounds were cut by a re-import would be one, if a re-import kept its
    // Bouts. It sorts last rather than disappearing.
    return at === -1 ? asked.length : at;
  };

  return [...unordered].sort((one, another) => place(one) - place(another));
}

/** A Multiplier an admin has set on one Outcome. */
export interface OutcomeMultiplier {
  outcomeId: string;
  multiplier: number;
}

/** Multipliers ready to be written, or the reason they are not. */
export type ParsedMultipliers =
  | { multipliers: OutcomeMultiplier[]; problem?: undefined }
  | { multipliers?: undefined; problem: string };

/**
 * Reads what an admin typed into a Bout's Multipliers.
 *
 * Only the numbers are decided here. Whether those Outcomes are on that Bout
 * is a question only the database can answer, and it is asked before any of
 * this is written.
 *
 * A save is refused whole: if one Multiplier in it is not a price, none of
 * them is written. Writing the ones that parsed would leave a Bout priced in
 * part, which reads as priced.
 */
export function parseMultipliers(value: unknown): ParsedMultipliers {
  if (typeof value !== "object" || value === null) {
    return { problem: PRICING_MESSAGES.nothingToPrice };
  }

  const entries = Object.entries(value);

  if (entries.length === 0) return { problem: PRICING_MESSAGES.nothingToPrice };

  const multipliers: OutcomeMultiplier[] = [];

  for (const [outcomeId, multiplier] of entries) {
    if (!isMultiplier(multiplier)) return { problem: PRICING_MESSAGES.multiplier };

    multipliers.push({ outcomeId, multiplier });
  }

  return { multipliers };
}

/**
 * Whether a number is a Multiplier this application will store.
 *
 * The decimal places are checked rather than rounded away: `numeric(5, 2)`
 * would round 1.955 to 1.96 on the way in, and an admin who pressed save would
 * be looking at a number they did not type.
 */
function isMultiplier(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > MULTIPLIER.above &&
    value <= MULTIPLIER.maximum &&
    Number(value.toFixed(MULTIPLIER.decimals)) === value
  );
}
