/**
 * The card the live lock console runs, read out of Postgres.
 *
 * Deliberately thin beside `cardToPrice` in `server/utils/pricing.ts`, which
 * reads the same card with every Outcome, every Multiplier, every Result and
 * every correction on it. That is the screen an admin sits down in front of
 * before a card; this is the one they hold in a dark arena while it is being
 * fought, and every column it does not need is a line to read past to find the
 * button (#20).
 *
 * It writes nothing. Locking is `lockBout`'s, and the backstops are
 * `applyAutomaticLocks`'s — the route runs that before reading, the way every
 * other admin route does, so what the console lists is where the card actually
 * is rather than where it was last time somebody pressed something.
 */
import type { ConsoleBout, LockConsole } from "#shared/console";
import { firstFought } from "#shared/locks";
import { asc, eq } from "drizzle-orm";
import { bouts } from "../db/schema";
import { useDatabase } from "./db";
import { cardBeingFought } from "./events";
import { lockMomentOf, locksOn, type AsAt } from "./locks";

/**
 * The card being fought and every Bout on it, or null when there is no card to
 * run.
 *
 * Which card that is is `cardBeingFought`'s to say, and it is the same Event the
 * public card shows: the next one until it starts, then the one being fought
 * until the backstop behind it has closed everything on it. Past that moment no
 * Bout on the card can be open, so there is nothing left for this screen to do
 * — and an admin reading a Lock back afterwards is reading it at
 * `/admin/events/[id]`, beside the fight, with a fan's complaint in hand.
 */
export async function lockConsole(at: AsAt): Promise<LockConsole | null> {
  const card = await cardBeingFought(at);

  if (!card) return null;

  const rows = await useDatabase()
    .select({
      id: bouts.id,
      cardOrder: bouts.cardOrder,
      status: bouts.status,
      redName: bouts.redName,
      blueName: bouts.blueName,
      mainEvent: bouts.mainEvent,
    })
    .from(bouts)
    .where(eq(bouts.eventId, card.id))
    .orderBy(asc(bouts.cardOrder));

  // Asked here in TypeScript rather than in SQL because the whole card is
  // already in hand; `firstOnTheCard` is the same question where it is not.
  const first = firstFought(rows);

  const locked = await locksOn(rows.map((bout) => bout.id));

  const listed: ConsoleBout[] = rows.map((bout) => {
    const byItself = lockMomentOf(
      { ...bout, firstOnTheCard: first, scheduledStart: card.scheduledStart },
      at.sweepAfter,
    );

    return {
      ...bout,
      lock: locked.get(bout.id) ?? null,
      locksAt: byItself.at,
      locksAs: byItself.kind,
    };
  });

  return {
    eventId: card.id,
    title: card.title,
    venue: card.venue,
    scheduledStart: card.scheduledStart.toISOString(),
    sweepAt: new Date(card.scheduledStart.getTime() + at.sweepAfter).toISOString(),
    answeredAt: at.now.toISOString(),
    bouts: listed,
  };
}
