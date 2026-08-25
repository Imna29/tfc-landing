/**
 * Seasons: the block of Events every Balance, Entry and leaderboard is scoped
 * to, and the only thing in this application that brings Coins into existence.
 *
 * Opening one is a single transaction — the Season row and every fan's
 * starting Coins together — because a Season that exists without them is a
 * competition where whoever reloads first plays and nobody else can.
 */
import { COIN_REASONS } from "#shared/coins";
import { and, desc, eq, sql } from "drizzle-orm";
import { coinTransactions, seasons, type SeasonStatus } from "../db/schema";
import { grantStartingCoins } from "./coins";
import { useDatabase } from "./db";

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
