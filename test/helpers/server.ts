import { fileURLToPath } from "node:url";
import { setup } from "@nuxt/test-utils/e2e";
import { inject } from "vitest";

type SetupOptions = Parameters<typeof setup>[0];

/**
 * Builds the app and boots the real Nitro server for a test file, pointed at
 * the test database.
 *
 * Call it at the top of a `describe`, and know what it costs: this is a full
 * Nuxt build per file, so a new server test file adds one to every run. Prefer
 * adding cases to a file that already boots a server over adding another file,
 * unless the new file needs different configuration — which is the one thing
 * `overrides` is for.
 */
export async function setupTestServer(overrides: Partial<SetupOptions> = {}) {
  await setup({
    // This helper is two directories deep, same as the test files themselves.
    rootDir: fileURLToPath(new URL("../..", import.meta.url)),
    server: true,
    build: true,
    env: {
      DATABASE_URL: inject("databaseUrl"),
      // Any value will do — it only has to be the same for the life of one
      // server, so the cookie it signs on sign-in still verifies on the next
      // request.
      BETTER_AUTH_SECRET: "a-test-run-signs-its-cookies-with-this",
      // The connection budget a serverless function has, deliberately: code
      // that needs a second connection while it holds one — a database hook
      // querying inside a transaction, say — deadlocks in production and must
      // deadlock here too. A test about concurrency has to raise this, and say
      // why; see `server/db/client.ts`.
      DATABASE_POOL_MAX: "1",
    },
    ...overrides,
  });
}
