/**
 * The Fighter Registration page's way into Google Sheets and Google Drive.
 *
 * Fighter registrations used to be three Google Forms, each writing a row to
 * its own response sheet and putting uploads in the form owner's Drive. The
 * forms moved onto tfcgeo.com (`/fighter-registration`), and the sheets stayed
 * where they were, because they are where the matchmakers read registrations.
 * This script is what the site writes to them through.
 *
 * It runs as the account that deployed it — datatsurtsumia5@gmail.com — and
 * uses that account's Drive storage, which is why it is an Apps Script rather
 * than a service account: a service account has no storage of its own outside
 * a paid Workspace shared drive, and cannot upload into a personal Drive.
 *
 * Deployed as a web app that executes as its owner and that anyone may call,
 * so every request has to carry `SHARED_SECRET` (Script properties). Only the
 * site's server knows it; a browser never talks to this script.
 *
 * Two actions:
 *
 * - `startUpload` opens a resumable Drive upload into the registration's
 *   folder and answers with its URL. The browser sends the file there itself,
 *   which is how a 1 GB highlight reel reaches Drive without passing through a
 *   Vercel Function, whose request bodies stop at 4.5 MB.
 * - `register` writes one registration as one row of the right sheet, linking
 *   the files it uploaded, the way the forms did.
 *
 * The source of truth is `apps-script/fighter-registration/` in tfc-landing.
 * Editing it in the Apps Script editor and not there is how the two drift.
 */

/** Where each discipline's registrations are written: the forms' own response sheets. */
const REGISTRATIONS = {
  mma: {
    spreadsheetId: "1Tu77UhL6Wq4TWATBw-fPmnWY_xS6aZr4KMCH8zDIe_o",
    sheetId: 1433021093,
    folder: "MMA",
  },
  cagebox: {
    spreadsheetId: "1yLsn0w9FVtUfpQ2SqVQhiKkZFXuw0kH4bNPUf1hznUQ",
    sheetId: 186845732,
    folder: "CageBox",
  },
  cage_grappling: {
    spreadsheetId: "1sktNcWaDyhNYgFxfVQLaEW3YM6_2YsBgwvXHYorKlMs",
    sheetId: 366667468,
    folder: "Cage Grappling",
  },
};

/** The two things a fighter uploads, and the largest file each accepts — the forms' own limits. */
const UPLOADS = {
  highlights: { folder: "Highlights", maxBytes: 1024 * 1024 * 1024 },
  photo: { folder: "Photo", maxBytes: 100 * 1024 * 1024 },
};

/** The folder in this account's My Drive that every upload from the site lands under. */
const UPLOADS_ROOT = "TFC Fighter Registration (website uploads)";

function doPost(e) {
  try {
    const request = JSON.parse(e.postData.contents);

    if (!secretMatches(request.secret)) return reply({ ok: false, error: "Not authorised." });

    if (request.action === "startUpload") return reply({ ok: true, ...startUpload(request) });
    if (request.action === "register") return reply({ ok: true, ...register(request) });
    if (request.action === "describe") return reply({ ok: true, ...describe() });

    return reply({ ok: false, error: `Unknown action "${request.action}".` });
  } catch (error) {
    return reply({ ok: false, error: String((error && error.message) || error) });
  }
}

/**
 * Opens a resumable upload into the discipline's folder for this upload.
 *
 * `origin` is the page the browser will upload from: Drive only answers a
 * browser's upload with CORS headers for the origin the session was opened
 * for.
 */
function startUpload({ discipline, upload, name, mimeType, size, origin }) {
  const limits = UPLOADS[upload];

  if (!limits) throw new Error(`Unknown upload "${upload}".`);
  if (!(size > 0 && size <= limits.maxBytes))
    throw new Error(`A ${upload} file of ${size} bytes is not accepted.`);

  const folder = uploadFolder(discipline, upload);
  const response = UrlFetchApp.fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id",
    {
      method: "post",
      contentType: "application/json; charset=UTF-8",
      headers: {
        Authorization: `Bearer ${ScriptApp.getOAuthToken()}`,
        "X-Upload-Content-Type": mimeType || "application/octet-stream",
        "X-Upload-Content-Length": String(size),
        Origin: origin,
      },
      payload: JSON.stringify({ name: String(name).slice(0, 200), parents: [folder.getId()] }),
      muteHttpExceptions: true,
    },
  );

  if (response.getResponseCode() !== 200) {
    throw new Error(
      `Drive refused the upload (${response.getResponseCode()}): ${response.getContentText()}`,
    );
  }

  const headers = response.getHeaders();

  return { uploadUrl: headers.Location || headers.location };
}

/**
 * Writes one registration as a row of its discipline's sheet.
 *
 * Columns are found by their header rather than by position, because the
 * sheets are the forms' and the forms decided their order — and somebody
 * reading them may have added columns of their own. A question no column is
 * headed for gets a new column at the end, so nothing a fighter answered is
 * ever dropped.
 *
 * Every file must already be in the folder this script uploads that
 * discipline's files to. Anything else is refused, so a request cannot have a
 * link to some other file in this Drive written into a sheet.
 */
function register({ discipline, fullName, answers, files }) {
  const sheet = registrationSheet(discipline);
  const lock = LockService.getScriptLock();

  lock.waitLock(30000);

  try {
    const headers = sheet
      .getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1))
      .getValues()[0]
      .map(String);
    const row = headers.map(() => "");

    const put = (header, value) => {
      let column = headers.findIndex((existing) => sameHeader(existing, header));

      if (column === -1) {
        headers.push(header);
        row.push("");
        column = headers.length - 1;
        sheet.getRange(1, column + 1).setValue(header);
      }

      row[column] = value;
    };

    put("Timestamp", new Date());

    for (const answer of answers) {
      put(answer.header, answer.kind === "date" ? asDate(answer.value) : answer.value);
    }

    for (const upload of files) {
      const folder = uploadFolder(discipline, upload.upload);
      const links = upload.ids.map((id) => {
        const file = DriveApp.getFileById(id);

        if (!isIn(file, folder))
          throw new Error(`File ${id} was not uploaded for this registration.`);

        file.setName(`${file.getName()} - ${fullName}`);

        return `https://drive.google.com/open?id=${id}`;
      });

      if (links.length > 0) put(upload.header, links.join(", "));
    }

    sheet.appendRow(row);

    return { row: sheet.getLastRow() };
  } finally {
    lock.releaseLock();
  }
}

/** Every sheet's header row, for checking the site's questions against what the sheets hold. */
function describe() {
  const sheets = {};

  for (const discipline of Object.keys(REGISTRATIONS)) {
    const sheet = registrationSheet(discipline);

    sheets[discipline] = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  }

  return { sheets };
}

function registrationSheet(discipline) {
  const target = REGISTRATIONS[discipline];

  if (!target) throw new Error(`Unknown discipline "${discipline}".`);

  const sheet = SpreadsheetApp.openById(target.spreadsheetId)
    .getSheets()
    .find((candidate) => candidate.getSheetId() === target.sheetId);

  if (!sheet) throw new Error(`The ${discipline} response sheet is missing.`);

  return sheet;
}

/**
 * `UPLOADS_ROOT/<discipline>/<upload>`, created the first time it is needed.
 *
 * Folder ids are kept in Script properties once found, both because looking a
 * folder up by name is slow and because two uploads starting at once would
 * otherwise each create the folder the other was about to.
 */
function uploadFolder(discipline, upload) {
  const target = REGISTRATIONS[discipline];
  const limits = UPLOADS[upload];

  if (!target) throw new Error(`Unknown discipline "${discipline}".`);
  if (!limits) throw new Error(`Unknown upload "${upload}".`);

  const key = `folder:${discipline}:${upload}`;
  const properties = PropertiesService.getScriptProperties();
  const known = properties.getProperty(key);

  if (known) return DriveApp.getFolderById(known);

  const lock = LockService.getScriptLock();

  lock.waitLock(30000);

  try {
    const settled = properties.getProperty(key);

    if (settled) return DriveApp.getFolderById(settled);

    const root = childFolder(DriveApp.getRootFolder(), UPLOADS_ROOT);
    const folder = childFolder(childFolder(root, target.folder), limits.folder);

    properties.setProperty(key, folder.getId());

    return folder;
  } finally {
    lock.releaseLock();
  }
}

function childFolder(parent, name) {
  const existing = parent.getFoldersByName(name);

  return existing.hasNext() ? existing.next() : parent.createFolder(name);
}

function isIn(file, folder) {
  const parents = file.getParents();

  while (parents.hasNext()) {
    if (parents.next().getId() === folder.getId()) return true;
  }

  return false;
}

/** Headers compared the way a person reads them: the forms' titles carry stray spaces and line breaks. */
function sameHeader(a, b) {
  const normalise = (text) => String(text).replace(/\s+/g, " ").trim().toLowerCase();

  return normalise(a) === normalise(b);
}

/** `YYYY-MM-DD` as a date the sheet formats like the forms' own answers. */
function asDate(value) {
  const [year, month, day] = String(value).split("-").map(Number);

  return new Date(year, month - 1, day);
}

function secretMatches(secret) {
  const expected = PropertiesService.getScriptProperties().getProperty("SHARED_SECRET");

  return Boolean(expected) && secret === expected;
}

function reply(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
