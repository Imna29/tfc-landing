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

    expect(await $fetch("/api/accounts/me", { headers: { cookie } })).toEqual({
      username: "corner-man",
      email: details.email,
      // Verification email delivery arrives with #5; nothing is verified yet.
      emailVerified: false,
    });
  });

  it("turns away a fan who is not yet eighteen, and says so", async () => {
    const today = new Date().getFullYear();
    const response = await signUpRequest(fanDetails({ dateOfBirth: `${today - 12}-01-01` }));

    expect(response.status).toBe(422);
    expect((await problemsFrom(response)).dateOfBirth).toMatch(/\b18\b/);
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

  it("reports everything wrong with a form at once", async () => {
    const response = await signUpRequest(
      fanDetails({ username: "!", password: "short", firstName: "" }),
    );

    expect(Object.keys(await problemsFrom(response))).toEqual([
      "username",
      "password",
      "firstName",
    ]);
  });

  it("creates nothing when it turns a fan away", async () => {
    await signUpRequest(fanDetails({ dateOfBirth: "2020-01-01" }));

    expect(await $fetch("/api/health")).toEqual({ status: "ok", users: 0 });
  });

  it("holds the 18+ gate on every door into the database, not only the form", async () => {
    // `better-auth` serves a sign-up route of its own, and later tickets add
    // more ways for a user row to appear. ADR-0007 is not a rule that any one
    // form gets to be the enforcement of.
    const details = fanDetails({ dateOfBirth: "2020-01-01" });

    const response = await postJson("/api/auth/sign-up/email", {
      name: details.username,
      email: details.email,
      password: details.password,
      firstName: details.firstName,
      lastName: details.lastName,
      dateOfBirth: details.dateOfBirth,
    });

    expect(response.ok).toBe(false);
    expect(await $fetch("/api/health")).toEqual({ status: "ok", users: 0 });
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

  it("keeps a fan's real name, and their date of birth as a date", async () => {
    const details = fanDetails({ firstName: "Tamar", lastName: "Kvaratskhelia" });
    await signUpRequest(details);

    // Read straight from the table, because there is deliberately no endpoint
    // that would answer this. ADR-0007 keeps a real name only so that a Prize
    // can reach a person, and a date of birth rather than an age because an
    // age is wrong the morning after a birthday.
    const [stored] = await testDatabase()
      .select({
        firstName: users.firstName,
        lastName: users.lastName,
        dateOfBirth: users.dateOfBirth,
      })
      .from(users);

    expect(stored).toEqual({
      firstName: "Tamar",
      lastName: "Kvaratskhelia",
      dateOfBirth: details.dateOfBirth,
    });
  });

  it("never puts a fan's real name in an answer", async () => {
    const details = fanDetails({ firstName: "Tamar", lastName: "Kvaratskhelia" });
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
      // It is an answer about this fan — otherwise the two below prove nothing.
      expect(answer).toContain(details.username);
      expect(answer).not.toContain(details.firstName);
      expect(answer).not.toContain(details.lastName);
    }
  });
});
