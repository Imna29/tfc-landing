import { fetch, url } from "@nuxt/test-utils/e2e";
import type { SignUpDetails } from "../../shared/signUp";
import { nextFanNumber } from "./users";

/**
 * A fan who can sign up: old enough, unique, and unremarkable in every way a
 * test is not about.
 *
 * Pass only what the test is asserting on, so what it is about stays visible.
 */
export function fanDetails(overrides: Partial<SignUpDetails> = {}): SignUpDetails {
  const sequence = nextFanNumber();

  return {
    username: `fan-${sequence}`,
    email: `fan-${sequence}@example.com`,
    password: "a long enough password",
    firstName: "Nino",
    lastName: "Beridze",
    dateOfBirth: "1994-03-02",
    ...overrides,
  };
}

/** Posts a sign-up the way the form does, and hands back the raw response. */
export function signUpRequest(details: SignUpDetails): Promise<Response> {
  return postJson("/api/accounts/sign-up", details);
}

/** Signs a fan up, and fails loudly if the details were not acceptable. */
export async function signUp(overrides: Partial<SignUpDetails> = {}) {
  const details = fanDetails(overrides);
  const response = await signUpRequest(details);

  if (!response.ok) {
    throw new Error(`Sign-up rejected (${response.status}): ${await response.text()}`);
  }

  return { details, cookie: cookieFrom(response) };
}

/** Posts a sign-in the way the form does, and hands back the raw response. */
export function signInRequest(credentials: { email: string; password: string }) {
  return postJson("/api/auth/sign-in/email", credentials);
}

/** Posts a sign-out for whoever the cookie belongs to. */
export function signOutRequest(cookie: string) {
  return postJson("/api/auth/sign-out", {}, cookie);
}

/**
 * The cookies a response set, in the form a request sends them back.
 *
 * Signing in and signing out both answer with cookies rather than a token in
 * the body, so a test that skipped these would be testing something no browser
 * does.
 */
export function cookieFrom(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

/**
 * A write the way a browser makes one: JSON, an `origin` header, and cookies
 * only when the caller passes them.
 */
export function postJson(path: string, body: unknown, cookie?: string): Promise<Response> {
  return fetch(path, {
    method: "POST",
    // A browser sends `origin` on every write, and `better-auth` rejects a
    // request that carries a session cookie without one.
    headers: {
      "content-type": "application/json",
      origin: new URL(url("/")).origin,
      ...(cookie === undefined ? {} : { cookie }),
    },
    body: JSON.stringify(body),
    redirect: "manual",
  });
}
