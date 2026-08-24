import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      // Pure logic and configuration. No database, no Nuxt, no container.
      {
        test: {
          name: "unit",
          include: ["test/unit/**/*.test.ts"],
          environment: "node",
        },
      },
      // The real Nitro server against a real Postgres. Nothing is mocked: a
      // test that passes here is a statement about what the deployed app does.
      {
        test: {
          name: "server",
          include: ["test/server/**/*.test.ts"],
          environment: "node",
          globalSetup: ["./test/setup/postgres.ts"],
          setupFiles: ["./test/setup/database.ts"],
          testTimeout: 30_000,
          // Building the Nuxt app and pulling the Postgres image both happen
          // inside hooks, and the first run does them cold.
          hookTimeout: 300_000,
          // One database for the whole project, but a Nitro server per file —
          // every `setup()` is its own Nuxt build. Files run one at a time so
          // they cannot interleave writes to the database they share.
          fileParallelism: false,
        },
      },
    ],
  },
});
