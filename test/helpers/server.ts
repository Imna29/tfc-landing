import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { setup } from "@nuxt/test-utils/e2e";
import { inject } from "vitest";

type SetupOptions = Parameters<typeof setup>[0];

/**
 * Boots the real Nitro server for a test file, pointed at the test database.
 *
 * The app is built once for the whole run in `test/setup/build.ts`, and this
 * starts a server from that build rather than making another one. What differs
 * between test files — the database, the connection budget, the port, the
 * mailbox to send to — is environment handed to the server process, so one
 * build serves every file that does not ask for a different one.
 *
 * `nuxtConfig` is what asks for a different one, and it is the expensive thing
 * to reach for: a file that passes it pays for a full Nuxt build of its own,
 * and adds that to every run. Only `test/server/cache-boundary.test.ts` needs
 * it, because the cache in front of the app is route rules and route rules are
 * compiled in. Anything else that wants a different server should want a
 * different environment instead.
 *
 * `env` is merged rather than replaced, so a file that needs one more variable
 * — a mailbox to send to, say — does not have to restate the database and the
 * connection budget to get it.
 */
export async function setupTestServer({ env, ...overrides }: Partial<SetupOptions> = {}) {
  // A file asking for its own configuration is asking for its own build; there
  // is nothing the shared one could be that would also satisfy it.
  const sharesTheBuild = overrides.nuxtConfig === undefined;

  await setup({
    // This helper is two directories deep, same as the test files themselves.
    rootDir: fileURLToPath(new URL("../..", import.meta.url)),
    server: true,
    build: !sharesTheBuild,
    // `@nuxt/test-utils` derives the Nitro output it starts from `buildDir`,
    // so pointing it at the shared build is all it takes to skip building.
    ...(sharesTheBuild ? { buildDir: inject("buildDir") } : {}),
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
      ...env,
    },
    ...overrides,
  });
}

/**
 * A port nothing is listening on, for a test that has to know where the server
 * will be before it starts.
 *
 * Only `test/server/email.test.ts` needs this, and needs it for a real reason:
 * `BETTER_AUTH_URL` is what every emailed link is built from, and it has to be
 * handed to the server as configuration rather than discovered from it
 * afterwards. Server test files never run in parallel, so nothing else is
 * racing for the port between this closing and Nitro binding it.
 */
export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();

    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();

      probe.close(() =>
        typeof address === "object" && address
          ? resolve(address.port)
          : reject(new Error("Could not find a free port.")),
      );
    });
  });
}
