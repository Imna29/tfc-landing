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
  container = await new PostgreSqlContainer(image)
    // A database that is thrown away at the end of the run has no reason to
    // survive losing power, and every test pays for the guarantee that it
    // would: each `beforeEach` truncate and each write a request makes waits
    // on a real disk flush. Turning the three durability settings off is worth
    // roughly a fifth of the time the tests spend talking to Postgres.
    //
    // Safe only because of what this container is. Never do this to a database
    // whose contents anybody expects to still be there.
    .withCommand([
      "postgres",
      "-c",
      "fsync=off",
      "-c",
      "synchronous_commit=off",
      "-c",
      "full_page_writes=off",
    ])
    .start();

  const databaseUrl = container.getConnectionUri();

  await runMigrations(databaseUrl);

  project.provide("databaseUrl", databaseUrl);
}

export async function teardown() {
  await container?.stop();
}
