/**
 * Where a fan sits in a Season's standings, and who is at the top of them.
 *
 * One question, asked of the materialised Balance and of nothing else: order
 * every fan in the Season by what they hold, and say where somebody is. That
 * is the whole of a Rank (`CONTEXT.md`), and it is deliberately not worked out
 * from the ledger — a page that added up every Coin Transaction of every fan
 * to answer "12th of 340" is the aggregate ADR-0003 put `balance_cache` there
 * to avoid.
 *
 * Two pages ask it, at two shapes. The profile asks for one fan's own place
 * however far down the Season they are ({@link standingIn}); the leaderboard
 * asks for the top of it and for that same fan's row underneath
 * ({@link leaderboardOf}). They are two statements because they are two
 * questions, and what they must never disagree about — the order — is
 * {@link BY_STANDING}, written once and embedded in both.
 *
 * Here rather than beside `balanceOf` in `server/utils/coins.ts` because that
 * module is the ledger's write path and this only reads: nothing in this file
 * moves a Coin, and nothing in it may.
 */
import { LEADERBOARD_PLACES, type Leaderboard, type LeaderboardPlace } from "#shared/standings";
import { sql } from "drizzle-orm";
import { balanceCache, entries, users } from "../db/schema";
import { useDatabase } from "./db";

/**
 * The one ordering a Rank is ever decided by: the Coins a fan holds, then the
 * moment they reached that total, then their own id.
 *
 * **Ties are broken by who reached the total first**, which is what makes a
 * Rank predictable rather than arbitrary: two fans on the same Coins would
 * otherwise swap places between one page load and the next, on nothing but
 * whichever row Postgres happened to return first. The moment a fan reached
 * their total is the moment their materialised Balance last moved.
 *
 * The id is the tie-break of last resort, because two fans granted their
 * starting Coins by the same statement genuinely did reach a hundred at the
 * same instant, and an ordering has to answer even then.
 *
 * One fragment rather than two copies of a `row_number()` window, because the
 * profile says "12th of 340" and the leaderboard is the page that has to show
 * the same fan in the same place. Two orderings that agreed today would be two
 * to keep agreeing.
 *
 * `balance_cache_by_standing` is this order, per Season, so that reading the
 * top of a Season is an index scan rather than a sort of everybody in it.
 *
 * **`nulls last` is not decoration.** Postgres orders a `desc` column nulls
 * first by default and a btree index declares them last, and the planner
 * matches an ordering to an index including that flag — so `order by balance
 * desc` alone matches nothing and sorts the whole Season, on a column that is
 * `not null` and can never have produced a different answer either way.
 * Measured on 200,000 rows: a sequential scan and a sort of all of them,
 * against an index-only scan with `nulls last` written in.
 */
const BY_STANDING = sql`order by balance desc nulls last, updated_at asc, user_id asc`;

/**
 * Where one fan stands in a Season, and how many they stand among.
 *
 * A type alias rather than an interface so that it satisfies the row shape
 * `execute` is generic over: TypeScript gives an alias of an object literal an
 * implicit index signature and an interface none.
 */
export type SeasonStanding = {
  /** How many fans hold a Balance in the Season, which is what a Rank is of. */
  fans: number;
  /** This fan's place, 1 being the top, or null where they hold no row. */
  rank: number | null;
  /** The Coins they hold, or null for that same fan. */
  balance: number | null;
};

/**
 * Where this fan stands among everybody playing the Season, in
 * {@link BY_STANDING}'s order.
 *
 * One statement, and one that always answers a row. The count is of the whole
 * Season and the Rank is of one fan in it, and asking them separately would be
 * two round trips whose answers could be taken a moment apart — a fan told
 * they are 12th of 11.
 */
export async function standingIn(seasonId: string, userId: string): Promise<SeasonStanding> {
  const [standing] = await useDatabase().execute<SeasonStanding>(sql`
    select
      count(*)::int as fans,
      max(case when user_id = ${userId}::uuid then rank end)::int as rank,
      max(case when user_id = ${userId}::uuid then balance end)::int as balance
    from (
      select
        user_id,
        balance,
        row_number() over (${BY_STANDING}) as rank
      from ${balanceCache}
      where season_id = ${seasonId}::uuid
    ) standings
  `);

  // An aggregate over no rows still answers one, so this is unreachable short
  // of the statement itself failing — and a Rank of nobody is the honest
  // answer to a Season nobody holds Coins in.
  return standing ?? { fans: 0, rank: null, balance: null };
}

/** One row of {@link leaderboardOf}'s answer, as Postgres spells it. */
type PlaceRow = {
  rank: number;
  fans: number;
  balance: number;
  username: string;
  entries_played: number;
  /** Null rather than false for a visitor with no account to compare against. */
  you: boolean | null;
};

/**
 * The top of a Season, and the fan reading it wherever they are in it.
 *
 * **One statement for both**, and for the same reason {@link standingIn} is
 * one: the pinned row's Rank and the ten above it have to be the same reading
 * of the same standings, and two round trips could be taken a moment apart —
 * an eleventh place shown under a top ten it is already in.
 *
 * A fan already in the top ten is marked there and pinned nowhere, which the
 * `where` does by asking for their row and the ten in one condition rather
 * than by fetching them twice and hoping to notice. `Leaderboard` in
 * `shared/standings.ts` is the shape that makes it impossible to show both.
 *
 * `fanId` is null for a signed-out visitor, and `user_id = null` is null
 * rather than false in every row it is asked of — so a visitor is answered the
 * top ten and no row of their own, which is exactly the page they should get.
 *
 * **Entries played is counted per row shown, not per fan in the Season.** It
 * is at most eleven index lookups on `entries_by_fan`, where counting every
 * fan's Entries and then throwing away all but eleven of the answers would
 * grow with the Season. A cancelled Entry is not one a fan played
 * (`CONTEXT.md`), and its Coins are already back in the Balance beside it.
 *
 * The count of fans is a subquery of its own rather than `count(*) over ()`
 * beside the `row_number()`, which is the obvious way to write it and the
 * expensive one: a window that counts every row has to hold every row, so
 * Postgres spools the whole Season to disk to answer "of 340" — where the
 * subquery is one aggregate over the same index. Still one statement, so it is
 * still one reading of the standings.
 */
export async function leaderboardOf(
  seasonId: string,
  fanId: string | null,
): Promise<Omit<Leaderboard, "season">> {
  const rows = await useDatabase().execute<PlaceRow>(sql`
    with standings as (
      select
        user_id,
        balance,
        row_number() over (${BY_STANDING}) as rank
      from ${balanceCache}
      where season_id = ${seasonId}::uuid
    )
    select
      standings.rank::int as rank,
      (
        select count(*)
        from ${balanceCache}
        where season_id = ${seasonId}::uuid
      )::int as fans,
      standings.balance::int as balance,
      ${users.username} as username,
      (
        select count(*)
        from ${entries}
        where ${entries.seasonId} = ${seasonId}::uuid
          and ${entries.userId} = standings.user_id
          and ${entries.status} <> 'cancelled'
      )::int as entries_played,
      standings.user_id = ${fanId}::uuid as you
    from standings
    join ${users} on ${users.id} = standings.user_id
    where standings.rank <= ${LEADERBOARD_PLACES} or standings.user_id = ${fanId}::uuid
    order by standings.rank
  `);

  // The `where` above has already decided which rows are the top ten, and the
  // `order by` has put them first — so this splits the answer rather than
  // asking the same question of it again. Whatever is past them is the one row
  // the `or` let through, which is the fan's own and nobody else's.
  const places = rows.map(placeFrom);
  const beyond = places.slice(LEADERBOARD_PLACES);

  return {
    top: places.slice(0, LEADERBOARD_PLACES),
    // Empty for a fan the ten already hold, which is what marks them in it
    // rather than showing them twice.
    you: beyond[0] ?? null,
    fans: rows[0]?.fans ?? 0,
  };
}

/** One row of the answer, in the words `shared/standings.ts` reads it in. */
function placeFrom(row: PlaceRow): LeaderboardPlace {
  return {
    rank: row.rank,
    username: row.username,
    balance: row.balance,
    entriesPlayed: row.entries_played,
    // Null is a visitor with no account, and is nobody's row.
    you: row.you === true,
  };
}
