import { EMAIL_MESSAGES, looksLikeEmail } from "#shared/emails";
import type { SignUpProblem } from "#shared/signUp";

/**
 * Sends a fan who cannot sign in the link that lets them set a new password.
 *
 * It answers the same way for an address with an account and one without, so
 * that asking is not a way to find out who has an account here — unlike
 * signing up, which has to say when an address is taken because the fan would
 * otherwise create an account they can never sign in to.
 *
 * A refusal from the mail provider is the one thing it will not paper over. A
 * fan who has locked themselves out and is told a link is on its way has no
 * way of telling a slow inbox from an email that was never sent, and would
 * wait rather than try again.
 */
export default defineEventHandler(async (event) => {
  const body = (await readBody<Record<string, unknown>>(event)) ?? {};
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!looksLikeEmail(email)) {
    // Typed as sign-up's problems rather than merely shaped like them, so that
    // the form component reading both cannot be told they match when they have
    // drifted apart.
    const problems: SignUpProblem[] = [{ field: "email", message: EMAIL_MESSAGES.address }];

    setResponseStatus(event, 422);

    return { problems };
  }

  if (!(await sendPasswordResetLink(email, event.headers))) throw createError(EMAIL_NOT_SENT);

  return { sent: true };
});
