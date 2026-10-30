import { parseUploadRequest, REGISTRATION_MESSAGES } from "#shared/fighterRegistration";

/**
 * Somewhere to send one file a fighter is registering with.
 *
 * Answers with a Drive upload URL the browser sends the file to itself. The
 * file never passes through here: a highlight reel can be a gigabyte, and a
 * Vercel Function stops reading a request at 4.5 MB.
 *
 * A file that is uploaded and then never registered stays in the uploads
 * folder, unlinked from any row. That is the price of uploading before
 * registering, which is the only order that works — the registration has to
 * name the files.
 */
export default defineEventHandler(async (event) => {
  const parsed = parseUploadRequest(await readBody(event));

  if (!parsed.request) {
    setResponseStatus(event, 422);

    return { problem: parsed.problem };
  }

  const sheets = useRegistrationSheets();

  if (!sheets) {
    throw createError({ statusCode: 503, message: REGISTRATION_MESSAGES.unavailable });
  }

  // The page the file is sent from. Drive only lets a browser upload to a
  // session opened for the browser's own origin.
  const origin = getRequestHeader(event, "origin") || getRequestURL(event).origin;

  try {
    return await sheets.startUpload({ ...parsed.request, origin });
  } catch (error) {
    console.error("[fighter-registration] could not open an upload", error);

    throw createError({ statusCode: 502, message: REGISTRATION_MESSAGES.failed });
  }
});
