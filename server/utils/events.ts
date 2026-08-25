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
import { desc, eq, sql } from "drizzle-orm";
import { bouts, events, seasons } from "../db/schema";
import type { Card } from "./cardImport";
import { useDatabase } from "./db";

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
  /** Whether any Bout is no longer closed, which is what refuses a re-import. */
  opened: boolean;
}

/**
 * Every imported Event, the card scheduled furthest ahead first, matching the
 * order the Prismic side is listed in.
 *
 * The Bouts are counted and their state summarised here rather than fetched
 * with each Event, because what the listing answers is "is this card in, and
 * can I still change it?" — two numbers, not a card each.
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
      bouts: sql<number>`count(${bouts.id})`.mapWith(Number),
      opened: sql<boolean>`coalesce(bool_or(${bouts.status} <> 'closed'), false)`.mapWith(Boolean),
    })
    .from(events)
    .innerJoin(seasons, eq(seasons.id, events.seasonId))
    .leftJoin(bouts, eq(bouts.eventId, events.id))
    .groupBy(events.id, seasons.name)
    .orderBy(desc(events.scheduledStart));
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

    await tx.insert(bouts).values(
      card.bouts.map((bout) => ({
        eventId: event.id,
        cardOrder: bout.cardOrder,
        redName: bout.red.name,
        redFighterId: bout.red.fighterId,
        redFighterUid: bout.red.fighterUid,
        redImageUrl: bout.red.imageUrl,
        blueName: bout.blue.name,
        blueFighterId: bout.blue.fighterId,
        blueFighterUid: bout.blue.fighterUid,
        blueImageUrl: bout.blue.imageUrl,
        division: bout.division,
        scheduledRounds: bout.scheduledRounds,
        mainEvent: bout.mainEvent,
        titleFight: bout.titleFight,
      })),
    );

    return {
      id: event.id,
      title: card.title,
      bouts: card.bouts.length,
      replaced: replaced.length > 0,
    };
  });
}
