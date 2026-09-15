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
 * A Georgian mobile number as a Georgian writes it: nine digits beginning with
 * a 5, and nothing in front of them.
 *
 * Every mobile number in Georgia has this shape, which is what makes it a shape
 * {@link normalisePhone} can read a country code off without being told one.
 */
const GEORGIAN_MOBILE = /^5\d{8}$/;

/** What a number matching {@link GEORGIAN_MOBILE} is dialled with. */
const GEORGIA_DIALLING_CODE = "+995";

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
 * - A country code is put in front of a number that arrived without one. A
 *   leading `00` becomes `+`, because that is the same number written the way
 *   much of Europe writes it; and a bare nine digits from a 5 becomes `+995`,
 *   because that is a Georgian mobile number. Both are spellings of a number
 *   the database may already hold in its E.164 form, and leaving either apart
 *   from it is the easiest second account anybody could open.
 * - What is left must be E.164: a `+`, then a country code and a national
 *   number. **Any other number with no country code is refused rather than
 *   guessed at**, because eight local digits are one person's number in one
 *   country and somebody else's in the next. Guessing files two people under
 *   one row; accepting it as typed files one person under two, which is the
 *   failure this whole function exists to prevent.
 *
 * Reading `+995` off nine digits is itself a guess, and worth naming as one: a
 * fan abroad whose national number happens to take that shape is filed as
 * Georgian. It is the guess this game can afford. It is played in Georgia, so
 * the shape means what it looks like for almost everyone who types it — and for
 * the fan it is wrong about, it is still *one* string rather than two. A wrong
 * country code costs a number TFC cannot reach them on, which they find out and
 * fix; two spellings of a right one cost the account rule itself, silently.
 *
 * Idempotent, because the stored form is fed back through it: the database
 * hook in `server/utils/auth.ts` normalises whatever reaches it, including a
 * value this function has already answered with.
 */
export function normalisePhone(text: string): string {
  const stripped = text.trim().replace(PHONE_PUNCTUATION, "");
  const dialled = withCountryCode(stripped);

  if (!E164.test(dialled)) return "";

  const digits = dialled.length - 1;

  return digits >= PHONE_DIGITS.minimum && digits <= PHONE_DIGITS.maximum ? dialled : "";
}

/**
 * The two ways a number reaches {@link normalisePhone} without a `+` and still
 * says which country it is in, rewritten as the one way that is stored.
 *
 * Anything else is handed back as it came, for E.164 to refuse.
 */
function withCountryCode(stripped: string): string {
  if (stripped.startsWith("00")) return `+${stripped.slice(2)}`;
  if (GEORGIAN_MOBILE.test(stripped)) return `${GEORGIA_DIALLING_CODE}${stripped}`;

  return stripped;
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
    "Enter a phone number TFC can reach you on: a Georgian mobile number like 555 12 34 56, " +
    "or any other number with its country code, like +44 7700 900123. " +
    "It stays private, and other fans never see it.",
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
