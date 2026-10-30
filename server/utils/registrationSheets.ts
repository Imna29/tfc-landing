/**
 * The fighter registration sheets, as the server reaches them: through the
 * Apps Script in `apps-script/fighter-registration/`, deployed as a web app on
 * the Google account that owns the sheets.
 *
 * That script is the only thing holding Google credentials. This side holds a
 * URL and a shared secret, and nothing else — so nothing here can read a
 * sheet, only add a row to one, and only through the two things the script
 * offers.
 *
 * Unset, registration is closed rather than faked: the routes answer 503, and
 * the page says to message TFC instead. There is no logging stand-in the way
 * `server/utils/email.ts` has one, because a registration written to a log
 * nobody reads is a fighter who thinks they applied.
 */
import type { Registration, UploadRequest } from "#shared/fighterRegistration";

export interface RegistrationSheets {
  /** Opens a Drive upload for one file and answers with where the browser sends it. */
  startUpload(request: UploadRequest & { origin: string }): Promise<{ uploadUrl: string }>;
  /** Writes one registration as a row of its discipline's sheet. */
  register(registration: Registration): Promise<void>;
}

/** The part of the environment this module reads, and no more of it. */
export type RegistrationSheetsEnvironment = Partial<
  Record<"FIGHTER_REGISTRATION_SCRIPT_URL" | "FIGHTER_REGISTRATION_SECRET", string>
>;

/**
 * How long to wait for the script. Apps Script is slow to start when nobody
 * has called it for a while, and opening a Drive folder the first time is
 * slower still.
 */
const SCRIPT_TIMEOUT_MS = 25_000;

/** The sheets this deployment writes to, or `null` when it has not been told where they are. */
export function useRegistrationSheets(): RegistrationSheets | null {
  return chooseRegistrationSheets({
    FIGHTER_REGISTRATION_SCRIPT_URL: process.env.FIGHTER_REGISTRATION_SCRIPT_URL,
    FIGHTER_REGISTRATION_SECRET: process.env.FIGHTER_REGISTRATION_SECRET,
  });
}

export function chooseRegistrationSheets(
  environment: RegistrationSheetsEnvironment,
): RegistrationSheets | null {
  const url = environment.FIGHTER_REGISTRATION_SCRIPT_URL;
  const secret = environment.FIGHTER_REGISTRATION_SECRET;

  if (!url || !secret) return null;

  /**
   * One call to the script.
   *
   * A web app cannot choose its status code, so the script always answers
   * 200 and says in the body whether it did what it was asked.
   */
  async function call<Answer>(action: string, body: object): Promise<Answer> {
    // The script answers with a redirect to where its output is waiting,
    // which `fetch` follows as a GET — the way Apps Script expects.
    const response = await fetch(url!, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, action, secret }),
      signal: AbortSignal.timeout(SCRIPT_TIMEOUT_MS),
    });
    const reply = (await response.json().catch(() => null)) as
      | ({ ok?: boolean; error?: string } & Answer)
      | null;

    if (!reply?.ok) {
      throw new Error(
        `The registration script refused ${action} (${response.status}): ${reply?.error}`,
      );
    }

    return reply;
  }

  return {
    async startUpload(request) {
      const { uploadUrl } = await call<{ uploadUrl?: string }>("startUpload", request);

      if (!uploadUrl) throw new Error("The registration script opened an upload with no URL.");

      return { uploadUrl };
    },

    async register(registration) {
      await call("register", registration);
    },
  };
}
