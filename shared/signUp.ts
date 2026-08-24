/**
 * What signing up asks for, and what makes an answer acceptable.
 *
 * Shared between the server route that enforces these rules and the form that
 * collects the answers, so a fan reads the same sentence the server would have
 * sent them, before they submit.
 *
 * The rules that decide whether an account may exist at all — the 18+ gate,
 * and the uniqueness of a username — are enforced on the server. What lives
 * here is the arithmetic and the wording they are enforced with.
 */
import { looksLikeEmail } from "./emails";

/** The age a fan must have reached to take part. See ADR-0007. */
export const MINIMUM_AGE = 18;

/** A date with no time and no zone, `YYYY-MM-DD`, as a `date` column holds it. */
export type CalendarDate = string;

type DateParts = [year: number, month: number, day: number];

const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * A calendar date's parts, or `undefined` if the text is not one.
 *
 * Deliberately not `new Date(text)`: that reads `2026-02-30` as the second of
 * March and `2026-08-24` as midnight UTC, which is the day before in Tbilisi.
 * A date of birth that shifts by a day near a birthday is an eligibility bug.
 */
export function parseCalendarDate(text: string): DateParts | undefined {
  const match = CALENDAR_DATE.exec(text.trim());

  if (!match) return undefined;

  const parts = [Number(match[1]), Number(match[2]), Number(match[3])] as DateParts;
  const [year, month, day] = parts;

  if (month < 1 || month > 12) return undefined;
  if (day < 1 || day > daysInMonth(year, month)) return undefined;

  return parts;
}

function daysInMonth(year: number, month: number): number {
  const lengths = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return lengths[month - 1] ?? 0;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/** Negative if `one` falls before `other`, zero on the same day, positive after. */
function compare(one: DateParts, other: DateParts): number {
  for (let index = 0; index < 3; index += 1) {
    const difference = (one[index] ?? 0) - (other[index] ?? 0);

    if (difference !== 0) return difference;
  }

  return 0;
}

/**
 * Whether someone born on `dateOfBirth` has reached {@link MINIMUM_AGE} by
 * `on`. Both dates are `YYYY-MM-DD`; text that is not a date is not old enough.
 *
 * There is deliberately no `ageOf()` beside this. ADR-0007 stores a date of
 * birth precisely because an age integer is wrong the day after a birthday,
 * and an exported one is an invitation to write that integer down.
 *
 * A fan born on the 29th of February turns eighteen on the 1st of March in a
 * year that has no 29th: the comparison is on the parts of the date, so the
 * missing day sorts before the 1st rather than becoming some other date.
 */
export function isOldEnoughOn(dateOfBirth: CalendarDate, on: CalendarDate): boolean {
  const born = parseCalendarDate(dateOfBirth);
  const today = parseCalendarDate(on);

  if (!born || !today) return false;

  const [year, month, day] = born;

  return compare(today, [year + MINIMUM_AGE, month, day]) >= 0;
}

/** Whether a date has not happened yet on `on`. Both are `YYYY-MM-DD`. */
export function isAfter(date: CalendarDate, on: CalendarDate): boolean {
  const one = parseCalendarDate(date);
  const other = parseCalendarDate(on);

  return one !== undefined && other !== undefined && compare(one, other) > 0;
}

/** The shortest password `better-auth` is configured to accept. */
export const MINIMUM_PASSWORD_LENGTH = 8;

/** How long a username may be, in characters. */
export const USERNAME_LENGTH = { minimum: 3, maximum: 20 } as const;

/** Where TFC is, and therefore which day the 18+ gate is measured against. */
export const CONTEST_TIME_ZONE = "Asia/Tbilisi";

const GEORGIAN_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: CONTEST_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * The date it is in Georgia at `instant`, which is the date the 18+ gate is
 * measured against.
 *
 * Not `toISOString().slice(0, 10)`: Tbilisi is four hours ahead of UTC, so
 * between midnight and 04:00 local time that answers with yesterday — and a
 * fan signing up in the small hours of their eighteenth birthday would be
 * turned away.
 */
export function contestDateOn(instant: Date): CalendarDate {
  return GEORGIAN_DAY.format(instant);
}

/** What signing up asks a fan for. */
export interface SignUpDetails {
  /** The only identifier TFC ever shows publicly. */
  username: string;
  email: string;
  password: string;
  /** Private. Held only so a Prize can be matched to a person (ADR-0007). */
  firstName: string;
  /** Private, for the same reason as {@link SignUpDetails.firstName}. */
  lastName: string;
  /** Stored as a date, never as an age. See ADR-0007 and {@link isOldEnoughOn}. */
  dateOfBirth: CalendarDate;
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
  email: "Enter an email address, so TFC can confirm your account.",
  emailTaken: "That email address already has an account. Sign in instead.",
  password: `Choose a password of at least ${MINIMUM_PASSWORD_LENGTH} characters.`,
  firstName: "Enter your first name. It stays private, and is only used to send you a Prize.",
  lastName: "Enter your last name. It stays private, and is only used to send you a Prize.",
  dateOfBirth: "Enter your date of birth as a real date.",
  dateOfBirthInFuture: "That date has not happened yet. Enter the date you were born.",
  underAge: `You have to be ${MINIMUM_AGE} or over to take part in TFC Predictions.`,
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
 * rather than being turned away a field at a time. `today` is passed in
 * because the 18+ gate is arithmetic on a date the caller knows and this
 * function should not go looking for — see {@link contestDateOn}.
 *
 * Uniqueness is not decided here: whether a username or an email is already
 * someone else's is a question only the database can answer, and it is asked
 * again when the account is created.
 */
export function parseSignUpDetails(body: unknown, today: CalendarDate): ParsedSignUp {
  const answers = asAnswers(body);
  const problems: SignUpProblem[] = [];

  const username = text(answers.username);
  const email = text(answers.email).toLowerCase();
  const password = typeof answers.password === "string" ? answers.password : "";
  const firstName = text(answers.firstName);
  const lastName = text(answers.lastName);
  const dateOfBirth = text(answers.dateOfBirth);

  const complain = (field: SignUpField, message: string) => problems.push({ field, message });

  if (!USERNAME.test(username)) complain("username", SIGN_UP_MESSAGES.username);
  if (!looksLikeEmail(email)) complain("email", SIGN_UP_MESSAGES.email);
  if (password.length < MINIMUM_PASSWORD_LENGTH) complain("password", SIGN_UP_MESSAGES.password);
  if (firstName === "") complain("firstName", SIGN_UP_MESSAGES.firstName);
  if (lastName === "") complain("lastName", SIGN_UP_MESSAGES.lastName);

  if (!parseCalendarDate(dateOfBirth)) {
    complain("dateOfBirth", SIGN_UP_MESSAGES.dateOfBirth);
  } else if (isAfter(dateOfBirth, today)) {
    // Not "you are too young": a date in the future is a typo, and being told
    // to come back when you are eighteen would not help anyone fix it.
    complain("dateOfBirth", SIGN_UP_MESSAGES.dateOfBirthInFuture);
  } else if (!isOldEnoughOn(dateOfBirth, today)) {
    complain("dateOfBirth", SIGN_UP_MESSAGES.underAge);
  }

  if (problems.length > 0) return { problems };

  return { details: { username, email, password, firstName, lastName, dateOfBirth } };
}

function asAnswers(body: unknown): Record<string, unknown> {
  return typeof body === "object" && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
