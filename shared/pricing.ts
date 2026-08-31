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
 * three — a Question is not a field somebody adds, it is what a Prediction is
 * made of (ADR-0004).
 *
 * Spelled out again in the `outcomes_question_known` check constraint, for the
 * reason given on `Role` in `server/db/schema.ts`.
 */
export type Question = "winner" | "method" | "round";

/** How a Bout ends, when it ends in something gradable. */
export type Method = "ko_tko" | "submission" | "decision";

/**
 * The three Questions, in the order they are asked: a fan picks a winner, then
 * deepens that pick with a method and a round (ADR-0004).
 *
 * The order every Outcome is seeded, priced and offered in, said once here.
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
 * What each Outcome pays before anybody has looked at the Bout.
 *
 * A starting point, deliberately not a price: nothing here knows which fighter
 * is favoured, and the two corners are seeded level because the table cannot
 * tell them apart. What it is for is the shape of a card — that a Submission
 * pays more than a KO/TKO, and a named round more than either — so an admin
 * pricing a card is correcting numbers rather than inventing them.
 *
 * The method and round Multipliers are conditional on the winner the fan
 * picked, because ADR-0004 multiplies them onto a winner pick rather than
 * treating them as a chain of their own. "Submission at 3.2" therefore means
 * "3.2 given that the fighter you picked wins", which is what makes eight
 * numbers enough where pricing every combination by hand would be thirty.
 */
export const DEFAULT_MULTIPLIERS = {
  winner: { red: 1.9, blue: 1.9 },
  method: { ko_tko: 2.2, submission: 3.2, decision: 2 },
  /** By the round it is: finishes cluster early, so a late round pays more. */
  round: { 1: 3, 2: 3.2, 3: 3.6, 4: 4.5, 5: 5 } as Record<number, number>,
} as const satisfies {
  winner: Record<Corner, number>;
  method: Record<Method, number>;
  round: Record<number, number>;
};

/**
 * What a round beyond the fifth is seeded at.
 *
 * TFC schedules three rounds, or five for a main event or a title fight. The
 * twelve `SCHEDULED_ROUNDS` allows is the guard against a stuck key, not a
 * format anybody books — so rounds past the fifth take the deepest number in
 * the table rather than the table pretending to have an opinion about them.
 */
const DEEPEST_ROUND_MULTIPLIER = 5;

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

  const rounds: SeededOutcome[] = Array.from({ length: scheduledRounds }, (_, index) => {
    const round = index + 1;

    return {
      question: "round",
      corner: null,
      method: null,
      round,
      multiplier: DEFAULT_MULTIPLIERS.round[round] ?? DEEPEST_ROUND_MULTIPLIER,
    };
  });

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
