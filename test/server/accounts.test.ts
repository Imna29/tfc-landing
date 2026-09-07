import { $fetch, fetch } from "@nuxt/test-utils/e2e";
import { describe, expect, it } from "vitest";
import { users } from "../../server/db/schema";
import {
  cookieFrom,
  fanDetails,
  postJson,
  signInRequest,
  signOutRequest,
  signUp,
  signUpRequest,
} from "../helpers/accounts";
import { testDatabase } from "../helpers/database";
import { setupTestServer } from "../helpers/server";

/** The problems a rejected sign-up reported, as `{ field: message }`. */
async function problemsFrom(response: Response) {
  const body = (await response.json()) as { problems?: { field: string; message: string }[] };

  return Object.fromEntries((body.problems ?? []).map((p) => [p.field, p.message]));
}

describe("accounts", async () => {
  await setupTestServer();

  it("signs a new fan in as soon as they have signed up", async () => {
    const { details, cookie } = await signUp({ username: "corner-man" });

    // Two fields, and deliberately no third: ADR-0018 took the confirmation
    // state off this answer along with the flow that set it.
    expect(await $fetch("/api/accounts/me", { headers: { cookie } })).toEqual({
      username: "corner-man",
      email: details.email,
    });
  });

  it("turns away a username somebody already has", async () => {
    await signUp({ username: "IronMike" });

    const response = await signUpRequest(fanDetails({ username: "IronMike" }));

    expect(response.status).toBe(422);
    expect(await problemsFrom(response)).toHaveProperty("username");
  });

  it("does not let two fans be told apart only by capital letters", async () => {
    await signUp({ username: "IronMike" });

    const response = await signUpRequest(fanDetails({ username: "ironmike" }));

    expect(response.status).toBe(422);
    expect(await problemsFrom(response)).toHaveProperty("username");
  });

  it("turns away an email address that already has an account", async () => {
    const { details } = await signUp();

    const response = await signUpRequest(fanDetails({ email: details.email }));

    expect(response.status).toBe(422);
    expect(await problemsFrom(response)).toHaveProperty("email");
  });

  it("turns away a phone number that already has an account", async () => {
    // `users_phone_unique` is the whole of "one account per person" since
    // ADR-0018, and this is a fan being told which rule they met rather than
    // being handed a failed insert.
    const { details } = await signUp();

    const response = await signUpRequest(fanDetails({ phone: details.phone }));

    expect(response.status).toBe(422);
    expect((await problemsFrom(response)).phone).toMatch(/one account/i);
  });

  it("reads two spellings of one number as one account", async () => {
    // The stored form is normalised, so the index has one spelling to compare.
    // Typed differently, this is the same number as the one above it.
    await signUp({ phone: "+995555123456" });

    const response = await signUpRequest(fanDetails({ phone: "+995 555 12 34 56" }));

    expect(response.status).toBe(422);
    expect(await problemsFrom(response)).toHaveProperty("phone");
  });

  it("reports everything wrong with a form at once", async () => {
    const response = await signUpRequest(
      fanDetails({ username: "!", password: "short", phone: "" }),
    );

    expect(Object.keys(await problemsFrom(response))).toEqual(["username", "password", "phone"]);
  });

  it("creates nothing when it turns a fan away", async () => {
    await signUpRequest(fanDetails({ phone: "not a number" }));

    expect(await $fetch("/api/health")).toEqual({ status: "ok", users: 0 });
  });

  it("normalises a phone number on every door into the database, not just this one", async () => {
    // The door this route does not own. `better-auth` serves a sign-up of its
    // own, and a number written differently would reach the index as a
    // different string and open a second account for one person — which is the
    // whole of "one account per person" failing quietly (ADR-0018). The
    // `user.create.before` hook is what normalises it wherever it arrives.
    const { details } = await signUp({ phone: "+995555123456" });

    const other = fanDetails();
    const response = await postJson("/api/auth/sign-up/email", {
      name: other.username,
      email: other.email,
      password: other.password,
      // The same number as `details.phone`, typed the way half of Europe does.
      phone: "00995 555 12 34 56",
    });

    expect(details.phone).toBe("+995555123456");
    expect(response.ok).toBe(false);
    expect(await $fetch("/api/health")).toEqual({ status: "ok", users: 1 });
  });

  it("stores a number normalised however it arrived", async () => {
    const details = fanDetails({ phone: "+995555777888" });

    const created = await postJson("/api/auth/sign-up/email", {
      name: details.username,
      email: details.email,
      password: details.password,
      phone: "00995 (555) 77-78-88",
    });

    expect(created.ok).toBe(true);

    const [stored] = await testDatabase().select({ phone: users.phone }).from(users);

    expect(stored).toEqual({ phone: "+995555777888" });
  });

  it("refuses an account with no reachable phone number, on that door too", async () => {
    const details = fanDetails();

    const response = await postJson("/api/auth/sign-up/email", {
      name: details.username,
      email: details.email,
      password: details.password,
      phone: "call me",
    });

    expect(response.ok).toBe(false);
    expect(await $fetch("/api/health")).toEqual({ status: "ok", users: 0 });
  });

  it("holds one account per phone number on every door into the database", async () => {
    // `better-auth` serves a sign-up route of its own, and later tickets add
    // more ways for a user row to appear. "One account per person" is not a
    // rule that any one form gets to be the enforcement of (ADR-0018), so the
    // index refuses the second row however it was asked for.
    const { details } = await signUp();

    const other = fanDetails({ phone: details.phone });
    const response = await postJson("/api/auth/sign-up/email", {
      name: other.username,
      email: other.email,
      password: other.password,
      phone: other.phone,
    });

    expect(response.ok).toBe(false);
    expect(await $fetch("/api/health")).toEqual({ status: "ok", users: 1 });
  });

  it("keeps a fan signed in across requests, and across authenticated sections", async () => {
    const { cookie } = await signUp({ username: "cage-side" });

    // The API, and then a server-rendered page under a different prefix,
    // rendered from the cookie a browser sends back after a reload.
    expect(await $fetch("/api/accounts/me", { headers: { cookie } })).toMatchObject({
      username: "cage-side",
    });
    expect(await $fetch("/profile", { headers: { cookie } })).toContain("cage-side");
  });

  it("signs a returning fan back in", async () => {
    const { details, cookie } = await signUp({ username: "returning" });
    await signOutRequest(cookie);

    const response = await signInRequest({ email: details.email, password: details.password });

    expect(response.ok).toBe(true);
    expect(
      await $fetch("/api/accounts/me", { headers: { cookie: cookieFrom(response) } }),
    ).toMatchObject({ username: "returning" });
  });

  it("does not sign in a fan who got their password wrong", async () => {
    const { details } = await signUp();

    const response = await signInRequest({ email: details.email, password: "not the password" });

    expect(response.ok).toBe(false);
  });

  it("signs a fan out, and the cookie stops working", async () => {
    const { cookie } = await signUp();

    expect((await signOutRequest(cookie)).ok).toBe(true);

    await expect($fetch("/api/accounts/me", { headers: { cookie } })).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it("asks a signed-out visitor to sign in rather than only refusing them", async () => {
    await expect($fetch("/api/accounts/me")).rejects.toMatchObject({
      statusCode: 401,
      data: { message: expect.stringMatching(/sign in/i) },
    });
  });

  it("offers a signed-out visitor a way in from the page they cannot see", async () => {
    expect(await $fetch("/profile")).toContain("/account/sign-in");
  });

  it("does not show a signed-in fan a form for getting signed in", async () => {
    const { cookie } = await signUp();

    // The session reaches every authenticated prefix, `/account` among them.
    const response = await fetch("/account/sign-in", { headers: { cookie }, redirect: "manual" });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/profile");
  });

  it("stores a phone number normalised, not as the fan typed it", async () => {
    await signUpRequest(fanDetails({ phone: "+995 (555) 12-34-56" }));

    // Read straight from the table, because there is deliberately no endpoint
    // that would answer this. The stored spelling is what `users_phone_unique`
    // compares, so it is the shape the rule is enforced on (ADR-0018).
    const [stored] = await testDatabase().select({ phone: users.phone }).from(users);

    expect(stored).toEqual({ phone: "+995555123456" });
  });

  it("never puts a fan's phone number in an answer", async () => {
    const details = fanDetails({ phone: "+995555987654" });
    const created = await signUpRequest(details);
    const cookie = cookieFrom(created);

    // Everything the app will say about a fan to anyone, including `better-auth`'s
    // own session route, which composes its answer from the user row itself.
    const answers = [
      await created.text(),
      JSON.stringify(await $fetch("/api/accounts/me", { headers: { cookie } })),
      JSON.stringify(await $fetch("/api/auth/get-session", { headers: { cookie } })),
      await $fetch("/profile", { headers: { cookie } }),
    ];

    for (const answer of answers) {
      // It is an answer about this fan — otherwise the one below proves nothing.
      expect(answer).toContain(details.username);
      expect(answer).not.toContain(details.phone);
    }
  });
});
