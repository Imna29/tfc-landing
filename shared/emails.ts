/**
 * Email addresses: what counts as one, the one message TFC ever sends to one,
 * where the link in it lands, and the sentences the app says about it.
 *
 * There used to be two. ADR-0018 retired the confirmation link along with the
 * contest whose rules required it, which leaves the password reset — the one
 * email a fan asks for rather than one TFC decides to send.
 *
 * The copy lives here rather than beside the transport that sends it for the
 * same reason `shared/signUp.ts` holds the sentences a rejected form shows: an
 * email is copy a fan reads, and `shared` is part of the content surface
 * `test/unit/vocabulary.test.ts` holds to the naming rule in `CONTEXT.md`. A
 * message composed in `server/` would be the one piece of copy nothing checks.
 *
 * How long each link lasts is here too, so the sentence promising it and the
 * configuration enforcing it (`server/utils/auth.ts`) cannot drift apart.
 */

/**
 * How long a link for setting a new password lasts.
 *
 * Deliberately short: this one lets whoever holds it take an account over, so
 * it should be useful for about as long as it takes to walk from the sign-in
 * form to an inbox and back.
 */
export const PASSWORD_RESET_LINK_HOURS = 1;

/** Where a fan lands after following the link in a password reset email. */
export const PASSWORD_RESET_PATH = "/account/reset-password";

// Deliberately loose, and looser in consequence than it was: nothing confirms
// an address any more (ADR-0018), so this is the only check there is. It still
// only catches the typo that could never receive mail — an address is really
// validated by sending to it, and TFC finds out when a password reset bounces.
const EMAIL_ADDRESS = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/** Whether text is shaped like an address a message could reach. */
export function looksLikeEmail(text: string): boolean {
  return EMAIL_ADDRESS.test(text.trim());
}

/** One message, in the two forms every mail client expects to be offered. */
export interface EmailMessage {
  subject: string;
  /** What a client that will not render HTML shows. */
  text: string;
  html: string;
}

/**
 * Everything the app says to a fan about email that is not itself an email.
 *
 * Kept beside the messages so that a fan reading "a link is on its way" and
 * the link that arrives were written in one place, in one voice.
 */
export const EMAIL_MESSAGES = {
  address: "Enter the email address you signed up with.",
  resetOnItsWay:
    "If that address has an account, a link for setting a new password is on its way. " +
    "Check your inbox.",
  notSent:
    "TFC could not send that email just now. Nothing is wrong with your account — " +
    "try again in a moment.",
  // Covers every reason a link is refused — expired, already spent, or for an
  // account that no longer exists — because the fan's move is the same for all
  // three and none of them is worth telling a stranger apart.
  linkExpired:
    "That link did not work. It may have expired, or already been used. Ask for a new one.",
  passwordChanged: "Your new password is set. Sign in with it.",
} as const satisfies Record<string, string>;

/** The link a fan follows to set a new password after losing the old one. */
export function passwordResetEmail(link: string): EmailMessage {
  return compose(
    "Set a new password",
    [
      "Someone asked to set a new password for your TFC Predictions account.",
      "If that was you, set one here:",
    ],
    link,
    [
      `The link lasts ${inHours(PASSWORD_RESET_LINK_HOURS)}, and works once.`,
      "If it was not you, ignore this email. Your password has not changed.",
    ],
  );
}

/**
 * A message with its link written out twice: once as text, and once as an
 * anchor whose words are the address itself.
 *
 * The anchor says the URL rather than "click here" because a fan reading an
 * email about their account should be able to see where it goes before they
 * follow it, and because that is the one line worth copying into a browser
 * when a mail client mangles the link.
 */
function compose(subject: string, before: string[], link: string, after: string[]): EmailMessage {
  return {
    subject,
    text: [...before, link, ...after].join("\n\n"),
    html: [
      ...before.map(asParagraph),
      `<p><a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p>`,
      ...after.map(asParagraph),
    ].join(""),
  };
}

function asParagraph(text: string): string {
  return `<p>${escapeHtml(text)}</p>`;
}

/**
 * Text as HTML may hold it.
 *
 * The links in these messages carry a token and a `callbackURL` in a query
 * string, so they always contain an `&`. Written into an attribute unescaped,
 * a strict client reads `&callbackURL` as a character reference and the fan
 * follows a link that stops at the ampersand.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inHours(hours: number): string {
  return hours === 1 ? "one hour" : `${hours} hours`;
}
