import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = ReturnType<typeof createDatabase>;

/**
 * A transaction open on a connection, as `database.transaction()` hands one
 * over.
 *
 * Named for what it is, because "transaction" alone means a Coin Transaction
 * in this domain (`CONTEXT.md`) and the two turn up in the same functions.
 * Anything that writes Coins takes one of these rather than reaching for a
 * connection of its own: on a serverless function there is only one to reach
 * for (ADR-0010), and a ledger row written outside the transaction that caused
 * it is a Balance that can be half-moved.
 */
export type DatabaseTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Wherever a statement can be run: the connection itself, or a transaction
 * already open on it.
 *
 * What it is for is ADR-0010. A module that writes one statement and can be
 * called both on its own and from inside somebody else's transaction takes one
 * of these rather than reaching for `useDatabase()` — reaching for it from
 * inside a transaction asks for the connection that transaction is holding,
 * and on a serverless function there is no second one to hand out.
 */
export type DatabaseConnection = Pick<Database, "execute">;

/**
 * How many connections one process may hold open.
 *
 * A serverless function handles one request at a time and is cloned to scale,
 * so it wants a single connection and gets its concurrency from the platform.
 * A dev or test process is one long-lived server handling everything, so a
 * pool of one would serialise every query through a single connection — which
 * would also hide the races that concurrency tests exist to catch, by making
 * the driver do the queueing that a row lock is supposed to do.
 *
 * `NODE_ENV` is the closest signal available, but it is not the real one: a
 * long-running container in production wants a pool, not a single connection,
 * and looks identical from here. `DATABASE_POOL_MAX` is the way to say so
 * without a code change, for as long as the hosting decision is open.
 */
function poolSize() {
  const configured = Number(process.env.DATABASE_POOL_MAX);

  if (process.env.DATABASE_POOL_MAX && !Number.isInteger(configured)) {
    throw new Error(
      `DATABASE_POOL_MAX must be a whole number, not "${process.env.DATABASE_POOL_MAX}".`,
    );
  }

  if (configured > 0) return configured;

  return process.env.NODE_ENV === "production" ? 1 : 10;
}

/**
 * Connects to Postgres over TCP with the `postgres` driver.
 *
 * Not Neon's HTTP driver: it cannot hold a transaction open across round
 * trips, and settlement has to read a row, decide in JavaScript, and write —
 * which over HTTP would silently stop being atomic.
 */
export function createDatabase(databaseUrl: string) {
  const client = postgres(databaseUrl, {
    max: poolSize(),
    idle_timeout: 20,
    connect_timeout: 10,
    // Transaction-mode poolers (Supabase's Supavisor, and PgBouncer depending
    // on version) reject session-level prepared statements. The host is not
    // chosen yet, so stay compatible with all of them.
    prepare: false,
  });

  return drizzle(client, { schema });
}
