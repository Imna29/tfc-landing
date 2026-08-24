import { EMAIL_MESSAGES } from "#shared/emails";

/**
 * Sends the signed-in fan the link that confirms their email address, again.
 *
 * The one email a fan is most likely to need twice: the first arrives while
 * they are still filling in a form, and lands in a folder nobody looks at.
 * This is the button behind "it never arrived", and it is why a refused
 * message is answered with a failure rather than with reassurance.
 *
 * It sends only to whoever is signed in — never to an address in a request
 * body — so it cannot be pointed at somebody else's inbox.
 */
export default defineEventHandler(async (event) => {
  const fan = await requireFan(event);

  // Nothing to send, and nothing wrong with that: a fan who confirmed on their
  // phone and came back to a page rendered before they did should not be told
  // an email failed.
  if (fan.emailVerified) return { sent: false };

  if (!(await sendVerificationLink(fan.email, event.headers))) {
    throw createError({
      statusCode: 502,
      statusMessage: "That email did not go out",
      message: EMAIL_MESSAGES.notSent,
    });
  }

  return { sent: true };
});
