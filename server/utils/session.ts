import type { Fan } from "#shared/fan";
import type { H3Event } from "h3";
import { useAuth } from "./auth";

/**
 * A signed-in fan, plus the id the server needs to write rows against them.
 *
 * There is no first or last name on this type, and no way to get one: real
 * names are `returned: false` in `server/utils/auth.ts`, so they are not in
 * the session `better-auth` hands back in the first place. See ADR-0007.
 */
export interface SignedInFan extends Fan {
  id: string;
}

/**
 * A user as `better-auth` hands them over, in this app's own words.
 *
 * The single place its `name` becomes a username on the way out — every answer
 * about a fan is built from here, so the rename cannot be got half right in
 * one route and forgotten in another.
 */
export function fanFrom(user: { name: string; email: string; emailVerified: boolean }): Fan {
  return { username: user.name, email: user.email, emailVerified: user.emailVerified };
}

/** Who is making this request, or `null` if nobody is signed in. */
export async function currentFan(event: H3Event): Promise<SignedInFan | null> {
  const session = await useAuth().api.getSession({ headers: event.headers });

  if (!session) return null;

  return { id: session.user.id, ...fanFrom(session.user) };
}

/**
 * Who is making this request, refusing it if nobody is.
 *
 * The refusal is a 401 carrying a sentence a fan can act on, because that is
 * what the browser shows them: a signed-out visitor who tries to do something
 * that needs an account is asking to be told to sign in, not to be told
 * "Unauthorized".
 */
export async function requireFan(event: H3Event): Promise<SignedInFan> {
  const fan = await currentFan(event);

  if (!fan) {
    throw createError({
      statusCode: 401,
      statusMessage: "Sign in to do that",
      message: "Sign in to take part in TFC Predictions.",
    });
  }

  return fan;
}
