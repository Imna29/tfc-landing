import { APIError } from "better-auth/api";
import type { H3Event } from "h3";
import { SIGN_UP_MESSAGES, type SignUpProblem, parseSignUpDetails } from "#shared/signUp";

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
 * its own vocabulary. What lives here is how a fan is *told*.
 *
 * Nothing is emailed from here. ADR-0018 retired the confirmation link, so a
 * fan who signs up is signed in and playing — there is no second step, and no
 * state where an account exists but cannot be used.
 *
 * What decides whether an account may exist at all is not here: the phone
 * number is normalised in a database hook (`server/utils/auth.ts`) so that it
 * holds on every route, `better-auth`'s own sign-up included.
 */
export default defineEventHandler(async (event) => {
  const parsed = parseSignUpDetails(await readBody(event));

  if (parsed.problems) return reject(event, parsed.problems);

  const { username, email, password, phone } = parsed.details;

  // All three asked here rather than in a database hook, because such a hook
  // runs inside a transaction holding the only connection a serverless
  // function has (ADR-0010).
  //
  // The email is asked even though `better-auth` refuses a duplicate on its
  // own: what it does there depends on `requireEmailVerification`, and with
  // that turned on it answers a duplicate with a synthetic success instead.
  // Asking here is how this route keeps answering what the ticket asked for if
  // that flag ever changes underneath it.
  //
  // The phone is asked because `users_phone_unique` is the whole of "one
  // account per person" (ADR-0018), and a fan who has broken it should be told
  // which rule they met rather than handed a failed insert.
  const alreadyTaken: SignUpProblem[] = [];

  if (await usernameTaken(username)) {
    alreadyTaken.push({ field: "username", message: SIGN_UP_MESSAGES.usernameTaken });
  }

  if (await emailTaken(email)) {
    alreadyTaken.push({ field: "email", message: SIGN_UP_MESSAGES.emailTaken });
  }

  if (await phoneTaken(phone)) {
    alreadyTaken.push({ field: "phone", message: SIGN_UP_MESSAGES.phoneTaken });
  }

  if (alreadyTaken.length > 0) return reject(event, alreadyTaken);

  try {
    const { headers, response } = await useAuth().api.signUpEmail({
      // `name` is the username; see the note in `server/utils/auth.ts`.
      body: { name: username, email, password, phone },
      headers: event.headers,
      returnHeaders: true,
    });

    // The session cookie `better-auth` set on its own reply, moved onto ours.
    for (const cookie of headers.getSetCookie()) {
      appendResponseHeader(event, "set-cookie", cookie);
    }

    return { fan: fanFrom(response.user) };
  } catch (error) {
    const problem = await problemFrom(error, username, phone);

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
async function problemFrom(error: unknown, username: string, phone: string) {
  if (!(error instanceof APIError)) return undefined;

  const problem = (field: SignUpProblem["field"], message: string) => ({ field, message });

  switch (error.body?.code) {
    case REFUSED_UNREACHABLE_PHONE:
      // `parseSignUpDetails` refused this already, so reaching it means the
      // two disagree. Answering with the field rather than rethrowing means a
      // fan is told which box to fix instead of meeting a 500.
      return problem("phone", SIGN_UP_MESSAGES.phone);
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
    case "USER_ALREADY_EXISTS":
      return problem("email", SIGN_UP_MESSAGES.emailTaken);
    case "FAILED_TO_CREATE_USER":
      // Two fans claiming one username — or one phone number — in the same
      // moment: both got past the checks above and a unique index refused the
      // second insert. The failure does not say which column, so ask.
      if (await usernameTaken(username)) {
        return problem("username", SIGN_UP_MESSAGES.usernameTaken);
      }

      return (await phoneTaken(phone)) ? problem("phone", SIGN_UP_MESSAGES.phoneTaken) : undefined;
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
