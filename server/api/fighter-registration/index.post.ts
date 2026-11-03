import { parseRegistration, REGISTRATION_MESSAGES } from "#shared/fighterRegistration";

/**
 * Registers a fighter: one row on their discipline's sheet, linking the files
 * they have already uploaded through `./uploads.post.ts`.
 *
 * A rejection is a 422 whose body is `{ problems }`, one per question to go
 * back to, in the shape the sign-up form reads its problems in.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  // A field no person can see, so only something filling in every field it
  // finds fills it in. Answered as if it worked, so it learns nothing.
  if (typeof body?.website === "string" && body.website !== "") return { registered: true };

  const parsed = parseRegistration(body);

  if (parsed.problems) {
    setResponseStatus(event, 422);

    return { problems: parsed.problems };
  }

  const sheets = useRegistrationSheets();

  if (!sheets) {
    throw createError({ statusCode: 503, message: REGISTRATION_MESSAGES.unavailable });
  }

  try {
    await sheets.register(parsed.registration);
  } catch (error) {
    console.error("[fighter-registration] could not register", error);

    throw createError({ statusCode: 502, message: REGISTRATION_MESSAGES.failed });
  }

  return { registered: true };
});
