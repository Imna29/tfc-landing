/**
 * What signing up asks for, and what makes an answer acceptable.
 *
 * Shared between the server route that enforces these rules and the form that
 * collects the answers, so a fan reads the same sentence the server would have
 * sent them, before they submit.
 *
 * The rules that decide whether an account may exist at all — the uniqueness
 * of a username, of an email address, and of a phone number — are enforced on
 * the server, because only the database can answer them. What lives here is
 * the arithmetic and the wording they are enforced with.
 */
import { looksLikeEmail } from "./emails";

/** The shortest password `better-auth` is configured to accept. */
export const MINIMUM_PASSWORD_LENGTH = 8;

/** How long a username may be, in characters. */
export const USERNAME_LENGTH = { minimum: 3, maximum: 20 } as const;

/**
 * How many digits a phone number may carry, after its `+` and ignoring its
 * punctuation.
 *
 * The maximum is E.164's: fifteen digits including the country code, which is
 * the most any number in the world has. The minimum is the shortest a country
 * code and a national number come to together.
 */
export const PHONE_DIGITS = { minimum: 7, maximum: 15 } as const;

const PHONE_PUNCTUATION = /[\s().-]/g;
const E164 = /^\+\d+$/;

/**
 * A phone number in the one shape it is stored in, or `""` for anything that
 * is not a number TFC could dial.
 *
 * Normalising is what makes {@link SignUpDetails.phone} unique in any useful
 * sense, and uniqueness is the whole of "one account per person" (ADR-0018).
 * An index over whatever a fan happened to type would hold `+995 555 123456`
 * beside `+995555123456` and call them two people, so every spelling of one
 * number has to arrive here and leave as one string.
 *
 * Three things happen, in order:
 *
 * - The punctuation people separate digits with is thrown away. A `+` anywhere
 *   but the front survives this and is then refused, because it is not
 *   punctuation to tidy away — it is a number nobody can dial.
 * - A leading `00` becomes `+`. It is the same number written the way much of
 *   Europe writes it, and leaving the two forms apart is the easiest second
 *   account anybody could open.
 * - What is left must be E.164: a `+`, then a country code and a national
 *   number. **A number without one is refused rather than guessed at**, because
 *   `555123456` is a Georgian number to a Georgian and a Dutch one to somebody
 *   in Amsterdam. Guessing files two people under one row; accepting it as
 *   typed files one person under two, which is the failure this whole function
 *   exists to prevent.
 *
 * Idempotent, because the stored form is fed back through it: the database
 * hook in `server/utils/auth.ts` normalises whatever reaches it, including a
 * value this function has already answered with.
 */
export function normalisePhone(text: string): string {
  const stripped = text.trim().replace(PHONE_PUNCTUATION, "");
  const dialled = stripped.startsWith("00") ? `+${stripped.slice(2)}` : stripped;

  if (!E164.test(dialled)) return "";

  const digits = dialled.length - 1;

  return digits >= PHONE_DIGITS.minimum && digits <= PHONE_DIGITS.maximum ? dialled : "";
}

/** What signing up asks a fan for. */
export interface SignUpDetails {
  /** The only identifier TFC ever shows publicly. */
  username: string;
  email: string;
  password: string;
  /**
   * Private, and unique across accounts: it is the whole of "one account per
   * person" (ADR-0018). Always E.164 — {@link normalisePhone} is what puts it
   * in that shape, and refuses everything it cannot.
   */
  phone: string;
}

export type SignUpField = keyof SignUpDetails;

/** One thing wrong with an answer, addressed to the fan who gave it. */
export interface SignUpProblem {
  field: SignUpField;
  message: string;
}

/**
 * Everything sign-up says to a fan when it turns them away.
 *
 * Kept together and exported so the server sends the same sentence the form
 * would have shown, and so `test/unit/sign-up.test.ts` can hold all of it to
 * the naming rule in `CONTEXT.md` at once.
 */
export const SIGN_UP_MESSAGES = {
  username:
    `Pick a username of ${USERNAME_LENGTH.minimum} to ${USERNAME_LENGTH.maximum} characters, ` +
    "using letters, numbers, hyphens or underscores.",
  usernameTaken: "That username is taken. Pick another one — it is the name other fans will see.",
  email: "Enter an email address, so TFC can reach you about your account.",
  emailTaken: "That email address already has an account. Sign in instead.",
  password: `Choose a password of at least ${MINIMUM_PASSWORD_LENGTH} characters.`,
  phone:
    "Enter a phone number TFC can reach you on, starting with its country code — " +
    "+995 555 12 34 56, or 00995 555 12 34 56. It stays private, and other fans never see it.",
  phoneTaken:
    "That phone number already has an account. TFC Predictions is played on one account " +
    "per person — sign in to the one you have.",
} as const satisfies Record<string, string>;

/** A complete answer, or every reason it is not one. */
export type ParsedSignUp =
  | { details: SignUpDetails; problems?: undefined }
  | { details?: undefined; problems: SignUpProblem[] };

const USERNAME = new RegExp(
  `^[A-Za-z0-9_-]{${USERNAME_LENGTH.minimum},${USERNAME_LENGTH.maximum}}$`,
);

/**
 * Reads a sign-up form into the details an account is created from, or into
 * every reason it cannot be.
 *
 * Every problem is reported, not just the first, so a fan fixes the form once
 * rather than being turned away a field at a time.
 *
 * Uniqueness is not decided here: whether a username, an email address or a
 * phone number is already someone else's is a question only the database can
 * answer, and it is asked again when the account is created.
 */
export function parseSignUpDetails(body: unknown): ParsedSignUp {
  const answers = asAnswers(body);
  const problems: SignUpProblem[] = [];

  const username = text(answers.username);
  const email = text(answers.email).toLowerCase();
  const password = typeof answers.password === "string" ? answers.password : "";
  const phone = normalisePhone(text(answers.phone));

  const complain = (field: SignUpField, message: string) => problems.push({ field, message });

  if (!USERNAME.test(username)) complain("username", SIGN_UP_MESSAGES.username);
  if (!looksLikeEmail(email)) complain("email", SIGN_UP_MESSAGES.email);
  if (password.length < MINIMUM_PASSWORD_LENGTH) complain("password", SIGN_UP_MESSAGES.password);
  // `normalisePhone` answers `""` for everything it will not store, so this is
  // the only phone check there is — see the note on it for what it refuses.
  if (phone === "") complain("phone", SIGN_UP_MESSAGES.phone);

  if (problems.length > 0) return { problems };

  return { details: { username, email, password, phone } };
}

function asAnswers(body: unknown): Record<string, unknown> {
  return typeof body === "object" && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
