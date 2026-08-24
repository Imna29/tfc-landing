import { sql } from "drizzle-orm";
import { inject } from "vitest";
import { createDatabase, type Database } from "../../server/db/client";

let database: Database | undefined;

/**
 * A direct connection to the test database, for arranging state and asserting
 * on it. The application under test connects separately, to the same database.
 */
export function testDatabase(): Database {
  database ??= createDatabase(inject("databaseUrl"));
  return database;
}

/**
 * Empties every application table, so each test starts from nothing and the
 * order tests happen to run in cannot change their result.
 *
 * The tables are read from the database rather than listed here, so a new
 * table is covered by the migration that creates it. Drizzle's own bookkeeping
 * lives in the `drizzle` schema and is deliberately left alone.
 */
export async function resetDatabase(): Promise<void> {
  const db = testDatabase();

  const tables = await db.execute<{ tablename: string }>(sql`
    select tablename from pg_tables where schemaname = 'public'
  `);

  if (tables.length === 0) return;

  const names = sql.join(
    tables.map((table) => sql.identifier(table.tablename)),
    sql`, `,
  );

  await db.execute(sql`truncate table ${names} restart identity cascade`);
}

export async function closeTestDatabase(): Promise<void> {
  await database?.$client.end();
  database = undefined;
}
