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
