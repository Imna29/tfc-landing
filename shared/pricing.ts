/**
 * Pricing a Bout: the Questions asked about it, the Outcomes that answer them,
 * and the table every Multiplier starts from.
 *
 * ADR-0002 chose fixed Multipliers set by hand over a self-balancing pool,
 * because a fan has to know what they stand to win at the moment they commit.
 * The bill for that choice is this module: somebody at TFC prices every card
 * before it opens, for every card, forever. Seeding each Outcome from a
 * default is what keeps that bill payable — an admin adjusts a Bout's numbers
 * rather than authoring them from blank.
 *
 * **How many of them there are is the discipline's to say** (ADR-0017): eight
 * on an MMA Bout, six on a CageBox one, and two on a Cage Grappling Bout, which
 * is asked for a winner and nothing else. What is being fought decides what can
 * be asked about it, and this module is where that becomes the Outcomes a Bout
 * carries.
 *
 * Shared for the same reason `shared/events.ts` is: the server refuses with the
 * sentence the admin area shows, and `test/unit/vocabulary.test.ts` holds all
 * of it to `CONTEXT.md` at once.
 */
import type { Corner } from "./events";
import type { Discipline } from "./fightCard";

/**
 * One thing asked about a Bout. There are two — a Question is not a field
 * somebody adds, it is what a Prediction answers one of (ADR-0014).
 *
 * There were three. The round of victory was retired by ADR-0016: it was the
 * Question a fan was least able to answer and the one that made a Bout's
 * offering depend on how long it was booked for, and the game asks the winner
 * and the method of victory now.
 *
 * **Not every Bout is asked both.** The winner Question is asked of every Bout
 * on every card; the method Question is asked only where the discipline has
 * methods, which is everything but Cage Grappling (ADR-0017). See
 * {@link questionsAsked}.
 *
 * Spelled out again in the `outcomes_question_known` and
 * `predictions_question_known` check constraints, for the reason given on
 * `Role` in `server/db/schema.ts`.
 */
export type Question = "winner" | "method";

/**
 * How a Bout ends, when it ends in something gradable.
 *
 * The three the game has between them, rather than the three any one Bout can
 * end by: which of these a given Bout may produce is its discipline's to say
 * (ADR-0017), and {@link methodsAsked} is where that is asked.
 */
export type Method = "ko_tko" | "submission" | "decision";

/**
 * The two Questions, in the order they are asked: who wins, and how they win.
 *
 * The order every Outcome is seeded, priced and offered in, said once here.
 * Each is asked on its own terms and answered on its own (ADR-0014), so this
 * is the order they are read in rather than an order they are answered in.
 */
export const QUESTIONS = ["winner", "method"] as const satisfies readonly Question[];

/**
 * Every method of victory the game has, in the order an admin prices them.
 *
 * The whole vocabulary. What one Bout is asked is {@link methodsAsked}, which
 * is a subset of this, in this order.
 */
export const METHODS = ["ko_tko", "submission", "decision"] as const satisfies readonly Method[];

/** The corners, in the order they are asked about: red is the home corner. */
export const CORNERS = ["red", "blue"] as const satisfies readonly Corner[];

/** What each Question is called wherever one is shown. */
export const QUESTION_LABELS = {
  winner: "Winner",
  method: "Method of victory",
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
 * **Every answer names the fighter it is about** (ADR-0015). A winner Outcome
 * is that fighter's name, and a method Outcome is "Tsiklauri by KO/TKO". The
 * bare form it replaces — "KO/TKO" — read beside a Winner column listing two
 * fighters as though it were about one of them, and never said which.
 *
 * Read from the Question the Outcome answers, which is the column that says
 * whether it carries a method at all. The Question's own name stands in for an
 * answer that cannot be missing — `outcomes_answers_its_question` is what makes
 * that unreachable, and an Outcome quietly renamed to the empty string would be
 * a Multiplier with nothing beside it.
 *
 * The corners are passed in rather than looked up because who is in the red
 * corner is a fact about the Bout, not about the Outcome — and because this is
 * said once for the admin pricing a card and the fan reading it, so the two
 * cannot come to call the same Outcome different things.
 */
export function outcomeLabel(outcome: OutcomeAnswer, corners: Record<Corner, string>): string {
  const fighter = corners[outcome.corner];

  if (outcome.question === "winner") return fighter;

  return outcome.method ? `${fighter} by ${METHOD_LABELS[outcome.method]}` : QUESTION_LABELS.method;
}

/**
 * The same answer with the fighter lifted out of it, for a screen that has
 * already named them: "Wins", "KO/TKO".
 *
 * Beside {@link outcomeLabel} rather than in the admin area, because these are
 * two ways of saying one thing and the danger is that they come to say
 * different things. What a fan reads is always the full name; this is the
 * layout the admin pricing screen needs to hold up to eight inputs per Bout
 * legibly (ADR-0015), where the corner is a heading over a row of answers
 * rather than a word repeated down every label. Every input on that screen is
 * still labelled to a screen reader with the full name.
 *
 * "Wins" rather than nothing on the winner Question, because a box with no
 * words beside it is a Multiplier nobody can check.
 */
export function answerLabel(outcome: OutcomeAnswer): string {
  if (outcome.question === "winner") return "Wins";

  return outcome.method ? METHOD_LABELS[outcome.method] : QUESTION_LABELS.method;
}

/**
 * Which Question an Outcome answers, which fighter it is about, and which
 * answer it carries.
 *
 * **A corner always**, plus a `method` exactly where `question` says so — a
 * winner Outcome carries none. Every answer is about a fighter (ADR-0015), and
 * `outcomes_answers_its_question` and `predictions_answers_its_question` are
 * where Postgres holds both halves of that.
 *
 * `method` is its own column rather than a general answer field, because that
 * is what lets Postgres say a method Outcome carries a method and a winner
 * Outcome carries none — `outcomes_answers_its_question` is written in terms of
 * it.
 *
 * This much of an Outcome is what tells it from the others on its Bout, and is
 * all anything sorting or naming them needs. What it pays, who priced it and
 * what its id is are each somebody's else's business.
 */
export interface OutcomeAnswer {
  question: Question;
  corner: Corner;
  method: Method | null;
}

/**
 * Whether this is one of the two Questions a Bout is asked.
 *
 * Read off the wire in one place — the Prediction a fan submits, which says
 * which Question it answers before it says the answer — and spelled out again
 * in `predictions_question_known`.
 */
export function isQuestion(value: unknown): value is Question {
  return value === "winner" || value === "method";
}

/**
 * Whether this is one of the methods the game knows a Bout can end by.
 *
 * Here rather than beside either of its callers, because both of them are
 * reading the same thing off the wire — a fan's Prediction and an admin's
 * Result — and the word means the same thing whichever of them is asking.
 * **Whether this Bout may end that way is a different question**, asked of its
 * discipline by {@link methodsAsked} (ADR-0017).
 * Spelled out again in `outcomes_method_known`, `predictions_method_known` and
 * `bout_results_method_known`.
 */
export function isMethod(value: unknown): value is Method {
  return value === "ko_tko" || value === "submission" || value === "decision";
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
 * pays more than a KO/TKO — so an admin pricing a card is correcting numbers
 * rather than inventing them.
 *
 * **Every number here is what one corner pays, which is why the method row is
 * twice what a Bout-level table would carry.** Every answer names a fighter
 * (ADR-0015) and this table cannot tell the two apart, so a chance about the
 * Bout — that it ends by Submission — splits evenly between the corners, and
 * half a chance is twice the Multiplier. That is not a new principle: it is the
 * one already seeding both winner Outcomes at 1.90, applied to the method
 * Question now that it has corners to be level between. The winner row does not
 * move, because "red wins" always named a fighter. There is no per-corner row
 * here for the same reason there is no favourite: nothing that writes this
 * knows which fighter is which, so one number is what each of the two is seeded
 * from.
 *
 * The split is a fact about these numbers before it is a fact about the
 * Outcomes they seed, and {@link defaultOutcomes} is where it becomes one: it
 * writes each of these numbers onto both corners, so a Bout offers exactly the
 * answers they are priced for and implies exactly the totals below.
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
 * one. Method carries about 8%, because it rests on a prior — a regional
 * promotion finishes something like 65% of its Bouts — and the three extra
 * points are protection against that estimate being off, not a wider spread
 * taken for its own sake.
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
 * There is no round row, and there is no row that depends on how many rounds a
 * Bout is booked over. ADR-0016 retired the round Question, and with it the one
 * part of this table that had to know whether a Bout was scheduled for three
 * rounds or five.
 *
 * **The method row is per discipline, and that is not the same thing coming
 * back** (ADR-0017). The format a Bout is booked in is a rule about how long it
 * lasts; the discipline it is fought in is what is being fought, and it decides
 * which endings exist at all — a CageBox Bout cannot end in a Submission, and a
 * Cage Grappling Bout has no method of victory to ask about. So this table is
 * also **where a discipline's methods are written down**: a method with no
 * number here is one that discipline is not asked, because a Bout with an
 * unpriced Outcome cannot be opened and an answer nobody could price is an
 * answer no fan could ever be offered. {@link methodsAsked} reads it back.
 *
 * **A narrowed Question is worth what it was worth**, spread over the answers
 * that remain. CageBox's two numbers are MMA's KO/TKO and Decision with the
 * Submission's share of the chance shared out between them in proportion to
 * what the table already said about the pair, so the method Question still
 * implies about 108% across both corners. Taking an answer away does not make
 * the Question easier to be right about — it makes the answers that are left
 * likelier — and a table that simply dropped the row would have priced a
 * two-answer Question at a three-answer Question's margin, handing back about
 * 25 points of it on every CageBox Bout on every card.
 *
 * Cage Grappling has no method row at all, and an empty object rather than a
 * row of zeroes: there is nothing to price, because there is nothing asked.
 */
export const DEFAULT_MULTIPLIERS = {
  winner: { red: 1.9, blue: 1.9 },
  method: {
    mma: { ko_tko: 4.4, submission: 8.1, decision: 5.3 },
    cagebox: { ko_tko: 3.39, decision: 4.09 },
    cage_grappling: {},
  },
} as const satisfies {
  winner: Record<Corner, number>;
  method: Record<Discipline, Partial<Record<Method, number>>>;
};

/**
 * The methods of victory this discipline's Bouts can end by, each with what it
 * is seeded at, in the order an admin prices them.
 *
 * **The one place the method half of {@link DEFAULT_MULTIPLIERS} is read**, and
 * what makes "a method with no number in the table is a method this discipline
 * is not asked" a fact rather than a comment: the list and the prices come out
 * of the same pass over the same object, so there is nothing for them to
 * disagree about.
 *
 * Filtered out of {@link METHODS} rather than listed again, so a discipline's
 * answers come back in the order every other Bout's do: a CageBox Bout reads
 * KO/TKO then Decision, which is an MMA Bout with the Submission taken out.
 */
function seededMethods(discipline: Discipline): { method: Method; multiplier: number }[] {
  const seeded: Partial<Record<Method, number>> = DEFAULT_MULTIPLIERS.method[discipline];

  return METHODS.flatMap((method) => {
    const multiplier = seeded[method];

    return multiplier === undefined ? [] : [{ method, multiplier }];
  });
}

/**
 * The methods of victory this discipline's Bouts can end by, in the order an
 * admin prices them.
 *
 * MMA has all three, CageBox has KO/TKO and Decision, and Cage Grappling has
 * none — which is the Question not being asked rather than a Question with no
 * answers (ADR-0017). {@link questionsAsked} is where that difference is said.
 *
 * Spelled out again in the `a_result_records_the_method_its_discipline_asks`
 * trigger, which is what holds a Result to it, and
 * `test/server/settlement.test.ts` is what holds the two lists together.
 */
export function methodsAsked(discipline: Discipline): Method[] {
  return seededMethods(discipline).map((seeded) => seeded.method);
}

/**
 * The Questions this discipline's Bouts are asked, in the order they are asked.
 *
 * Two for MMA and CageBox, one for Cage Grappling. A discipline with no method
 * of victory is not asked the method Question at all — there is no Outcome to
 * offer, no Prediction to make, and nothing for an admin to record — which is
 * the difference between a Question narrowed and a Question dropped.
 */
export function questionsAsked(discipline: Discipline): Question[] {
  return QUESTIONS.filter(
    (question) => question !== "method" || methodsAsked(discipline).length > 0,
  );
}

/**
 * Every Outcome a Bout of this discipline is imported with, in the order an
 * admin prices them.
 *
 * **Each Question it is asked, of both fighters** (ADR-0015). An MMA Bout is
 * eight answers, a CageBox Bout six, and a Cage Grappling Bout two — because
 * what a Bout offers is what it is fought under (ADR-0017), and the winner
 * Question is the one every discipline is asked. Each corner is seeded from the
 * same number, because nothing here knows which fighter is favoured.
 *
 * The order is the order they are asked in and the order they are read in:
 * winner, then method, and red before blue within each. It is what
 * {@link inAskedOrder} sorts everything else back into.
 *
 * **Takes the discipline and nothing else.** How long a Bout is booked for
 * still decides nothing (ADR-0016): a three-round MMA Bout and a five-round one
 * are asked the same eight things, and it is a Cage Grappling Bout beside them
 * that is asked something different.
 */
export function defaultOutcomes(discipline: Discipline): SeededOutcome[] {
  const winners: SeededOutcome[] = CORNERS.map((corner) => ({
    question: "winner",
    corner,
    method: null,
    multiplier: DEFAULT_MULTIPLIERS.winner[corner],
  }));

  const methods: SeededOutcome[] = CORNERS.flatMap((corner) =>
    seededMethods(discipline).map(({ method, multiplier }) => ({
      question: "method" as const,
      corner,
      method,
      multiplier,
    })),
  );

  return [...winners, ...methods];
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
 * answers, the fighter it is about, and which answer it is.
 *
 * **The corner is part of the identity** (ADR-0015). "Tsiklauri by KO/TKO" and
 * "Beridze by KO/TKO" are two answers at two prices, and a key that read only
 * the method would price one of them at the other's Multiplier — which is what
 * `priceOf` in `shared/entries.ts` does with this, on both sides of a
 * submission. A winner Outcome carries no method, so its key ends in nothing:
 * the corner is the whole of its answer.
 *
 * Not an id — this is the identity an Outcome has before it is written, so
 * that the order an admin prices Outcomes in can be the order they were seeded
 * in, said once in {@link defaultOutcomes} rather than again in SQL.
 */
export function outcomeKey(outcome: OutcomeAnswer): string {
  return `${outcome.question}:${outcome.corner}:${outcome.method ?? ""}`;
}

/**
 * Every answer the game has, in the order it asks them: winner then method,
 * red before blue, KO/TKO before Submission before Decision.
 *
 * The whole vocabulary rather than any one Bout's share of it, which is what
 * lets {@link inAskedOrder} sort without being told the discipline. A CageBox
 * Bout's answers are a subsequence of this, so sorting them by it reads winner,
 * KO/TKO, Decision — an MMA Bout with the Submission taken out — and a Cage
 * Grappling Bout's two winner answers sort the same way they always did.
 */
const ASKED_ORDER: string[] = [
  ...CORNERS.map((corner) => outcomeKey({ question: "winner", corner, method: null })),
  ...CORNERS.flatMap((corner) =>
    METHODS.map((method) => outcomeKey({ question: "method", corner, method })),
  ),
];

/**
 * Outcomes in the order they were seeded, which is the order an admin prices
 * them in and the order a fan is offered them in.
 *
 * Sorted here rather than in SQL because the order is a fact about the domain
 * — winner, then method; red before blue; KO/TKO before Submission before
 * Decision — and {@link ASKED_ORDER} is where that is written down. Ordering by
 * the columns would put "blue" before "red" and "method" before "winner", and
 * would need saying again in every query.
 *
 * **Takes no discipline**, and does not need one. What a Bout offers is a
 * subset of what the game asks (ADR-0017), so the order of the whole is the
 * order of every part of it — and a function told which Bout's Outcomes these
 * are could be told wrong.
 */
export function inAskedOrder<Outcome extends OutcomeAnswer>(
  unordered: readonly Outcome[],
): Outcome[] {
  const place = (outcome: Outcome) => {
    const at = ASKED_ORDER.indexOf(outcomeKey(outcome));

    // An Outcome the game no longer asks about — a round Outcome written
    // before ADR-0016 would have been one, if the migration that retired the
    // Question had left any behind. It sorts last rather than disappearing.
    return at === -1 ? ASKED_ORDER.length : at;
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
