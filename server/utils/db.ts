import { createDatabase, type Database } from "../db/client";

let database: Database | undefined;

/**
 * The application's connection to Postgres, created once per process and
 * reused — a warm serverless instance keeps its connection between requests
 * rather than opening one each time.
 */
export function useDatabase(): Database {
  if (!database) {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error("DATABASE_URL is not set. Copy .env.example to .env for local development.");
    }

    database = createDatabase(databaseUrl);
  }

  return database;
}

/**
 * Whether Postgres refused a write because of a named constraint or index.
 *
 * Every rule worth having is held by the database as well as asked about in a
 * route, so that two requests in the same moment cannot both be told they are
 * fine. This is how the route recognises its own question coming back as a
 * refusal, and answers with the sentence it would have said the first time.
 *
 * The name is looked for on the error and in its message, and down the chain
 * of causes: the `postgres` driver puts it in `constraint_name`, and Drizzle
 * wraps that in an error of its own whose message carries the failed SQL.
 */
export function refusedByConstraint(error: unknown, constraint: string): boolean {
  for (let cause: unknown = error; cause instanceof Error; cause = cause.cause) {
    if ((cause as { constraint_name?: string }).constraint_name === constraint) return true;
    if (cause.message.includes(constraint)) return true;
  }

  return false;
}

/**
 * Whether this is a shape Postgres will accept as a `uuid`.
 *
 * Every id in this schema is one, and they reach the server as text in a URL.
 * Asking first turns "not a row anybody has" into the 404 it is, rather than
 * the 500 an invalid cast raises halfway down a query.
 */
export function looksLikeId(value: string | undefined): value is string {
  return (
    value !== undefined &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}
