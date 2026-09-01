/**
 * Seasons: the block of Events every Balance, Entry and leaderboard is scoped
 * to, and the only thing in this application that brings Coins into existence.
 *
 * Opening one is a single transaction — the Season row and every fan's
 * starting Coins together — because a Season that exists without them is a
 * competition where whoever reloads first plays and nobody else can.
 *
 * Closing one is the same shape at the other end: the Season row and the
 * record of what it finished as, together, because a Season marked closed
 * whose standings were never frozen has lost the only evidence a Prize could
 * be argued from and nothing can write it afterwards. The two together are a
 * rollover — close, then open — and what happens in between is nothing: no
 * Season is being played, every leaderboard says so in words, and the next
 * {@link openSeason} puts every fan back on the same hundred Coins.
 */
import { COIN_REASONS } from "#shared/coins";
import type { BoutStatus } from "#shared/events";
import { CLOSE_MESSAGES, type OutstandingBout } from "#shared/seasons";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { DatabaseTransaction } from "../db/client";
import { bouts, coinTransactions, events, seasons, type SeasonStatus } from "../db/schema";
import { grantStartingCoins } from "./coins";
import { useDatabase } from "./db";
import { freezeFinalStandings } from "./standings";

/**
 * A Season, as everything outside this module sees one.
 *
 * `openedBy` is deliberately not here. It is recorded so that "who opened
 * this?" can be answered, and answering it is a question somebody asks the
 * database, not a user id handed out with every listing.
 */
export interface Season {
  id: string;
  name: string;
  status: SeasonStatus;
  openedAt: Date;
  closedAt: Date | null;
}

const SEASON_COLUMNS = {
  id: seasons.id,
  name: seasons.name,
  status: seasons.status,
  openedAt: seasons.openedAt,
  closedAt: seasons.closedAt,
} as const;

/**
 * The Season being played, or `null` when none is open.
 *
 * A fact rather than an ordering accident: `seasons_one_open` allows at most
 * one open row, so "the current Season" cannot become ambiguous however many
 * Seasons have been and gone.
 */
export async function currentSeason(): Promise<Season | null> {
  const [open] = await useDatabase()
    .select(SEASON_COLUMNS)
    .from(seasons)
    .where(eq(seasons.status, "open"))
    .limit(1);

  return open ?? null;
}

/** A Season in the admin listing, with what it actually started. */
export interface ListedSeason extends Season {
  /** Counted from the ledger, not remembered from when the Season opened. */
  fansGranted: number;
}

/**
 * Every Season, newest first, with how many fans hold its starting Coins.
 *
 * The count comes from the grant rows rather than from a number written down
 * when the Season opened, so a Season claiming to have started forty fans
 * while holding thirty-nine grants shows up as the discrepancy it is.
 */
export function allSeasons(): Promise<ListedSeason[]> {
  return useDatabase()
    .select({
      ...SEASON_COLUMNS,
      fansGranted: sql<number>`count(${coinTransactions.id})`.mapWith(Number),
    })
    .from(seasons)
    .leftJoin(
      coinTransactions,
      and(eq(coinTransactions.seasonId, seasons.id), eq(coinTransactions.kind, "season_grant")),
    )
    .groupBy(seasons.id)
    .orderBy(desc(seasons.openedAt));
}

/** Whether some Season is called this already, ignoring case. */
export async function seasonNameTaken(name: string): Promise<boolean> {
  const [found] = await useDatabase()
    .select({ id: seasons.id })
    .from(seasons)
    .where(sql`lower(${seasons.name}) = lower(${name})`)
    .limit(1);

  return found !== undefined;
}

/**
 * Opens a Season and grants every fan their starting Coins, as one
 * transaction. Answers with the Season and how many fans it started.
 *
 * There is a window this deliberately leaves open. A fan signing up in the
 * milliseconds between the `select` below and this transaction committing is
 * granted by neither path: too late for the fan-out, and their own
 * `user.create.after` hook asked whether a Season was open before this one
 * was. Closing it means `lock table users in share mode` here, which would
 * hold every sign-up in the promotion behind one admin's transaction — a real
 * cost, paid always, against a race that needs a sign-up to land inside a
 * few milliseconds once every few months. The README says how to write the
 * missing row by hand, and the constraints make writing it twice impossible.
 *
 * The refusals an admin should be told apart — a Season open already, a name
 * some other Season has — are the caller's to ask about first, so that the
 * answer names which one it was. What is not the caller's is being right about
 * it: `seasons_one_open` and `seasons_name_unique` refuse both regardless,
 * which is what makes two admins pressing the button in the same second
 * harmless.
 */
export function openSeason({
  name,
  openedBy,
}: {
  name: string;
  openedBy: string;
}): Promise<{ season: Season; fansGranted: number }> {
  return useDatabase().transaction(async (tx) => {
    const [season] = await tx.insert(seasons).values({ name, openedBy }).returning(SEASON_COLUMNS);

    if (!season) throw new Error(`Opening the Season "${name}" wrote no row.`);

    const fansGranted = await grantStartingCoins(tx, season.id, COIN_REASONS.seasonOpened(name));

    return { season, fansGranted };
  });
}

/**
 * The two states a Bout can be in that stop a Season closing.
 *
 * **A Bout still `closed` is deliberately not one of them.** It took no
 * Predictions and holds nobody's Coins, so nothing about it can make a final
 * Balance wrong — and it can never settle either, because entering a result on
 * a Bout nobody opened is refused outright (`RESULT_MESSAGES.boutNotOpened`).
 * Blocking on one would leave a Season that had an unpriced card imported into
 * it open forever, with no route anywhere that could clear it. A card nobody
 * played is taken off by importing it again (ADR-0001).
 *
 * What these two are is "Coins could still move here": an `open` Bout is still
 * taking Entries, and a `locked` one has Entries riding on it with no Result to
 * grade them against. Closing over either would freeze standings that were
 * about to change.
 */
const OUTSTANDING = ["open", "locked"] as const satisfies readonly BoutStatus[];

/**
 * Every Bout on the Season's cards that is still waiting on a Result, in the
 * order they are fought.
 *
 * **Asked once, inside {@link closeSeason}'s transaction**, and it both decides
 * and writes the sentence the admin reads. Asking in the route first so the
 * refusal could name them, and again underneath so the decision was sound,
 * would be two reads of the same question that could disagree — an admin told
 * about a Bout that had settled in between, or a close refused with nothing
 * named.
 *
 * Ordered by the card's scheduled start and then the place on it, which is the
 * order an admin would work through them — the same order the Entry history
 * lists a Chained Entry's Bouts in, and for the same reason: a Season is more
 * than one card, and card order alone would interleave two of them.
 */
async function outstandingBouts(
  tx: DatabaseTransaction,
  seasonId: string,
): Promise<OutstandingBout[]> {
  return tx
    .select({
      event: events.title,
      cardOrder: bouts.cardOrder,
      red: bouts.redName,
      blue: bouts.blueName,
      // Narrowed to the two the `where` below admits. Drizzle types the column
      // as every `BoutStatus`, and it cannot see that this statement asks for
      // two of them.
      status: sql<OutstandingBout["status"]>`${bouts.status}`,
    })
    .from(bouts)
    .innerJoin(events, eq(events.id, bouts.eventId))
    .where(and(eq(events.seasonId, seasonId), inArray(bouts.status, [...OUTSTANDING])))
    .orderBy(asc(events.scheduledStart), asc(bouts.cardOrder));
}

/**
 * Why a Season was not closed, in the words the admin reads and the status the
 * route answers with.
 *
 * The same shape `ResultRefusal` has in `server/utils/results.ts`, and for the
 * same reason: closing is refused because the game moved under the admin, not
 * because they sent something malformed, so every one of these is a 409.
 */
export interface ClosingRefusal {
  problem: string;
  status: number;
}

/** A Season closed and what it froze, or the reason it was not. */
export type SeasonClosed =
  | { season: Season; fansRanked: number; refusal?: undefined }
  | { season?: undefined; fansRanked?: undefined; refusal: ClosingRefusal };

/**
 * Closes a Season and freezes what it finished as, as one transaction. Answers
 * with the Season and how many fans its final standings hold.
 *
 * **The freeze and the status are one write on purpose.** A Season marked
 * closed whose standings were never frozen has lost the record a Prize is
 * argued from, and nothing could write it afterwards: the next Season's grants
 * move every Balance, and `final_standings_are_frozen` means there is no second
 * attempt even if somebody noticed.
 *
 * The outstanding Bouts are asked about here, inside the transaction, and the
 * answer both refuses the close and writes the sentence naming them. At
 * Postgres's default isolation it sees every settlement committed by the moment
 * it runs, so a result entered while an admin was reaching for the button
 * refuses this rather than being closed over. What it leaves is a window of no
 * consequence: a Bout still `closed` at that moment could in principle be
 * opened and settled afterwards, and settling it moves nothing, because no fan
 * could have committed Coins to a Bout that was not open.
 *
 * `where status = 'open'` on the update is what makes two admins pressing the
 * button in the same second harmless: the second one moves no row and is told
 * the Season is not the one being played. `a_closed_season_is_never_reopened`
 * refuses the other direction regardless of what asks for it.
 */
export function closeSeason({
  seasonId,
  closedBy,
}: {
  seasonId: string;
  closedBy: string;
}): Promise<SeasonClosed> {
  return useDatabase().transaction(async (tx) => {
    const outstanding = await outstandingBouts(tx, seasonId);

    // Nothing has been written yet, so this commits an empty transaction
    // rather than needing to be rolled back out of one.
    if (outstanding.length > 0) {
      return { refusal: { status: 409, problem: CLOSE_MESSAGES.outstanding(outstanding) } };
    }

    const [season] = await tx
      .update(seasons)
      .set({ status: "closed", closedAt: new Date(), closedBy })
      .where(and(eq(seasons.id, seasonId), eq(seasons.status, "open")))
      .returning(SEASON_COLUMNS);

    if (!season) return { refusal: { status: 409, problem: CLOSE_MESSAGES.notOpen } };

    return { season, fansRanked: await freezeFinalStandings(tx, seasonId) };
  });
}

/** A Season that has ended, and the moment its standings became final. */
export interface EndedSeason {
  id: string;
  name: string;
  closedAt: Date;
}

/**
 * Every Season that has closed, newest first.
 *
 * What the leaderboard offers as links to the final standings behind it. Read
 * from the Seasons rather than from `final_standings`, because a Season that
 * closed with nobody holding Coins in it still ended and still has a page
 * saying so — one that says nobody was in it, which is a different answer from
 * a link that is not there.
 */
export async function endedSeasons(): Promise<EndedSeason[]> {
  const ended = await useDatabase()
    .select({ id: seasons.id, name: seasons.name, closedAt: seasons.closedAt })
    .from(seasons)
    .where(eq(seasons.status, "closed"))
    .orderBy(desc(seasons.closedAt));

  // `seasons_closed_is_dated` holds the status and the date to each other, so
  // this narrows a type rather than dropping anything: a closed Season without
  // a closing date is a row Postgres refuses.
  return ended.flatMap((season) =>
    season.closedAt ? [{ id: season.id, name: season.name, closedAt: season.closedAt }] : [],
  );
}

/**
 * One Season by id, whatever state it is in, or null for an id nothing is
 * called.
 *
 * The lookup behind both the close route and the final standings page, and the
 * reason neither of them casts an id straight into a wider query: an id out of
 * a URL is a string somebody typed, and `looksLikeId` in the route is what
 * keeps a malformed one from reaching Postgres as a `uuid` at all.
 */
export async function seasonById(id: string): Promise<Season | null> {
  const [season] = await useDatabase()
    .select(SEASON_COLUMNS)
    .from(seasons)
    .where(eq(seasons.id, id))
    .limit(1);

  return season ?? null;
}
