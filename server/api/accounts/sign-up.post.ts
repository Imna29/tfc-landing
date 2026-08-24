import { APIError } from "better-auth/api";
import type { H3Event } from "h3";
import {
  SIGN_UP_MESSAGES,
  type SignUpProblem,
  contestDateOn,
  parseSignUpDetails,
} from "#shared/signUp";

/**
 * Creates an account and signs the new fan in.
 *
 * A rejection is a 422 whose body is `{ problems }` — one entry per field a
 * fan has to go back and change, all of them at once, each with the sentence
 * the form should show beside that field. A fan filling in six fields should
 * not be sent back six times.
 *
 * This exists rather than `better-auth`'s own `/api/auth/sign-up/email`
 * because that route asks for a `name`, and answers one problem at a time in
 * its own vocabulary. What lives here is how a fan is *told*; the rule that
 * decides whether an account may exist at all — the 18+ gate — lives in a
 * database hook (`server/utils/auth.ts`) so that it holds on every route,
 * including that one.
 */
export default defineEventHandler(async (event) => {
  const parsed = parseSignUpDetails(await readBody(event), contestDateOn(new Date()));

  if (parsed.problems) return reject(event, parsed.problems);

  const { username, email, password, firstName, lastName, dateOfBirth } = parsed.details;

  // Both asked here rather than in the database hook that enforces the 18+
  // gate, because that hook runs inside a transaction holding the only
  // connection a serverless function has (ADR-0010).
  //
  // The email is asked even though `better-auth` refuses a duplicate on its
  // own: what it does there depends on `requireEmailVerification`, which #5
  // will turn on, and at that point it answers a duplicate with a synthetic
  // success instead. Asking here is how this route keeps answering what the
  // ticket asked for when that flag changes underneath it.
  const alreadyTaken: SignUpProblem[] = [];

  if (await usernameTaken(username)) {
    alreadyTaken.push({ field: "username", message: SIGN_UP_MESSAGES.usernameTaken });
  }

  if (await emailTaken(email)) {
    alreadyTaken.push({ field: "email", message: SIGN_UP_MESSAGES.emailTaken });
  }

  if (alreadyTaken.length > 0) return reject(event, alreadyTaken);

  try {
    const { headers, response } = await useAuth().api.signUpEmail({
      // `name` is the username; see the note in `server/utils/auth.ts`.
      body: { name: username, email, password, firstName, lastName, dateOfBirth },
      headers: event.headers,
      returnHeaders: true,
    });

    // The session cookie `better-auth` set on its own reply, moved onto ours.
    for (const cookie of headers.getSetCookie()) {
      appendResponseHeader(event, "set-cookie", cookie);
    }

    return { fan: fanFrom(response.user) };
  } catch (error) {
    const problem = await problemFrom(error, username);

    if (!problem) throw error;

    return reject(event, [problem]);
  }
});

/**
 * The problems `better-auth` finds that a fan can do something about, in the
 * shape the rest of this route reports problems in.
 *
 * Anything not listed here is a fault rather than a rejection, and is rethrown
 * so it is logged as one instead of being shown to a fan as advice.
 */
async function problemFrom(error: unknown, username: string) {
  if (!(error instanceof APIError)) return undefined;

  const problem = (field: SignUpProblem["field"], message: string) => ({ field, message });

  switch (error.body?.code) {
    case REFUSED_UNDER_AGE:
      return problem("dateOfBirth", SIGN_UP_MESSAGES.underAge);
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
    case "USER_ALREADY_EXISTS":
      return problem("email", SIGN_UP_MESSAGES.emailTaken);
    case "FAILED_TO_CREATE_USER":
      // Two fans claiming one username in the same moment: both got past the
      // check above and `users_username_unique` refused the second insert.
      // The failure does not say which column, so ask.
      return (await usernameTaken(username))
        ? problem("username", SIGN_UP_MESSAGES.usernameTaken)
        : undefined;
    default:
      return undefined;
  }
}

function reject(event: H3Event, problems: SignUpProblem[]) {
  // Not `createError`: its body nests everything under `data`, and this body is
  // read by a form that wants the problems and nothing else.
  setResponseStatus(event, 422);

  return { problems };
}
