import type { Fan } from "#shared/fan";
import { eq } from "drizzle-orm";
import type { H3Event } from "h3";
import { users } from "../db/schema";
import { useAuth } from "./auth";
import { useDatabase } from "./db";

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

/**
 * Who is making this request, refusing it unless they are an admin.
 *
 * `server/middleware/admin.ts` has already asked this of every request under
 * `/admin` and `/api/admin`, so a handler that calls this is not what stops a
 * fan getting in — it is how the handler learns *which* admin is acting, for
 * the "who did this, and when" that lock and settlement records need. Calling
 * it costs one more session lookup and one more row read, and buys a route
 * that is still locked if it is ever moved out from under the prefix.
 */
export async function requireAdmin(event: H3Event): Promise<SignedInFan> {
  const fan = await requireFan(event);

  if (!(await isAdmin(fan.id))) {
    throw createError({
      statusCode: 403,
      statusMessage: "Admins only",
      message: "Running TFC Predictions is for TFC staff.",
    });
  }

  return fan;
}

/**
 * Whether this user's role is admin, asked of the `users` row rather than of
 * the session.
 *
 * A session outlives a decision. Reading the role here means a role taken away
 * stops working on the very next request, rather than whenever that browser
 * happens to sign in again — which is what makes revoking one worth doing.
 *
 * The role is deliberately not something `better-auth` knows about, so there
 * is nowhere else this could be read from: see `ROLES` in `server/db/schema.ts`.
 */
async function isAdmin(userId: string): Promise<boolean> {
  const [user] = await useDatabase()
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return user?.role === "admin";
}
