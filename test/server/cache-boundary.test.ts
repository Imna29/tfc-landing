import { $fetch, fetch } from "@nuxt/test-utils/e2e";
import { describe, expect, it } from "vitest";
import { setupTestServer } from "../helpers/server";
import { createUser } from "../helpers/users";

/**
 * ADR-0008: the marketing site is edge-cached, and anything that reads a
 * session must not be, because the cache key ignores cookies.
 *
 * `test/unit/route-rules.test.ts` checks the rules resolve correctly. This
 * checks the server built from them actually behaves that way, by putting a
 * cache over `/**` — standing in for the CDN, which no locally built server
 * has — and showing the API is not in it.
 */
describe("the cache boundary", async () => {
  await setupTestServer({
    nuxtConfig: {
      routeRules: {
        "/**": { cache: { maxAge: 600 } },
      },
    },
  });

  it("answers an API request from Postgres, not from the cache in front of it", async () => {
    expect(await $fetch("/api/health")).toEqual({ status: "ok", users: 0 });

    await createUser();

    // A cached response would still say zero.
    expect(await $fetch("/api/health")).toEqual({ status: "ok", users: 1 });
  });

  it("does not tell anything downstream that an API response may be stored", async () => {
    const response = await fetch("/api/health");

    expect(response.headers.get("cache-control") ?? "").not.toMatch(/max-age=[1-9]/);
  });
});
