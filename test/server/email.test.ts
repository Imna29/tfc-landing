import { $fetch, fetch } from "@nuxt/test-utils/e2e";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { accounts, verifications } from "../../server/db/schema";
import { postJson, signInRequest, signUp } from "../helpers/accounts";
import { testDatabase } from "../helpers/database";
import { linkIn, pathOf, startMailbox } from "../helpers/mailbox";
import { freePort, setupTestServer } from "../helpers/server";

/** The sender a domain has been verified for. See the Email section of README.md. */
const SENDER = "TFC Predictions <no-reply@mail.tfcgeo.com>";

describe("transactional email", async () => {
  const mailbox = await startMailbox();

  afterAll(() => mailbox.close());
  beforeEach(() => mailbox.clear());

  // Pinned, because the app has to be told where it is before it starts: the
  // link in an email is built from `BETTER_AUTH_URL`, not from the request
  // that caused it. That is the whole point of the assertions below.
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;

  await setupTestServer({
    port,
    env: {
      BETTER_AUTH_URL: origin,
      RESEND_API_KEY: "re_a_test_key",
      RESEND_BASE_URL: mailbox.url,
      EMAIL_FROM: SENDER,
    },
  });

  /** Follows a link out of an email the way a fan's browser does. */
  function follow(link: string) {
    return fetch(pathOf(link), { redirect: "manual" });
  }

  /**
   * The stored password hash, for asserting that something did or did not
   * change it.
   *
   * Read rather than signed in with, because `better-auth` rate-limits signing
   * in to three attempts every ten seconds in a built server — which is right,
   * and which a test file spending them on assertions it could make another
   * way would run out of.
   */
  async function storedPassword() {
    const [account] = await testDatabase().select({ password: accounts.password }).from(accounts);

    return account?.password;
  }

  /** Asks for a password reset and hands back the token the emailed link carries. */
  async function askForNewPassword(email: string) {
    const asked = await postJson("/api/accounts/password-reset", { email });
    const message = mailbox.lastTo(email);

    if (!message) throw new Error(`Nothing was sent to ${email}.`);

    const landing = await follow(linkIn(message));
    const token = new URL(landing.headers.get("location") ?? "").searchParams.get("token");

    if (!token) throw new Error("The emailed link did not carry a token.");

    return { asked, message, token };
  }

  describe("what signing up sends", () => {
    it("sends a new fan nothing at all", async () => {
      // ADR-0018 retired the confirmation link. Sign-up used to send one from
      // this route and report whether it left; now the account simply exists
      // and the fan is playing. This is the test that would fail if anything
      // started emailing a new fan again.
      const { details, cookie } = await signUp();

      expect(mailbox.sent).toEqual([]);
      expect(mailbox.lastTo(details.email)).toBeUndefined();

      // And the account is real, signed in, and answers with no confirmation
      // state to act on.
      expect(await $fetch("/api/accounts/me", { headers: { cookie } })).toEqual({
        username: details.username,
        email: details.email,
      });
    });

    it("has no route left for asking to be sent a confirmation", async () => {
      const { cookie } = await signUp();

      const asked = await postJson("/api/accounts/verification-email", {}, cookie);

      expect(asked.status).toBe(404);
      expect(mailbox.sent).toEqual([]);
    });
  });

  describe("setting a new password", () => {
    it("sends a fan who is locked out a link, and takes them to the form", async () => {
      const { details } = await signUp();
      mailbox.clear();

      const { asked, message } = await askForNewPassword(details.email);

      expect(asked.status).toBe(200);
      expect(message.subject).toMatch(/password/i);
      expect(message.to).toBe(details.email);

      const landing = await follow(linkIn(message));

      expect(landing.status).toBe(302);
      expect(landing.headers.get("location")).toContain("/account/reset-password?token=");
    });

    it("lets the fan sign in with the new password, and not with the old one", async () => {
      const { details } = await signUp();
      const { token } = await askForNewPassword(details.email);

      const set = await postJson("/api/auth/reset-password", {
        newPassword: "a brand new password",
        token,
      });

      expect(set.ok).toBe(true);

      const withOld = await signInRequest({ email: details.email, password: details.password });
      const withNew = await signInRequest({
        email: details.email,
        password: "a brand new password",
      });

      expect(withOld.ok).toBe(false);
      expect(withNew.ok).toBe(true);
    });

    it("signs the fan out everywhere, because they may not have been the one signed in", async () => {
      const { details, cookie } = await signUp();
      const { token } = await askForNewPassword(details.email);

      await postJson("/api/auth/reset-password", { newPassword: "a brand new password", token });

      await expect($fetch("/api/accounts/me", { headers: { cookie } })).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it("will not let one link set two passwords", async () => {
      const { details } = await signUp();
      const { token } = await askForNewPassword(details.email);

      await postJson("/api/auth/reset-password", { newPassword: "a brand new password", token });
      const afterTheFirst = await storedPassword();

      const again = await postJson("/api/auth/reset-password", {
        newPassword: "a third password entirely",
        token,
      });

      expect(again.ok).toBe(false);
      expect(await storedPassword()).toBe(afterTheFirst);
    });

    it("will not let an expired link set a password", async () => {
      const { details } = await signUp();
      const { token } = await askForNewPassword(details.email);
      const before = await storedPassword();

      // Aged rather than waited for: the link lasts an hour, and a test that
      // waited one is not a test anybody runs.
      await testDatabase()
        .update(verifications)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(verifications.identifier, `reset-password:${token}`));

      const set = await postJson("/api/auth/reset-password", {
        newPassword: "a brand new password",
        token,
      });

      expect(set.ok).toBe(false);
      expect(await storedPassword()).toBe(before);
    });

    it("says the same thing about an address with no account as one with", async () => {
      const { details } = await signUp();
      mailbox.clear();

      const known = await postJson("/api/accounts/password-reset", { email: details.email });
      const stranger = await postJson("/api/accounts/password-reset", {
        email: "nobody@example.com",
      });

      expect(stranger.status).toBe(known.status);
      expect(await stranger.json()).toEqual(await known.json());
      expect(mailbox.sent.map((message) => message.to)).toEqual([details.email]);
    });

    it("asks for an address that could receive something", async () => {
      const response = await postJson("/api/accounts/password-reset", { email: "not an address" });

      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({ problems: [{ field: "email" }] });
      expect(mailbox.sent).toEqual([]);
    });

    it("will not let `better-auth`'s own route answer success for an email it lost", async () => {
      // Reachable by anything that skips this app's routes, and the one path
      // where `better-auth` swallows the refusal and answers 200 on its own.
      const { details } = await signUp();
      mailbox.refuseNext();

      const response = await postJson("/api/auth/request-password-reset", {
        email: details.email,
        redirectTo: "/account/reset-password",
      });

      expect(response.status).toBe(502);
    });

    it("tells a locked-out fan when the email could not be sent", async () => {
      const { details } = await signUp();
      mailbox.refuseNext();

      const response = await postJson("/api/accounts/password-reset", { email: details.email });

      expect(response.status).toBe(502);
      expect(await response.text()).toMatch(/try again/i);
    });
  });
});
