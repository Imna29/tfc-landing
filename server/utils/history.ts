/**
 * Reading a fan's own Entries back: everything they have ever committed, and
 * how each Bout in it ended.
 *
 * The other end of `server/utils/cancellation.ts`. That module lists the
 * Entries a fan can still do something about, beside the card they were
 * committed on; this goes back through every Season and adds the one thing
 * that turns an Entry into history — how each of its Bouts actually went, so
 * that every Prediction in a chain can be graded where a fan reads it.
 *
 * Nothing here decides what any of it *means*. Whether a Prediction landed,
 * what a chain came to and what it returned are `shared/history.ts` and the
 * modules it reaches through, asked of these rows by the page. What this adds
 * is only what the database knows: which Entries are this fan's, which Season
 * each was committed in, and the Result on every Bout they answered.
 *
 * It reads like `committedEntries` in `server/utils/cancellation.ts` and is
 * deliberately not shared with it. The two answer different questions about
 * the same rows — that one needs where every Bout stands and its own Lock
 * moment, because it is the listing that offers to cancel; this one needs the
 * Season and the Event, because it goes back through both. Merging them would
 * make every change to either negotiate with the other, and the shape they
 * have in common is a `select` and a grouping loop rather than a rule anybody
 * could get wrong twice. The rules they *do* share are shared: `endingFrom`
 * below, and everything in `shared/`.
 *
 * The automatic Locks are deliberately not applied here, unlike everywhere
 * else that reads where a Bout is (`CONTEXT.md`, the sweep). Nothing on this
 * page turns on a Lock: an Entry cannot be cancelled from it, and a Prediction
 * is graded against the Result its Bout produced rather than against the
 * moment it stopped taking answers. A profile that wrote Lock rows would be
 * paying for a fact it does not show.
 */
import type { HistoricEntry, HistoryFilter, PlayedSeason } from "#shared/history";
import { and, desc, eq } from "drizzle-orm";
import { boutResults, bouts, entries, events, predictions, seasons } from "../db/schema";
import { useDatabase } from "./db";
import { endingFrom } from "./results";

/**
 * Every Season this fan has committed an Entry in, newest first.
 *
 * What the Season filter is offered from, and — because it is also what
 * `historyFilter` in `shared/history.ts` decides the default against — what
 * stops a Season id arriving in a URL from ever reaching {@link entryHistory}
 * as a cast. A Season the fan has never played is not in this list, so it is
 * not a Season the filter can be set to.
 *
 * Asked of the Entries rather than of the Seasons table: a fan who joined
 * three Seasons ago and played one of them has one Season of history, and a
 * filter offering the other two would be offering two empty pages.
 */
export function seasonsPlayed(fanId: string): Promise<PlayedSeason[]> {
  return useDatabase()
    .select({ id: seasons.id, name: seasons.name })
    .from(seasons)
    .innerJoin(entries, eq(entries.seasonId, seasons.id))
    .where(eq(entries.userId, fanId))
    .groupBy(seasons.id)
    .orderBy(desc(seasons.openedAt));
}

/**
 * The Entries this fan has committed, newest first, with how each of their
 * Bouts ended.
 *
 * One statement for the whole page, whatever it holds: an Entry is at most ten
 * Predictions, and reading the Results a Bout at a time would be a round trip
 * per fight of every card a fan has ever played.
 *
 * Ordered newest Entry first and, inside each one, by the order its Bouts are
 * actually fought: the card's scheduled start and then the place on it.
 * `committedEntries` orders by the place alone because every Entry it lists is
 * beside the card it was made on, and this cannot — a Chained Entry may answer
 * Bouts on two Events of one Season, and card order alone would interleave the
 * two cards as Bout 1, Bout 1, Bout 2.
 *
 * **The whole history, unless the fan narrowed it.** `entries_by_fan_over_time`
 * is what makes that affordable: history is kept forever, so the Entries of a
 * fan four Seasons in are four Seasons of rows, and the index is on the two
 * columns this orders and filters by rather than on the Season the old
 * `entries_by_fan` leads with.
 */
export async function entryHistory(fanId: string, filter: HistoryFilter): Promise<HistoricEntry[]> {
  const rows = await useDatabase()
    .select({
      id: entries.id,
      status: entries.status,
      amount: entries.amount,
      submittedAt: entries.submittedAt,
      seasonId: seasons.id,
      seasonName: seasons.name,
      boutId: predictions.boutId,
      question: predictions.question,
      corner: predictions.corner,
      method: predictions.method,
      round: predictions.round,
      multiplier: predictions.multiplier,
      cardOrder: bouts.cardOrder,
      redName: bouts.redName,
      blueName: bouts.blueName,
      eventTitle: events.title,
      // How the Bout ended, which is the whole of what this listing adds.
      // `CONTEXT.md` on Settlement: whether a Prediction landed is worked out
      // from the Bout's Result whenever it is shown, and never written onto
      // the Prediction.
      resultWinner: boutResults.winner,
      resultMethod: boutResults.method,
      resultRound: boutResults.round,
      resultNoResult: boutResults.noResult,
    })
    .from(entries)
    .innerJoin(seasons, eq(seasons.id, entries.seasonId))
    .innerJoin(predictions, eq(predictions.entryId, entries.id))
    .innerJoin(bouts, eq(bouts.id, predictions.boutId))
    .innerJoin(events, eq(events.id, bouts.eventId))
    .leftJoin(boutResults, eq(boutResults.boutId, predictions.boutId))
    .where(
      and(
        // The only scope there is. There is no fan parameter on the route
        // above this, so one fan's history cannot be asked for as another's.
        eq(entries.userId, fanId),
        // Already known to be a Season this fan played — `historyFilter`
        // answers with one of `seasonsPlayed`'s ids or with null — which is
        // what keeps an id out of a URL from reaching Postgres as a cast.
        filter.seasonId ? eq(entries.seasonId, filter.seasonId) : undefined,
        filter.status ? eq(entries.status, filter.status) : undefined,
      ),
    )
    .orderBy(desc(entries.submittedAt), events.scheduledStart, bouts.cardOrder);

  const history = new Map<string, HistoricEntry>();

  for (const row of rows) {
    const entry = history.get(row.id) ?? {
      id: row.id,
      status: row.status,
      amount: row.amount,
      submittedAt: row.submittedAt.toISOString(),
      season: { id: row.seasonId, name: row.seasonName },
      predictions: [],
    };

    history.set(row.id, entry);

    entry.predictions.push({
      boutId: row.boutId,
      question: row.question,
      corner: row.corner,
      method: row.method,
      round: row.round,
      multiplier: row.multiplier,
      cardOrder: row.cardOrder,
      corners: { red: row.redName, blue: row.blueName },
      eventTitle: row.eventTitle,
      ending: endingFrom(row),
    });
  }

  return [...history.values()];
}
