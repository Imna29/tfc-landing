import { $fetch, fetch } from "@nuxt/test-utils/e2e";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { users } from "../../server/db/schema";
import { fanDetails, postJson, signUp, signUpAdmin } from "../helpers/accounts";
import { testDatabase } from "../helpers/database";
import { setupTestServer } from "../helpers/server";
import { revokeAdmin } from "../helpers/users";

/**
 * The lock every admin capability sits behind.
 *
 * A file of its own rather than cases added to `test/server/accounts.test.ts`,
 * and so one more Nuxt build in every run: this is the file six later admin
 * tickets add to, and the one to copy when they do.
 */
describe("the admin area", async () => {
  await setupTestServer();

  describe("who gets in", () => {
    it("refuses a fan an admin API endpoint", async () => {
      const { cookie } = await signUp();

      const response = await fetch("/api/admin/me", { headers: { cookie } });

      expect(response.status).toBe(403);
    });

    it("refuses a fan an admin endpoint a later ticket added", async () => {
      // The file the README points a new admin endpoint's tests at, so that
      // the guard is asserted here for each one rather than only wherever its
      // own feature is tested. Opening a Season is #7's; what it does lives in
      // `test/server/coins.test.ts`.
      const { cookie } = await signUp();

      expect((await postJson("/api/admin/seasons", { name: "Season 1" }, cookie)).status).toBe(403);
      expect((await postJson("/api/admin/seasons", { name: "Season 1" })).status).toBe(401);
      expect((await fetch("/api/admin/seasons", { headers: { cookie } })).status).toBe(403);

      // Importing a card is #8's; what it does with one lives in
      // `test/unit/card-import.test.ts`. The refusal is asserted here, and it
      // matters more than most: these routes read Prismic and write the Bouts
      // the whole game is played against.
      expect((await postJson("/api/admin/events", { prismicId: "anything" }, cookie)).status).toBe(
        403,
      );
      expect((await postJson("/api/admin/events", { prismicId: "anything" })).status).toBe(401);
      expect((await fetch("/api/admin/events", { headers: { cookie } })).status).toBe(403);

      // Pricing a card and opening its Bouts is #9's; what they do lives in
      // `test/server/bouts.test.ts`. A fan who reached these could set their
      // own Multipliers and then commit Coins against them.
      const anyId = "0f6d0f5a-2c0e-4b0a-9d51-6a0a3f0f9c11";
      const multipliers = { multipliers: { [anyId]: 2 } };

      expect((await fetch(`/api/admin/events/${anyId}`, { headers: { cookie } })).status).toBe(403);
      expect(
        (await postJson(`/api/admin/bouts/${anyId}/multipliers`, multipliers, cookie)).status,
      ).toBe(403);
      expect((await postJson(`/api/admin/bouts/${anyId}/multipliers`, multipliers)).status).toBe(
        401,
      );
      expect((await postJson(`/api/admin/bouts/${anyId}/open`, {}, cookie)).status).toBe(403);
      expect((await postJson(`/api/admin/bouts/${anyId}/open`, {})).status).toBe(401);

      // Locking a Bout is #12's and entering a result is #14's; correcting one
      // that was entered wrong is #16's, and what each does lives in
      // `test/server/settlement.test.ts` and `test/server/corrections.test.ts`.
      // These are the routes that move Coins: a fan who reached the last of
      // them could reverse a Reward somebody else won and pay themselves one.
      const ending = { winner: "red", method: "decision", round: null };

      expect((await postJson(`/api/admin/bouts/${anyId}/lock`, {}, cookie)).status).toBe(403);
      expect((await postJson(`/api/admin/bouts/${anyId}/lock`, {})).status).toBe(401);
      expect((await postJson(`/api/admin/bouts/${anyId}/result`, ending, cookie)).status).toBe(403);
      expect((await postJson(`/api/admin/bouts/${anyId}/result`, ending)).status).toBe(401);
      expect((await postJson(`/api/admin/bouts/${anyId}/correction`, ending, cookie)).status).toBe(
        403,
      );
      expect((await postJson(`/api/admin/bouts/${anyId}/correction`, ending)).status).toBe(401);

      // Closing a Season is #19's, and what it does lives in
      // `test/server/seasons.test.ts`. A fan who reached it could end the
      // competition and freeze the standings every Prize is decided on.
      expect((await postJson(`/api/admin/seasons/${anyId}/close`, {}, cookie)).status).toBe(403);
      expect((await postJson(`/api/admin/seasons/${anyId}/close`, {})).status).toBe(401);
    });

    it("refuses a fan an admin page", async () => {
      const { cookie } = await signUp();

      const response = await fetch("/admin", { headers: { cookie } });

      expect(response.status).toBe(403);
    });

    it("asks a signed-out visitor to sign in rather than only refusing them", async () => {
      expect((await fetch("/admin")).status).toBe(401);

      await expect($fetch("/api/admin/me")).rejects.toMatchObject({
        statusCode: 401,
        data: { message: expect.stringMatching(/sign in/i) },
      });
    });

    it("lets an admin in", async () => {
      const { details, cookie } = await signUpAdmin();

      expect(await $fetch("/api/admin/me", { headers: { cookie } })).toEqual({
        username: details.username,
      });
    });

    it("shows an admin an index of what they can do", async () => {
      const { details, cookie } = await signUpAdmin({ username: "cage-side-boss" });

      const page = await $fetch("/admin", { headers: { cookie } });

      expect(page).toContain(details.username);
      expect(page).toMatch(/capabilities/i);
    });
  });

  describe("what the lock covers", () => {
    it("refuses an admin route before asking whether it exists", async () => {
      // The guard is the prefix, not a list of routes that has to be kept up
      // to date: an endpoint a later ticket adds is locked from its first line
      // rather than from whenever somebody remembers to lock it.
      const { cookie } = await signUp();

      expect((await fetch("/api/admin/not-built-yet", { headers: { cookie } })).status).toBe(403);
      expect((await fetch("/admin/not-built-yet", { headers: { cookie } })).status).toBe(403);
    });

    it("has nothing there for an admin either, so the refusal was the guard", async () => {
      const { cookie } = await signUpAdmin();

      expect((await fetch("/api/admin/not-built-yet", { headers: { cookie } })).status).toBe(404);
    });

    it("serves the admin area under one spelling only", async () => {
      const { cookie } = await signUpAdmin();

      // Vue Router matches case-insensitively, so `/ADMIN` reaches the same
      // page — but `route-rules.ts` exempts `/admin`, and a spelling it does
      // not exempt falls through to the marketing catch-all and is edge-cached
      // for ten minutes: one admin's page, served to whoever asks next
      // (ADR-0008). Nothing under this prefix answers to a second spelling.
      expect((await fetch("/ADMIN", { headers: { cookie } })).status).toBe(404);
    });

    it("guards an escaped spelling too, however it is unescaped on the way in", async () => {
      const { cookie } = await signUp();

      // Nitro unescapes before anything routes on the path, so `/%61dmin` is
      // the same request as `/admin` by the time the guard sees it — and so it
      // is also the same request by the time the edge cache keys on it. The
      // guard unescapes as well rather than relying on that, since it is the
      // half that fails open.
      expect((await fetch("/%61dmin", { headers: { cookie } })).status).toBe(403);
    });

    it("leaves everything outside the admin area alone", async () => {
      const { cookie } = await signUp();

      expect(await $fetch("/api/health")).toEqual({ status: "ok", users: 1 });
      expect(await $fetch("/api/accounts/me", { headers: { cookie } })).toMatchObject({
        email: expect.any(String),
      });
    });
  });

  describe("how the role is granted", () => {
    it("makes every new account a fan, whatever the sign-up asked for", async () => {
      // `role` is not a field the sign-up route or `better-auth` knows about,
      // and asking for one has to stay a request nothing acts on.
      await postJson("/api/accounts/sign-up", { ...fanDetails(), role: "admin" });

      const [stored] = await testDatabase().select({ role: users.role }).from(users);

      expect(stored).toEqual({ role: "fan" });
    });

    it("refuses to store a role nobody enforces", async () => {
      const { details } = await signUp();

      // A hand-run grant is a hand-typed string, and `Admin` matches nothing.
      // Postgres says so rather than leaving an account that looks granted.
      const outcome = await testDatabase()
        .execute(sql`update users set role = 'Admin' where email = ${details.email}`)
        .then(
          () => "stored it",
          (refusal: Error) => `${refusal.message} ${refusal.cause}`,
        );

      expect(outcome).toMatch(/users_role_known/);
    });

    it("stops an admin the moment the role is taken away", async () => {
      const { details, cookie } = await signUpAdmin();

      expect((await fetch("/api/admin/me", { headers: { cookie } })).status).toBe(200);

      await revokeAdmin(details.email);

      // The same cookie, the same session: the role is read from the row on
      // every request, so revoking one does not wait for a sign-in.
      expect((await fetch("/api/admin/me", { headers: { cookie } })).status).toBe(403);
    });
  });
});
