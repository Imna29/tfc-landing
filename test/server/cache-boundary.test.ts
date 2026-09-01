import { $fetch, fetch } from "@nuxt/test-utils/e2e";
import { describe, expect, it } from "vitest";
import { PREDICTION_MESSAGES } from "../../shared/predictions";
import { LEADERBOARD_MESSAGES, STANDING_MESSAGES } from "../../shared/standings";
import { postJson, signUp, signUpAdmin } from "../helpers/accounts";
import { importTestCard } from "../helpers/cards";
import { setupTestServer } from "../helpers/server";
import { createUser, fanId } from "../helpers/users";

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

  it("does not tell anything downstream that the card page may be stored", async () => {
    // A marketing page is the control, and it is the whole point of the pair:
    // both are anonymous HTML that looks identical to every visitor, both are
    // covered by the same `/**` rule, and only one of them may be kept.
    const marketing = await fetch("/contest-rules");
    const card = await fetch("/predictions");

    expect(marketing.headers.get("cache-control")).toMatch(/max-age=[1-9]/);
    expect(card.headers.get("cache-control") ?? "").not.toMatch(/max-age=[1-9]/);
  });

  it("serves the card a fan reads from Postgres, not from the cache in front of it", async () => {
    // The one page here that is identical for every visitor and still must not
    // be stored: a card ten minutes stale is a Bout shown open that locked
    // eight minutes ago, and a Multiplier shown that has since been corrected.
    // ADR-0008 exempts it for staleness rather than for privacy, which is the
    // reason easiest to forget.
    expect(await $fetch<string>("/predictions")).toContain(PREDICTION_MESSAGES.noCard);

    const admin = await signUpAdmin();

    await postJson("/api/admin/seasons", { name: "Season 1" }, admin.cookie);
    await importTestCard(await fanId(admin.details.email), {
      scheduledStart: new Date(Date.now() + 2 * 60 * 60 * 1000),
    });

    // A cached page would still say there is no card.
    expect(await $fetch<string>("/predictions")).toContain("TFC 12");
  });

  it("never serves one fan's own place on the leaderboard to whoever asks next", async () => {
    // The page ADR-0008 names: public, and personalised anyway, because it
    // carries the signed-in fan's own row. A CDN keys on the path and ignores
    // the cookie, so a stored copy of this one is a fan's Rank shown to
    // everybody who follows them onto it.
    const admin = await signUpAdmin();

    await postJson("/api/admin/seasons", { name: "Season 1" }, admin.cookie);

    const fan = await signUp();
    const theirs = await $fetch<string>("/leaderboard", { headers: { cookie: fan.cookie } });

    // Two fans hold the Season's hundred, and this one reached it second.
    expect(theirs).toContain(STANDING_MESSAGES.ranked(2, 2));

    const anybody = await $fetch<string>("/leaderboard");

    expect(anybody).not.toContain(STANDING_MESSAGES.ranked(2, 2));
    expect(anybody).toContain(LEADERBOARD_MESSAGES.signedOut);
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
