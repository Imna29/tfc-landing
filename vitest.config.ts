import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      // Pure logic and configuration. No database, no Nuxt, no container.
      {
        // Nuxt hands `#shared` to the app and to the server; this project boots
        // neither, and the modules it tests reach their copy through it.
        resolve: {
          alias: { "#shared": fileURLToPath(new URL("./shared", import.meta.url)) },
        },
        test: {
          name: "unit",
          include: ["test/unit/**/*.test.ts"],
          environment: "node",
        },
      },
      // The real Nitro server against a real Postgres. Nothing is mocked: a
      // test that passes here is a statement about what the deployed app does.
      {
        // A server test may import the modules the server is built from, and
        // those reach `shared/` the way Nuxt hands it to them.
        resolve: {
          alias: { "#shared": fileURLToPath(new URL("./shared", import.meta.url)) },
        },
        test: {
          name: "server",
          include: ["test/server/**/*.test.ts"],
          environment: "node",
          globalSetup: ["./test/setup/postgres.ts", "./test/setup/build.ts"],
          setupFiles: ["./test/setup/database.ts"],
          testTimeout: 30_000,
          // The app is built and the Postgres image pulled in `globalSetup`,
          // but a file that needs its own build still makes it in a hook, and
          // the first run does it cold.
          hookTimeout: 300_000,
          // One database for the whole project, and one build, but a Nitro
          // server per file. Files run one at a time so they cannot interleave
          // writes to the database they share.
          fileParallelism: false,
        },
      },
    ],
  },
});
