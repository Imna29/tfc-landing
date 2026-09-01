/**
 * Where a fan sits in a Season's standings.
 *
 * One question, asked of the materialised Balance and of nothing else: order
 * every fan in the Season by what they hold, and say where this one is. That
 * is the whole of a Rank (`CONTEXT.md`), and it is deliberately not worked out
 * from the ledger — a page that added up every Coin Transaction of every fan
 * to answer "12th of 340" is the aggregate ADR-0003 put `balance_cache` there
 * to avoid.
 *
 * Here rather than beside `balanceOf` in `server/utils/coins.ts` because that
 * module is the ledger's write path and this only reads: nothing in this file
 * moves a Coin, and nothing in it may.
 */
import { sql } from "drizzle-orm";
import { balanceCache } from "../db/schema";
import { useDatabase } from "./db";

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
 * Where this fan stands among everybody playing the Season.
 *
 * **Ties are broken by who reached the total first**, which is what makes a
 * Rank predictable rather than arbitrary: two fans on the same Coins would
 * otherwise swap places between one page load and the next, on nothing but
 * whichever row Postgres happened to return first. The moment a fan reached
 * their total is the moment their materialised Balance last moved, so the
 * ordering is Balance, then that, then the fan's own id — the last as a
 * tie-break of last resort, because two fans granted their starting Coins by
 * the same statement genuinely did reach a hundred at the same instant, and an
 * ordering has to answer even then.
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
        row_number() over (order by balance desc, updated_at asc, user_id asc) as rank
      from ${balanceCache}
      where season_id = ${seasonId}::uuid
    ) standings
  `);

  // An aggregate over no rows still answers one, so this is unreachable short
  // of the statement itself failing — and a Rank of nobody is the honest
  // answer to a Season nobody holds Coins in.
  return standing ?? { fans: 0, rank: null, balance: null };
}
