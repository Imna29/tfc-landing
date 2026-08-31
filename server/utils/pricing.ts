/**
 * Pricing Bouts in Postgres: seeding the Outcomes a Bout is asked about, and
 * the Multipliers an admin sets on them.
 *
 * `shared/pricing.ts` decides what a Bout is *asked* and what a Multiplier may
 * *be*; this decides what the game *charges*. The rule that matters is the one
 * this file cannot enforce on its own — a Bout opens only once every Outcome
 * on it has been priced — and that is held by the trigger in
 * `0005_multipliers_and_opening_bouts.sql`. See ADR-0002 for why there is
 * nothing to self-correct a mispriced Outcome once fans are on it.
 */
import type { BoutStatus, Corner } from "#shared/events";
import {
  defaultOutcomes,
  inAskedOrder,
  MULTIPLIER,
  type Method,
  type OutcomeMultiplier,
  type Question,
} from "#shared/pricing";
import { and, eq, sql, type SQL } from "drizzle-orm";
import type { DatabaseTransaction } from "../db/client";
import { bouts, events, outcomes, seasons } from "../db/schema";
import { useDatabase } from "./db";

/** The name of the trigger that refuses to open a Bout nobody has priced. */
export const BOUTS_ARE_OPENED_ONLY_WHEN_PRICED = "bouts_are_opened_only_when_priced";

/**
 * Writes every Outcome these Bouts are asked about, seeded from the default
 * table and priced by nobody.
 *
 * Takes the transaction to run inside rather than opening one: a Bout written
 * without its Outcomes is a fight the game cannot ask a Question about, and it
 * would be one nothing later notices — the Bout looks imported.
 */
export async function seedOutcomes(
  tx: DatabaseTransaction,
  imported: readonly { id: string; scheduledRounds: number }[],
): Promise<void> {
  await tx
    .insert(outcomes)
    .values(
      imported.flatMap((bout) =>
        defaultOutcomes(bout.scheduledRounds).map((outcome) => ({ boutId: bout.id, ...outcome })),
      ),
    );
}

/** One Outcome of a Bout, as the admin pricing it sees it. */
export interface OutcomeToPrice {
  id: string;
  question: Question;
  corner: Corner | null;
  method: Method | null;
  round: number | null;
  multiplier: number;
  /** Whether an admin set this, or it is still what import seeded. */
  priced: boolean;
}

/** One Bout of an imported card, with what each answer to it pays. */
export interface BoutToPrice {
  id: string;
  cardOrder: number;
  status: BoutStatus;
  /** The name each corner is fought under, as the card was imported with. */
  redName: string;
  blueName: string;
  division: string;
  scheduledRounds: number;
  mainEvent: boolean;
  titleFight: boolean;
  /** Whether every Outcome has been priced, which is what opening asks. */
  priced: boolean;
  outcomes: OutcomeToPrice[];
}

/** An imported card, as the admin pricing it sees it. */
export interface CardToPrice {
  id: string;
  title: string;
  scheduledStart: Date;
  venue: string;
  seasonName: string;
  bouts: BoutToPrice[];
}

/**
 * An imported card and every Multiplier on it, or `null` for an Event nobody
 * has imported.
 *
 * The whole card in one answer rather than a Bout at a time, because pricing
 * is done to a card: an admin sits down once before it opens and goes through
 * it, and what they need to see is which Bouts on it are still to do.
 */
export async function cardToPrice(eventId: string): Promise<CardToPrice | null> {
  const [event] = await useDatabase()
    .select({
      id: events.id,
      title: events.title,
      scheduledStart: events.scheduledStart,
      venue: events.venue,
      seasonName: seasons.name,
    })
    .from(events)
    .innerJoin(seasons, eq(seasons.id, events.seasonId))
    .where(eq(events.id, eventId))
    .limit(1);

  if (!event) return null;

  return { ...event, bouts: await boutsToPrice(eq(bouts.eventId, eventId)) };
}

/** One Bout and its Outcomes, or `null` for a Bout a re-import has replaced. */
export async function boutToPrice(boutId: string): Promise<BoutToPrice | null> {
  const [bout] = await boutsToPrice(eq(bouts.id, boutId));

  return bout ?? null;
}

/**
 * Sets these Multipliers on this Bout's Outcomes and records who set them,
 * answering with how many were actually priced.
 *
 * One statement rather than one per Outcome: a save is a whole Bout's pricing,
 * and eight round trips would be eight chances to be interrupted halfway
 * through a card that would then look half priced.
 *
 * `boutId` is in the `where` clause as well as the ids, so an Outcome on
 * another Bout cannot be priced through this Bout's URL however it got into
 * the request. The caller checks the same thing first, so that an admin is
 * told what went wrong rather than being told nothing changed.
 *
 * `multipliers` is never empty: `parseMultipliers` refuses a save that prices
 * nothing, and a `values ()` list is not SQL.
 */
export async function priceOutcomes(
  boutId: string,
  multipliers: readonly OutcomeMultiplier[],
  pricedBy: string,
): Promise<number> {
  const asked = sql.join(
    multipliers.map(
      ({ outcomeId, multiplier }) =>
        // Written out to the places the column stores rather than handed over
        // as a float, so that what an admin typed is what Postgres rounds.
        sql`(${outcomeId}::uuid, ${multiplier.toFixed(MULTIPLIER.decimals)}::numeric)`,
    ),
    sql`, `,
  );

  const priced = await useDatabase().execute<{ id: string }>(sql`
    update ${outcomes} as o
    set multiplier = asked.multiplier, priced_at = now(), priced_by = ${pricedBy}::uuid
    from (values ${asked}) as asked (id, multiplier)
    where o.id = asked.id and o.bout_id = ${boutId}::uuid
    returning o.id
  `);

  return priced.length;
}

/**
 * Opens a Bout for predictions, answering whether this call is what opened it.
 *
 * `closed` is in the `where` clause so that opening is something that happens
 * once: a Bout that has been locked or settled is not reopened by a second
 * press of the button, and #12 does not have to remember to stop it.
 *
 * Whether it *may* be opened is not decided here. The trigger named by
 * {@link BOUTS_ARE_OPENED_ONLY_WHEN_PRICED} refuses a Bout with an unpriced
 * Outcome, which is what makes two admins pressing the button either side of
 * one another harmless — and what makes the rule true of a hand-written
 * `update` as well.
 */
export async function openBout(boutId: string): Promise<boolean> {
  const opened = await useDatabase()
    .update(bouts)
    .set({ status: "open" })
    .where(and(eq(bouts.id, boutId), eq(bouts.status, "closed")))
    .returning({ id: bouts.id });

  return opened.length > 0;
}

/**
 * The Bouts matching a condition, each with its Outcomes in the order they
 * were asked.
 *
 * One query with a join rather than a query per Bout: a card is up to a dozen
 * Bouts of eight Outcomes each, and this is read on every save.
 */
async function boutsToPrice(where: SQL): Promise<BoutToPrice[]> {
  const rows = await useDatabase()
    .select({
      id: bouts.id,
      cardOrder: bouts.cardOrder,
      status: bouts.status,
      redName: bouts.redName,
      blueName: bouts.blueName,
      division: bouts.division,
      scheduledRounds: bouts.scheduledRounds,
      mainEvent: bouts.mainEvent,
      titleFight: bouts.titleFight,
      outcome: {
        id: outcomes.id,
        question: outcomes.question,
        corner: outcomes.corner,
        method: outcomes.method,
        round: outcomes.round,
        multiplier: outcomes.multiplier,
        pricedAt: outcomes.pricedAt,
      },
    })
    .from(bouts)
    .leftJoin(outcomes, eq(outcomes.boutId, bouts.id))
    .where(where)
    .orderBy(bouts.cardOrder);

  const card = new Map<string, BoutToPrice>();

  for (const { outcome, ...bout } of rows) {
    const priced = card.get(bout.id) ?? { ...bout, priced: false, outcomes: [] };

    card.set(bout.id, priced);

    if (outcome) {
      priced.outcomes.push({
        id: outcome.id,
        question: outcome.question,
        corner: outcome.corner,
        method: outcome.method,
        round: outcome.round,
        multiplier: outcome.multiplier,
        priced: outcome.pricedAt !== null,
      });
    }
  }

  return [...card.values()].map((bout) => ({
    ...bout,
    // The same question the trigger asks. A Bout with no Outcomes at all is
    // not priced either: it is a card imported before there were any, and it
    // is re-imported rather than opened.
    priced: bout.outcomes.length > 0 && bout.outcomes.every((outcome) => outcome.priced),
    outcomes: inAskedOrder(bout.outcomes, bout.scheduledRounds),
  }));
}
