/**
 * Events and Bouts in Postgres: writing a card that has been read out of
 * Prismic, and reading back what has been imported.
 *
 * This is the second half of ADR-0001. The first half — `readCard` in
 * `server/utils/cardImport.ts` — decides what a card *says*; this decides what
 * the game *runs on*. After it, Prismic has no further say: a Prediction
 * points at a Bout row by id, settlement reads these tables, and editing the
 * document afterwards changes the marketing site and nothing else.
 *
 * A card is written whole or not at all. Half a card is worse than none: it
 * looks imported, and the Bouts that did not land are fights fans cannot
 * predict on with no sign that anything is missing.
 */
import { asc, desc, eq, gte, sql } from "drizzle-orm";
import { bouts, events, outcomes, seasons } from "../db/schema";
import type { Card } from "./cardImport";
import { useDatabase } from "./db";
import type { AsAt } from "./locks";
import { seedOutcomes } from "./pricing";

/** The name of the trigger that refuses to replace a Bout fans are on. */
export const BOUTS_ARE_REPLACED_ONLY_WHILE_CLOSED = "bouts_are_replaced_only_while_closed";

/** An imported Event, as the admin area lists one. */
export interface ImportedEvent {
  id: string;
  /** The Prismic document it was imported from, which re-import asks for. */
  prismicId: string;
  title: string;
  scheduledStart: Date;
  venue: string;
  /** The Season whose Coins are committed on it. */
  seasonName: string;
  importedAt: Date;
  bouts: number;
  /** How many Bouts still have an Outcome nobody has priced (#9). */
  unpriced: number;
  /** How many are open for predictions right now (#9). */
  open: number;
  /** How many have locked, and take no more Predictions (#12). */
  locked: number;
  /**
   * How many have been opened at some point, which is what refuses a
   * re-import.
   *
   * One is enough, whether it is still open or has since locked: fans hold
   * Coins against that row either way, and replacing it would leave their
   * Predictions pointing at a fight that no longer exists (ADR-0001).
   */
  opened: number;
}

/**
 * Every imported Event, the card scheduled furthest ahead first, matching the
 * order the Prismic side is listed in.
 *
 * The Bouts are counted and their state summarised here rather than fetched
 * with each Event, because what the listing answers is "is this card in, what
 * is left to do to it, how far through it is, and can I still change it?" —
 * a handful of numbers, not a card each. The card itself is `cardToPrice` in `server/utils/pricing.ts`.
 */
export function importedEvents(): Promise<ImportedEvent[]> {
  return useDatabase()
    .select({
      id: events.id,
      prismicId: events.prismicId,
      title: events.title,
      scheduledStart: events.scheduledStart,
      venue: events.venue,
      seasonName: seasons.name,
      importedAt: events.importedAt,
      bouts: sql<number>`count(distinct ${bouts.id})`.mapWith(Number),
      // A Bout with no Outcomes at all counts as unpriced, which is what it
      // is: the join finds nothing for it, and it cannot be opened either.
      unpriced:
        sql<number>`count(distinct ${bouts.id}) filter (where ${outcomes.pricedAt} is null)`.mapWith(
          Number,
        ),
      open: sql<number>`count(distinct ${bouts.id}) filter (where ${bouts.status} = 'open')`.mapWith(
        Number,
      ),
      locked:
        sql<number>`count(distinct ${bouts.id}) filter (where ${bouts.status} = 'locked')`.mapWith(
          Number,
        ),
      opened:
        sql<number>`count(distinct ${bouts.id}) filter (where ${bouts.status} <> 'closed')`.mapWith(
          Number,
        ),
    })
    .from(events)
    .innerJoin(seasons, eq(seasons.id, events.seasonId))
    .leftJoin(bouts, eq(bouts.eventId, events.id))
    .leftJoin(outcomes, eq(outcomes.boutId, bouts.id))
    .groupBy(events.id, seasons.name)
    .orderBy(desc(events.scheduledStart));
}

/** An Event without its Bouts: the card itself, as the game reads one. */
export interface CardBeingFought {
  id: string;
  title: string;
  scheduledStart: Date;
  venue: string;
}

/**
 * The card the game is on: the next Event until it starts, and then the one
 * being fought until nothing on it can be open any more.
 *
 * One rule with two readers, and they must never disagree. The public card
 * shows this Event and the live lock console (#20) runs it, so a card that
 * stopped being one before it stopped being the other would be a card a fan
 * could submit into and an admin could no longer lock, or the reverse.
 *
 * What ends it is the last backstop rather than the scheduled start, because a
 * card is at its most interesting after it has begun: Bouts lock one after
 * another while it is fought (ADR-0006), and only past `sweepAfter` can no Bout
 * on it be open at all. From that moment there is nothing on it left to predict
 * and nothing left to lock.
 *
 * Takes the moment and the window together, as `AsAt` in
 * `server/utils/locks.ts` requires of everything that works out where a Bout
 * is: one moment for a whole request, and a window that is configuration read
 * at the edge rather than in here.
 */
export async function cardBeingFought({ now, sweepAfter }: AsAt): Promise<CardBeingFought | null> {
  const [event] = await useDatabase()
    .select({
      id: events.id,
      title: events.title,
      scheduledStart: events.scheduledStart,
      venue: events.venue,
    })
    .from(events)
    .where(gte(events.scheduledStart, new Date(now.getTime() - sweepAfter)))
    .orderBy(asc(events.scheduledStart))
    .limit(1);

  return event ?? null;
}

/** What Postgres already holds for one Prismic card. */
export interface ImportedCard {
  id: string;
  /** How many of its Bouts are no longer closed. */
  openedBouts: number;
}

/**
 * What has already been imported from a Prismic document, or `null` for a card
 * nobody has imported yet.
 *
 * Asked by the route before it starts a transaction, so that an admin is told
 * *why* a re-import is refused rather than being handed the database's opinion
 * of it. Being right about it is not this question's job:
 * {@link BOUTS_ARE_REPLACED_ONLY_WHILE_CLOSED} refuses the write regardless,
 * which is what makes two admins pressing Import in the same second harmless.
 */
export async function importedCard(prismicId: string): Promise<ImportedCard | null> {
  const [imported] = await useDatabase()
    .select({
      id: events.id,
      openedBouts:
        sql<number>`count(${bouts.id}) filter (where ${bouts.status} <> 'closed')`.mapWith(Number),
    })
    .from(events)
    .leftJoin(bouts, eq(bouts.eventId, events.id))
    .where(eq(events.prismicId, prismicId))
    .groupBy(events.id)
    .limit(1);

  return imported ?? null;
}

/** An Event as it stands after being imported. */
export interface Imported {
  id: string;
  title: string;
  bouts: number;
  /** Whether this replaced a card that had been imported before. */
  replaced: boolean;
}

/**
 * Writes a card into Postgres: the Event, then its Bouts, as one transaction.
 *
 * Re-importing replaces the Bouts rather than reconciling them. A lineup
 * change is the reason to re-import, and a replacement fighter, a Bout added
 * and a Bout dropped are all the same edit from here — matching rows up
 * would be guessing at which Bout an editor meant to keep. The cost is that
 * anything hung off a Bout goes with it, the Multipliers #9 seeds among them,
 * so a re-import is a card to be priced again.
 *
 * What makes that safe is that it is only ever allowed while every Bout is
 * still closed. Postgres holds that, not this function — see the trigger in
 * `0004_event_import.sql`.
 *
 * The Season is set on every import, not only the first. A card whose Bouts
 * are all closed has no Coins riding on it, so a card imported during a Season
 * that has since ended belongs to the one being played now.
 */
export function importCard(
  card: Card,
  { seasonId, importedBy }: { seasonId: string; importedBy: string },
): Promise<Imported> {
  return useDatabase().transaction(async (tx) => {
    const [event] = await tx
      .insert(events)
      .values({
        seasonId,
        prismicId: card.prismicId,
        title: card.title,
        scheduledStart: card.scheduledStart,
        venue: card.venue,
        posterUrl: card.posterUrl,
        importedBy,
      })
      .onConflictDoUpdate({
        target: events.prismicId,
        set: {
          seasonId,
          title: card.title,
          scheduledStart: card.scheduledStart,
          venue: card.venue,
          posterUrl: card.posterUrl,
          importedBy,
          importedAt: sql`now()`,
        },
      })
      .returning({ id: events.id });

    if (!event) throw new Error(`Importing "${card.title}" wrote no Event.`);

    const replaced = await tx.delete(bouts).where(eq(bouts.eventId, event.id)).returning({
      id: bouts.id,
    });

    const written = await tx
      .insert(bouts)
      .values(
        card.bouts.map((bout) => ({
          eventId: event.id,
          cardOrder: bout.cardOrder,
          redName: bout.red.name,
          redFighterId: bout.red.fighterId,
          redFighterUid: bout.red.fighterUid,
          redImageUrl: bout.red.imageUrl,
          redRecord: bout.red.record,
          blueName: bout.blue.name,
          blueFighterId: bout.blue.fighterId,
          blueFighterUid: bout.blue.fighterUid,
          blueImageUrl: bout.blue.imageUrl,
          blueRecord: bout.blue.record,
          division: bout.division,
          scheduledRounds: bout.scheduledRounds,
          mainEvent: bout.mainEvent,
          titleFight: bout.titleFight,
        })),
      )
      .returning({ id: bouts.id, scheduledRounds: bouts.scheduledRounds });

    // Seeded here rather than by the admin who prices the card, so that a Bout
    // exists with its Questions already asked and eight numbers to correct.
    // A re-imported Bout is a new row, so this is also what makes a lineup
    // change a card to be priced again (ADR-0002).
    await seedOutcomes(tx, written);

    return {
      id: event.id,
      title: card.title,
      bouts: card.bouts.length,
      replaced: replaced.length > 0,
    };
  });
}
