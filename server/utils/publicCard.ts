/**
 * The card a fan reads, out of Postgres and into the two halves a page renders
 * it from: the fight card itself, and what TFC Predictions holds against it.
 *
 * Read from Postgres alone and never from Prismic, like everything else the
 * game runs on (ADR-0001). A corner's photo and record were copied at import
 * for exactly this: a card renders from one query, rather than from Postgres
 * and a CMS together while somebody is waiting for the page.
 *
 * The split is the point. `shared/fightCard.ts` is a lineup and nothing more,
 * so the same card can be shown anywhere a lineup is worth showing;
 * `shared/predictions.ts` is what the game adds to it. Only this module knows
 * they came from the same row.
 */
import type { FightCard, FightCardBout } from "#shared/fightCard";
import { locksAt, type BoutPredictions, type CardPredictions } from "#shared/predictions";
import { inAskedOrder } from "#shared/pricing";
import { asc, eq } from "drizzle-orm";
import { bouts, outcomes } from "../db/schema";
import { useDatabase } from "./db";
import { cardBeingFought } from "./events";
import { sweepWindow } from "./locks";

/** A fight card and everything the game holds against it. */
export interface UpcomingCard {
  card: FightCard;
  predictions: CardPredictions;
}

/** One Bout, in the two halves it is shown in. */
interface Shown {
  bout: FightCardBout;
  predictions: BoutPredictions;
}

/**
 * The card a fan is shown, or null when there is no card in the game.
 *
 * One Event rather than a listing: the game is played on the card in front of
 * a fan, and a page offering three of them would be asking which one they
 * meant before it had shown them anything.
 *
 * `now` is passed in rather than read here so that what a fan is told and the
 * moment they were told it are one decision, made once per request.
 */
export async function upcomingCard(now: Date = new Date()): Promise<UpcomingCard | null> {
  // Which card that is is `cardBeingFought`'s to say, and it says it for the
  // live lock console too: the next Event until it starts, and then the one
  // being fought until the backstop behind it has closed everything on it. A
  // card that stopped being shown while its Bouts were still taking
  // Predictions would be a card a fan could submit into and no longer see.
  const event = await cardBeingFought({ now, sweepAfter: sweepWindow() });

  if (!event) return null;

  // One query with a join rather than a query per Bout: a card is up to a
  // dozen Bouts of fourteen to eighteen Outcomes each, and this is asked on
  // every page load.
  const rows = await useDatabase()
    .select({
      id: bouts.id,
      cardOrder: bouts.cardOrder,
      status: bouts.status,
      redName: bouts.redName,
      redFighterUid: bouts.redFighterUid,
      redImageUrl: bouts.redImageUrl,
      redRecord: bouts.redRecord,
      blueName: bouts.blueName,
      blueFighterUid: bouts.blueFighterUid,
      blueImageUrl: bouts.blueImageUrl,
      blueRecord: bouts.blueRecord,
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
      },
    })
    .from(bouts)
    .leftJoin(outcomes, eq(outcomes.boutId, bouts.id))
    .where(eq(bouts.eventId, event.id))
    .orderBy(asc(bouts.cardOrder));

  const shown: Shown[] = [];
  const byPlace = new Map<number, Shown>();

  for (const row of rows) {
    let place = byPlace.get(row.cardOrder);

    if (!place) {
      place = {
        bout: {
          cardOrder: row.cardOrder,
          red: {
            name: row.redName,
            fighterUid: row.redFighterUid,
            imageUrl: row.redImageUrl,
            record: row.redRecord,
          },
          blue: {
            name: row.blueName,
            fighterUid: row.blueFighterUid,
            imageUrl: row.blueImageUrl,
            record: row.blueRecord,
          },
          division: row.division,
          scheduledRounds: row.scheduledRounds,
          mainEvent: row.mainEvent,
          titleFight: row.titleFight,
        },
        predictions: { boutId: row.id, status: row.status, locksAt: null, outcomes: [] },
      };

      byPlace.set(row.cardOrder, place);
      shown.push(place);
    }

    // Nothing is offered on a Bout nobody has opened. Every Outcome arrives
    // from import carrying a Multiplier seeded from a fixed table, and ADR-0002
    // is emphatic that a seeded number is not a price — so a fan sees what an
    // answer pays from the moment a Bout is open, which is the moment an admin
    // has priced every Outcome on it, and not a moment before.
    if (row.outcome && row.status !== "closed") place.predictions.outcomes.push(row.outcome);
  }

  const card: FightCard = {
    title: event.title,
    scheduledStart: event.scheduledStart.toISOString(),
    venue: event.venue,
    bouts: shown.map((place) => place.bout),
  };

  // Which Bout a fan is counted down to is a fact about the card rather than
  // about any one Bout, so it can only be settled once the whole card is in
  // hand.
  for (const { bout, predictions } of shown) {
    predictions.locksAt = locksAt(bout, card);
    predictions.outcomes = inAskedOrder(predictions.outcomes, bout.scheduledRounds);
  }

  return {
    card,
    predictions: {
      answeredAt: now.toISOString(),
      bouts: Object.fromEntries(shown.map((place) => [place.bout.cardOrder, place.predictions])),
    },
  };
}
