import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDatabase } from "./client";

const migrationsFolder = fileURLToPath(new URL("migrations", import.meta.url));

/**
 * Applies every migration that has not run yet, then closes the connection.
 *
 * This is the programmatic form of `pnpm db:migrate` (`drizzle-kit migrate`) —
 * same folder, same migrator — for callers that already have a connection
 * string in hand and cannot shell out for one, such as the test harness
 * building a throwaway database.
 */
export async function runMigrations(databaseUrl: string) {
  const database = createDatabase(databaseUrl);
  try {
    await migrate(database, { migrationsFolder });
  } finally {
    await database.$client.end();
  }
}
