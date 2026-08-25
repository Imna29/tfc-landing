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
  EMAIL_CONFIRMED_PATH,
  PASSWORD_RESET_LINK_HOURS,
  PASSWORD_RESET_PATH,
  VERIFICATION_LINK_HOURS,
  passwordResetEmail,
  verificationEmail,
} from "#shared/emails";
import { COIN_REASONS } from "#shared/coins";
import {
  MINIMUM_PASSWORD_LENGTH,
  SIGN_UP_MESSAGES,
  contestDateOn,
  isOldEnoughOn,
} from "#shared/signUp";
import { accounts, sessions, users, verifications } from "../db/schema";
import { grantOneFanTheirStartingCoins } from "./coins";
import { useDatabase } from "./db";
import { sendEmail, sendingEmail } from "./email";
import { currentSeason } from "./seasons";

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
    baseURL: baseUrl(),
    trustedOrigins: alsoTrusted(),

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
      resetPasswordTokenExpiresIn: PASSWORD_RESET_LINK_HOURS * 3600,
      // A fan resetting their password is usually a fan who has lost control
      // of the old one. Everywhere they were signed in stops being signed in.
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: ({ user, url }) =>
        sendEmail({ to: user.email, ...passwordResetEmail(url) }),
    },

    emailVerification: {
      // `server/api/accounts/sign-up.post.ts` sends this itself, immediately
      // after the account exists. `better-auth` would send it from inside its
      // own sign-up route and swallow a failure — see {@link sendingEmail} —
      // and the fan would be told their email was on its way when it was not.
      sendOnSignUp: false,
      expiresIn: VERIFICATION_LINK_HOURS * 3600,
      // Deliberately not `autoSignInAfterVerification`. Confirming an address
      // is not signing in, and a link that did both would turn every
      // verification email into a way into the account that sent it.
      sendVerificationEmail: ({ user, url }) =>
        sendEmail({ to: user.email, ...verificationEmail(url) }),
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
      user: { create: { before: refuseUnderAge, after: grantJoiningFanTheirCoins } },
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
 * The Season's starting Coins, granted the moment an account exists.
 *
 * Here rather than in `server/api/accounts/sign-up.post.ts` for the reason the
 * 18+ gate is: `better-auth` serves a sign-up route of its own, and every
 * later way of creating a user arrives here too. "A fan who joins receives 100
 * Coins" is not a rule one form gets to be the enforcement of.
 *
 * An `after` hook, unlike the `before` one above, may query: `better-auth`
 * queues these until its own transaction has committed, so the process's only
 * connection is free again by the time this runs (ADR-0010). What it costs is
 * that this is no longer the same transaction as the account — a failure here
 * leaves an account that exists holding no Coins, and it is deliberately not
 * swallowed: a fan told their account was created when their Balance was not
 * recorded would find out at the moment they tried to play. The README says
 * how to write the missing grant by hand.
 *
 * A fan who signs up while no Season is open is granted nothing and needs
 * nothing: opening one grants to every fan who has an account by then.
 */
async function grantJoiningFanTheirCoins(user: Record<string, unknown>) {
  const userId = typeof user.id === "string" ? user.id : "";
  const season = await currentSeason();

  if (!userId || !season) return;

  await grantOneFanTheirStartingCoins(season.id, COIN_REASONS.joinedSeason(season.name), userId);
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
 * Sends a fan the link that confirms their email address, and says whether it
 * left.
 *
 * `headers` should be the ones the request arrived with. When they carry the
 * fan's session `better-auth` sends against it directly; when they do not it
 * looks the address up, and answers the same way for an address with no
 * account as for one with a confirmed address already — so a `true` from here
 * means "nothing refused the message", not "an email is definitely on its way
 * to somebody who needed one". Both callers know the fan exists and is
 * unconfirmed, which is what makes the answer worth acting on.
 */
export function sendVerificationLink(email: string, headers: Headers): Promise<boolean> {
  return handedOver(email, () =>
    useAuth().api.sendVerificationEmail({
      body: { email, callbackURL: EMAIL_CONFIRMED_PATH },
      headers,
    }),
  );
}

/**
 * Sends a fan the link that lets them set a new password, and says whether it
 * left.
 *
 * An address with no account is answered `true` without anything being sent,
 * because that is `better-auth`'s answer and it is the right one: the fan is
 * told a link is on its way either way, so that asking this route is not a way
 * to find out who has an account here.
 */
export function sendPasswordResetLink(email: string, headers: Headers): Promise<boolean> {
  return handedOver(email, () =>
    useAuth().api.requestPasswordReset({
      body: { email, redirectTo: PASSWORD_RESET_PATH },
      headers,
    }),
  );
}

/**
 * Whether the email `ask` composed reached the transport.
 *
 * {@link sendingEmail} answers for the message itself, however `better-auth`
 * treated the refusal, and has already logged it. What is caught here is
 * everything else that can stop a link being sent — the address is confirmed
 * already, the database is unreachable — which leaves the fan with the same
 * thing to do as a refused message: ask again. Logged rather than raised for
 * that reason, not because it is unimportant.
 */
async function handedOver(email: string, ask: () => Promise<unknown>): Promise<boolean> {
  try {
    const { sent } = await sendingEmail(ask);

    return sent;
  } catch (error) {
    console.error(`[email] could not ask for a link to ${email}`, error);

    return false;
  }
}

/**
 * Where this app is reached, which is the origin every emailed link is built
 * from.
 *
 * Set rather than inferred, on purpose. `better-auth` takes the origin from
 * the incoming request when it is handling one, which is fine for a redirect
 * and wrong for an email: a request carrying somebody else's `Host` header
 * would put somebody else's domain in a password reset link. It is also simply
 * unavailable — a route of this app's own calls `auth.api` directly, with no
 * request to read, and every link composed there would come out relative.
 *
 * Unset, this falls back to wherever the process is listening, which is right
 * for `nuxt dev` and for the test suite and wrong everywhere else. What makes
 * that safe is that `chooseMailer` refuses to send for real without
 * `BETTER_AUTH_URL`: nothing can reach a fan's inbox carrying a link to
 * localhost.
 */
function baseUrl(): string {
  return process.env.BETTER_AUTH_URL || localUrl(process.env.HOST || "localhost");
}

/**
 * The origins to trust besides {@link baseUrl}.
 *
 * A local server answers to `localhost` and to `127.0.0.1` alike and a
 * developer may have typed either; `baseURL` can only be one of them, and a
 * write from the other would be refused as cross-origin. A deployment has one
 * address and trusts only it.
 */
function alsoTrusted(): string[] {
  if (process.env.BETTER_AUTH_URL) return [];

  return [localUrl("localhost"), localUrl("127.0.0.1")];
}

function localUrl(host: string): string {
  return `http://${host}:${process.env.PORT || 3000}`;
}
