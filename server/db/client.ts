import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

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
    // `prepare` is deliberately not set, which leaves it at the driver's own
    // default of `true`. It was `false` here, because a transaction-mode
    // pooler — Supabase's Supavisor, and PgBouncer depending on version —
    // rejects session-level prepared statements, and the host was undecided.
    // See {@link prepareEveryStatement} for what the decision was and what it
    // took to make the setting mean anything.
  });

  prepareEveryStatement(client);

  // `{ client }` rather than a positional argument, and no `schema`: Drizzle
  // 1.0 takes an already-built driver only through the config object, and
  // dropped `schema` in favour of a `relations` that feeds the relational
  // query builder (`database.query.…`). Nothing here uses that builder —
  // every query in this codebase is written with `select`/`insert`/`update` —
  // so there is nothing to hand over.
  return drizzle({ client });
}

/**
 * Makes this connection keep the shape of every statement it runs, so that a
 * statement costs one round trip to Postgres rather than two.
 *
 * **Why this is a line of code and not a setting.** A statement the driver has
 * not kept the shape of has to be Parsed before it can be Bound, and those are
 * two writes with a wait between them:
 *
 * ```
 * Parse+Describe+Flush   → wait
 * Bind+Execute+Sync      → wait
 * ```
 *
 * A statement carrying no parameters is the exception and always cost one:
 * `postgres` sends those as a simple query, which has nothing to Parse ahead
 * of. `/api/health` is the whole of that category here.
 *
 * Leaving `prepare` at its default above is not enough on its own, which is
 * the part worth writing down. Drizzle passes `prepare: false` of its own on
 * every query that was not given a name with `.prepare("…")`, and `postgres`
 * requires both — `q.prepare = options.prepare && q.options.prepare` — so the
 * connection's setting decides nothing by itself and a page goes on paying
 * twice. That is measurable and was measured: with the setting alone, a
 * `/predictions` render still made two round trips for each of its seven
 * statements (`test/server/round-trips.test.ts`).
 *
 * So the driver's own `unsafe` — which is what Drizzle runs every statement
 * through — is asked to prepare regardless. `postgres` then keeps each
 * statement against the connection and Binds straight to it next time.
 *
 * **What makes this safe is the connection, and it is the connection that
 * could stop being safe.** Production connects to Postgres directly, on 5432:
 * one session for as long as the process holds it, which is what a
 * session-level prepared statement needs. A transaction-mode pooler hands a
 * request whichever backend is free, and a statement prepared against one is
 * not there on the next — so moving to a pooled connection string means
 * putting `prepare: false` back above, in the same commit as the change to the
 * environment secret. That is enough on its own, and was checked rather than
 * assumed: the connection's `false` is the half of the `&&` this cannot reach,
 * so setting it turns this straight off again.
 *
 * Statements inside a transaction are left alone, because `postgres` builds
 * the transaction its own handle and this one is not it. Those are the writes
 * — an Entry submitted, a Bout settled — rather than the reads a page is made
 * of, and ADR-0022's arithmetic is about what a render costs.
 *
 * Written for the three-argument call, which is the only one `postgres` types
 * and the only one Drizzle makes. Its other shape — `unsafe(string, options)`
 * — is told apart by counting arguments, and would arrive here as parameters.
 *
 * See ADR-0023.
 */
function prepareEveryStatement(client: postgres.Sql): void {
  const ask = client.unsafe;

  client.unsafe = (string, parameters, options) =>
    ask(string, parameters, { ...options, prepare: true });
}
