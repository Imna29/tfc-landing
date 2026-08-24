/**
 * Identity: signing up, signing in, signing out, and the session cookie that
 * carries the answer between requests. Built on `better-auth`.
 *
 * **Two vocabularies meet here, and this is the only place they touch.**
 * `better-auth` calls a user's display name `name`; the only name TFC ever
 * shows is a username, so its `name` field is mapped onto the `username`
 * column and nothing else is called `name` anywhere. Its `account` model is a
 * credential, not what a fan means by their account.
 *
 * First name, last name and date of birth are `returned: false`, so no
 * response `better-auth` composes can carry them — not the session, not the
 * sign-up reply, not a future admin route. That is the ADR-0007 privacy
 * decision enforced once, at the field, rather than remembered at every call
 * site.
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { type SQL, sql } from "drizzle-orm";
import {
  MINIMUM_PASSWORD_LENGTH,
  SIGN_UP_MESSAGES,
  contestDateOn,
  isOldEnoughOn,
} from "#shared/signUp";
import { accounts, sessions, users, verifications } from "../db/schema";
import { useDatabase } from "./db";

/** The code this app's own rejection carries, for the route that translates it. */
export const REFUSED_UNDER_AGE = "UNDER_AGE";

export type Auth = ReturnType<typeof createAuth>;

let auth: Auth | undefined;

/** The app's authentication, created once per process and reused. */
export function useAuth(): Auth {
  auth ??= createAuth();
  return auth;
}

function createAuth() {
  const database = useDatabase();

  return betterAuth({
    appName: "TFC Predictions",
    secret: authSecret(),

    database: drizzleAdapter(database, {
      provider: "pg",
      // Keyed by `better-auth`'s model names, so the tables can be called what
      // this domain calls them.
      schema: {
        user: users,
        session: sessions,
        account: accounts,
        verification: verifications,
      },
      transaction: true,
    }),

    // A UUID, rather than the opaque string `better-auth` generates by
    // default, so a user id is the same shape as every other id in this
    // schema — a Coin ledger with two shapes of key in it is a ledger nobody
    // can read.
    advanced: { database: { generateId: "uuid" } },

    emailAndPassword: {
      enabled: true,
      minPasswordLength: MINIMUM_PASSWORD_LENGTH,
      // A fan may sign in before confirming their address; what an unconfirmed
      // address blocks is submitting a first Entry, which arrives with #11.
      //
      // Turning this on also silently changes what a sign-up with a duplicate
      // email answers: `better-auth` stops refusing and returns a synthetic
      // success instead, so that nobody can learn which addresses have
      // accounts. This app is asked for the opposite — "an email already
      // registered is rejected" — and `server/api/accounts/sign-up.post.ts`
      // asks the question itself rather than inheriting the answer from here.
      requireEmailVerification: false,
      sendResetPassword: async ({ user, url }) => logEmail("password reset", user.email, url),
    },

    emailVerification: {
      sendOnSignUp: true,
      sendVerificationEmail: async ({ user, url }) => logEmail("verify email", user.email, url),
    },

    user: {
      // `name` is the username. See the note at the top of this file.
      fields: { name: "username" },
      additionalFields: {
        firstName: { type: "string", required: true, returned: false },
        lastName: { type: "string", required: true, returned: false },
        // A date, never an age: an age integer is wrong the morning after a
        // birthday and cannot be turned back into evidence (ADR-0007). Typed
        // as a string so it stays the calendar date it was given, rather than
        // an instant that moves across midnight with the reader's timezone.
        dateOfBirth: { type: "string", required: true, returned: false },
      },
    },

    databaseHooks: {
      user: { create: { before: refuseUnderAge } },
    },
  });
}

/**
 * The 18+ gate, checked on the way into the database rather than on the way
 * into any one route.
 *
 * It is checked earlier too, where a fan can be told about every problem with
 * their form at once. This is the copy that cannot be gone around:
 * `better-auth` serves a sign-up route of its own, and every later way of
 * creating a user — a social login, an admin making an account — arrives here
 * as well. ADR-0007 is not a rule any one form gets to enforce.
 *
 * It deliberately asks the database nothing. This runs inside `better-auth`'s
 * own transaction, which on a serverless function holds the process's only
 * connection: a query from in here waits for a connection that cannot be
 * returned until the query finishes, and the request hangs until it times out.
 * Anything needing a query — is this username taken? — belongs in the route,
 * before the transaction opens.
 */
async function refuseUnderAge(user: Record<string, unknown>) {
  const dateOfBirth = typeof user.dateOfBirth === "string" ? user.dateOfBirth : "";

  if (!isOldEnoughOn(dateOfBirth, contestDateOn(new Date()))) {
    throw new APIError("UNPROCESSABLE_ENTITY", {
      code: REFUSED_UNDER_AGE,
      message: SIGN_UP_MESSAGES.underAge,
    });
  }
}

/**
 * Whether a username belongs to someone already, ignoring case — `IronMike`
 * and `ironmike` are not two fans anyone could tell apart on a leaderboard.
 *
 * The `users_username_unique` index is what actually guarantees this; the
 * query is how a fan gets told about it in a sentence instead of a 500.
 */
export function usernameTaken(username: string): Promise<boolean> {
  return exists(sql`lower(${users.username}) = lower(${username})`);
}

/**
 * Whether an email address already has an account.
 *
 * Asking this out loud is a decision, not an oversight: it tells anyone who
 * asks which addresses have accounts here. The ticket asks for it — "an email
 * already registered is rejected" — because a fan who has forgotten they
 * signed up is a likelier visitor than someone enumerating the database, and
 * the alternative is a sign-up that appears to work and then cannot be signed
 * in to.
 */
export function emailTaken(email: string): Promise<boolean> {
  return exists(sql`lower(${users.email}) = lower(${email})`);
}

async function exists(match: SQL): Promise<boolean> {
  const [row] = await useDatabase().select({ id: users.id }).from(users).where(match).limit(1);

  return row !== undefined;
}

function authSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;

  if (!secret) {
    throw new Error(
      "BETTER_AUTH_SECRET is not set. Generate one with `openssl rand -base64 32` and " +
        "put it in .env — .env.example ships it empty on purpose, because a secret " +
        "committed to the repository is not a secret.",
    );
  }

  return secret;
}

/**
 * Where transactional email goes until #5 gives it a transport.
 *
 * Logged rather than swallowed so the link is reachable in development, and so
 * that this ticket does not wait on DNS access to a sending subdomain.
 */
function logEmail(kind: string, address: string, link: string) {
  console.info(`[email] ${kind} → ${address}: ${link}`);
}
