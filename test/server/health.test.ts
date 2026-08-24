import { $fetch } from "@nuxt/test-utils/e2e";
import { describe, expect, it } from "vitest";
import { setupTestServer } from "../helpers/server";
import { createUser } from "../helpers/users";

describe("GET /api/health", async () => {
  await setupTestServer();

  it("reads from Postgres and answers over HTTP", async () => {
    await createUser();
    await createUser();

    expect(await $fetch("/api/health")).toEqual({ status: "ok", users: 2 });
  });

  it("starts from an empty database, whatever ran before it", async () => {
    expect(await $fetch("/api/health")).toEqual({ status: "ok", users: 0 });
  });
});
