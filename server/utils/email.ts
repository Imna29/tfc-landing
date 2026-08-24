/**
 * Transactional email: how a message leaves TFC, how a route finds out whether
 * it did, and what it tells a fan when it did not.
 *
 * What the messages *say* lives in `shared/emails.ts`, where the vocabulary
 * guard can read it; which message is sent when is `server/utils/auth.ts`,
 * where `better-auth` asks for one.
 *
 * There is no queue and no retry. ADR-0009 rules out a second managed service
 * for v1, and a retry loop inside a request would hold a serverless function
 * open waiting on somebody else's outage. A message that cannot be handed over
 * is reported to the fan, who retries by asking again — which is why every
 * acceptance path in #5 ends in a button rather than in hope.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { EMAIL_MESSAGES, type EmailMessage } from "#shared/emails";

/** One message, addressed. */
export interface Email extends EmailMessage {
  to: string;
}

export interface Mailer {
  /** Hands one message over, or throws saying why it could not. */
  send(email: Email): Promise<void>;
}

/** The part of the environment this module reads, and no more of it. */
export type MailerEnvironment = Partial<
  Record<"RESEND_API_KEY" | "RESEND_BASE_URL" | "EMAIL_FROM" | "BETTER_AUTH_URL", string>
>;

/** Where Resend's API lives, unless the environment says otherwise. */
const RESEND_API_URL = "https://api.resend.com";

/** How long to wait for Resend before giving up on a message. */
const SEND_TIMEOUT_MS = 10_000;

let mailer: Mailer | undefined;

/** The application's mailer, created once per process and reused. */
export function useMailer(): Mailer {
  // Named one at a time rather than handed `process.env` wholesale, so this
  // list is the whole of what email reads from the environment.
  mailer ??= chooseMailer({
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_BASE_URL: process.env.RESEND_BASE_URL,
    EMAIL_FROM: process.env.EMAIL_FROM,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  });

  return mailer;
}

/**
 * The mailer an environment asks for.
 *
 * `RESEND_API_KEY` is the whole switch. Without it messages are written to the
 * log, so that anyone can follow a verification link on a machine where nobody
 * has verified a sending domain — which is the reason #5 was split out of the
 * accounts ticket in the first place.
 *
 * With it, two more variables become mandatory rather than optional, because
 * real sending is the moment they start mattering: `EMAIL_FROM`, since Resend
 * refuses a sender on a domain it has not verified, and `BETTER_AUTH_URL`,
 * since without it every link in the message points at a development server.
 * There is deliberately no `NODE_ENV` here: `nuxt build` settles that at build
 * time, so a built server reads "production" whoever is running it — the test
 * suite included — and it cannot tell a deployment from anything else. See
 * `server/db/client.ts`, which says the same about the connection pool.
 */
export function chooseMailer(environment: MailerEnvironment): Mailer {
  const apiKey = environment.RESEND_API_KEY;

  if (!apiKey) return createLoggingMailer();

  const from = required(
    environment.EMAIL_FROM,
    "EMAIL_FROM is not set. Resend only accepts a sender on a domain it has " +
      "verified, so there is no address this can be defaulted to.",
  );

  required(
    environment.BETTER_AUTH_URL,
    "BETTER_AUTH_URL is not set. Every link TFC emails is built from it, and an " +
      "email is read somewhere that has no request to take an origin from — so " +
      "sending for real without it would send fans links to a development server.",
  );

  return createResendMailer({
    apiKey,
    from,
    baseUrl: environment.RESEND_BASE_URL ?? RESEND_API_URL,
  });
}

function required(value: string | undefined, complaint: string): string {
  if (!value) throw new Error(`${complaint} See the Email section of README.md.`);

  return value;
}

export interface ResendSettings {
  apiKey: string;
  /** The verified sender, as `Name <address>`. */
  from: string;
  /**
   * Where to reach Resend.
   *
   * Configurable so the test suite can stand its own Resend in front of the
   * app and exercise this transport rather than a mock of it. Nothing in
   * production should set it.
   */
  baseUrl: string;
}

/** A mailer that hands messages to Resend over its HTTP API. */
export function createResendMailer({ apiKey, from, baseUrl }: ResendSettings): Mailer {
  const endpoint = `${baseUrl.replace(/\/+$/, "")}/emails`;

  return {
    async send(email) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          from,
          to: email.to,
          subject: email.subject,
          text: email.text,
          html: email.html,
        }),
        // Without this a mail provider that accepts the connection and then
        // stops talking holds the fan's request open until the platform kills
        // it, which reads to them as a page that never loads.
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });

      if (!response.ok) {
        // Deliberately assembled from the status and Resend's own message
        // only: the request carried the API key, and an error that echoed the
        // request would put it in the log.
        throw new Error(
          `Resend refused the message (${response.status}): ${await explain(response)}`,
        );
      }
    },
  };
}

/**
 * A mailer that writes messages to the log instead of sending them.
 *
 * The link is written out in full, because following it is how anyone works on
 * verification or password reset without a verified sending domain.
 */
export function createLoggingMailer(): Mailer {
  return {
    async send(email) {
      console.info(
        `[email] not sent, no RESEND_API_KEY → ${email.to}: ${email.subject}\n${email.text}`,
      );
    },
  };
}

/**
 * Sends one message, remembering a refusal for whoever is
 * {@link sendingEmail} around this.
 */
export async function sendEmail(email: Email): Promise<void> {
  try {
    await useMailer().send(email);
  } catch (error) {
    inFlight.getStore()?.refuse();
    console.error(`[email] could not send "${email.subject}" to ${email.to}`, error);
    throw error;
  }
}

/** What `work` returned, and whether the email it sent actually left. */
export interface Sent<Result> {
  /** What `work` answered, absent only when it failed *because* the email did. */
  result?: Result;
  /**
   * False only when a message was composed and the transport refused it. Work
   * that sent nothing has nothing to report, and says so.
   */
  sent: boolean;
}

interface Attempt {
  refuse(): void;
  refused: boolean;
}

const inFlight = new AsyncLocalStorage<Attempt>();

/**
 * Runs `work`, and reports whether every email it tried to send actually left.
 *
 * This exists because `better-auth` sends transactional email through a
 * callback and then swallows what that callback throws: a message it could not
 * hand over is written to its own logger, and the caller is answered with
 * success. That is exactly the silent success #5 rules out, and there is no
 * return value to read it from — so {@link sendEmail} records every refusal
 * here instead, where the route that started the work can see it.
 *
 * `better-auth` is not consistent about which of its paths swallow, so both
 * shapes are handled here rather than at each call site: work that failed
 * *because* the message did answers `sent: false` with nothing to return, and
 * work that failed for any other reason is rethrown, because that is a failure
 * the caller still has to deal with.
 */
export async function sendingEmail<Result>(work: () => Promise<Result>): Promise<Sent<Result>> {
  const attempt: Attempt = {
    refused: false,
    refuse() {
      attempt.refused = true;
    },
  };

  try {
    return { result: await inFlight.run(attempt, work), sent: !attempt.refused };
  } catch (error) {
    if (!attempt.refused) throw error;

    return { sent: false };
  }
}

/**
 * The refusal every route hands a fan when a message could not be sent, as
 * `createError` wants it.
 *
 * A 502 rather than a 500, because nothing here is broken: somebody else's
 * mail server said no, and what the fan does about it is ask again. Data
 * rather than a function that builds the error, because `createError` is one
 * of Nitro's globals and this module is also imported straight into
 * `test/unit/mailer.test.ts`, which boots no Nitro to have them.
 */
export const EMAIL_NOT_SENT = {
  statusCode: 502,
  statusMessage: "That email did not go out",
  message: EMAIL_MESSAGES.notSent,
} as const;

/** Resend's own account of a refusal, or the status text if it gave none. */
async function explain(response: Response): Promise<string> {
  const body = await response.text().catch(() => "");

  try {
    const parsed = JSON.parse(body) as { message?: string };

    if (typeof parsed.message === "string") return parsed.message;
  } catch {
    // Not JSON. Fall through to whatever it did send.
  }

  return body || response.statusText;
}
