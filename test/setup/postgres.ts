import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import type { TestProject } from "vitest/node";
import { runMigrations } from "../../server/db/migrate";

/**
 * Pinned so a test run cannot start passing or failing because a `latest` tag
 * moved. This is the version the app is developed against; when the production
 * database is chosen, this should follow whatever it runs.
 */
const image = "postgres:18";

let container: StartedPostgreSqlContainer | undefined;

/**
 * Starts one throwaway Postgres for the whole server test run and migrates it,
 * then hands its connection string to the tests through `inject`.
 *
 * A container per run rather than a shared development database, so a test run
 * can never be shaped by whatever happened to be in the database beforehand,
 * and can never damage it.
 */
export async function setup(project: TestProject) {
  container = await new PostgreSqlContainer(image).start();
  const databaseUrl = container.getConnectionUri();

  await runMigrations(databaseUrl);

  project.provide("databaseUrl", databaseUrl);
}

export async function teardown() {
  await container?.stop();
}
