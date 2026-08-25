import { $fetch, fetch } from "@nuxt/test-utils/e2e";
import { describe, expect, it } from "vitest";
import { signUp } from "../helpers/accounts";
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

  it("serves a page that reads a session under one spelling only", async () => {
    // Vue Router matched case-insensitively, so `/PROFILE` rendered the
    // signed-in fan's page — while missing the rule that exempts `/profile`,
    // falling through to `"/**": { isr: 600 }` and being stored at the edge.
    // One fan's email address, served to whoever asked next, with no error
    // anywhere to notice it by. ADR-0012 is why there is one spelling now.
    const { details, cookie } = await signUp();

    expect(await $fetch("/profile", { headers: { cookie } })).toContain(details.email);

    for (const spelling of ["/PROFILE", "/Profile"]) {
      const response = await fetch(spelling, { headers: { cookie } });

      expect(response.status).toBe(404);
      expect(await response.text()).not.toContain(details.email);
    }
  });

  it.each([
    ["/account/sign-in", "/ACCOUNT/SIGN-IN"],
    ["/contest-rules", "/Contest-Rules"],
  ])("serves %s but not %s", async (served, notServed) => {
    expect((await fetch(served)).status).toBe(200);
    expect((await fetch(notServed)).status).toBe(404);
  });

  it("answers a page that does not exist with a 404, not an empty one", async () => {
    // The Prismic catch-all takes any single segment, so a wrong spelling now
    // lands there instead of on the page it was aiming at. An empty 200 would
    // make every one of those look like a page somebody forgot to write.
    expect((await fetch("/not-a-page-anybody-authored")).status).toBe(404);
  });
});
