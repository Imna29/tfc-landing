/**
 * What the Fighter Registration page asks, and what makes an answer acceptable.
 *
 * These were three Google Forms — MMA, CageBox and Cage Grappling — and their
 * response sheets are still where TFC's matchmakers read registrations. So each
 * question here carries the `header` of the sheet column its answer is written
 * under, which is the form question's own title, verbatim: stray spaces, line
 * breaks and Georgian included. `apps-script/fighter-registration/Code.gs`
 * matches columns by that text, loosely enough that the whitespace does not
 * matter, and adds a column for a header it cannot find rather than dropping
 * the answer.
 *
 * Shared between the page and the server for the reason `shared/signUp.ts` is:
 * the page runs the same checks before it uploads anything, because a fighter
 * who has just sent a 1 GB highlight reel should not then be told their phone
 * number was missing.
 */
import { looksLikeEmail } from "./emails";
import { DISCIPLINES, type Discipline } from "./fightCard";

/** How a question is answered, which decides the input the page shows for it. */
export type QuestionKind = "text" | "paragraph" | "email" | "tel" | "date" | "choices";

export type RegistrationField =
  | "fullName"
  | "email"
  | "dateOfBirth"
  | "fighterName"
  | "city"
  | "instagram"
  | "phone"
  | "physical"
  | "weightClass"
  | "experience"
  | "gym"
  | "record"
  | "otherExperience"
  | "fightingStyles"
  | "goal"
  | "referral";

export interface RegistrationQuestion {
  field: RegistrationField;
  label: string;
  /** The explanation the form carried under the question, Georgian included. */
  hint?: string;
  kind: QuestionKind;
  /** The sheet column the answer is written under. See the note at the top of this file. */
  header: string;
  /** For `choices`: the boxes to tick. Anything else a fighter types is written beside them. */
  choices?: readonly string[];
  autocomplete?: string;
}

/** The two things a fighter uploads. */
export type UploadName = "highlights" | "photo";

export interface RegistrationUpload {
  name: UploadName;
  label: string;
  hint: string;
  header: string;
  required: boolean;
  maxFiles: number;
  /** The forms' own limits, which `Code.gs` enforces again. */
  maxBytes: number;
  /** The kinds of file accepted, as an `accept` attribute and as MIME type prefixes. */
  accept: readonly string[];
}

export interface RegistrationForm {
  discipline: Discipline;
  title: string;
  questions: readonly RegistrationQuestion[];
  uploads: readonly RegistrationUpload[];
}

const MEGABYTE = 1024 * 1024;
const GIGABYTE = 1024 * MEGABYTE;

/** The longest answer accepted, in characters: a line, and a paragraph. */
export const ANSWER_LENGTH = { line: 500, paragraph: 5000 } as const;

const FULL_NAME: RegistrationQuestion = {
  field: "fullName",
  label: "Name and surname",
  kind: "text",
  header: "Name and Surname:",
  autocomplete: "name",
};

const EMAIL: RegistrationQuestion = {
  field: "email",
  label: "Email address",
  hint: "Where TFC's matchmakers can reach you.",
  kind: "email",
  header: "Email Address",
  autocomplete: "email",
};

const DATE_OF_BIRTH: RegistrationQuestion = {
  field: "dateOfBirth",
  label: "Date of birth",
  kind: "date",
  header: "Date of Birth: ",
  autocomplete: "bday",
};

const CITY: RegistrationQuestion = {
  field: "city",
  label: "Where are you from?",
  hint: "რომელი ქალაქიდან ხარ?",
  kind: "text",
  header: "Where are you from?",
  autocomplete: "address-level2",
};

const INSTAGRAM: RegistrationQuestion = {
  field: "instagram",
  label: "Instagram username",
  kind: "text",
  header: "Instagram username",
};

const PHONE: RegistrationQuestion = {
  field: "phone",
  label: "Phone number",
  kind: "tel",
  header: "Phone Number: ",
  autocomplete: "tel",
};

const PHYSICAL: RegistrationQuestion = {
  field: "physical",
  label: "Physical information",
  hint: "Height, and weight today (kg). სიმაღლე, რამდენს იწონი დღეს (კგ)",
  kind: "text",
  header: "Physical Information:",
};

const WEIGHT_CLASS: RegistrationQuestion = {
  field: "weightClass",
  label: "What weight class do you fight at?",
  hint: "რა წონაში გსურს ბრძოლა?",
  kind: "text",
  header: "What weight class do you fight?",
};

const GOAL: RegistrationQuestion = {
  field: "goal",
  label: "What is your goal in TFC?",
  kind: "text",
  header: "What is your goal in TFC? ",
};

const REFERRAL: RegistrationQuestion = {
  field: "referral",
  label: "How did you find out about TFC?",
  hint: "როგორ გაიგე TFC-ის შესახებ",
  kind: "text",
  header: "How did you find out about TFC?",
};

/** The forms' own wording for the striking disciplines, which share their uploads. */
const STRIKING_HIGHLIGHTS_HEADER = "Fight or training Highlights- ჩხუბის ან ვარჯიშის მომენტები";
const FIGHTER_PHOTO_HEADER =
  "Upload Fighter photo like below - ატვირთე მებრძოლის ფოტო როგორიც არის ქვემოთ მოცემული";

function highlights(header: string): RegistrationUpload {
  return {
    name: "highlights",
    label: "Fight or training highlights",
    hint:
      "Up to 5 videos or photos, 1 GB each. No highlights yet? Skip this. " +
      "თუ არ გაქვს ჩხუბის ან ვარჯიშის ვიდეო, გამოტოვე ეს კითხვა.",
    header,
    required: false,
    maxFiles: 5,
    maxBytes: GIGABYTE,
    accept: ["video/", "image/"],
  };
}

function photo(header: string, hint: string): RegistrationUpload {
  return {
    name: "photo",
    label: "Fighter photo",
    hint,
    header,
    required: true,
    maxFiles: 1,
    maxBytes: 100 * MEGABYTE,
    accept: ["image/"],
  };
}

const SHIRTLESS_PHOTO =
  "A full-length photo in good light, shirtless, like a fight-poster shot. Gloves are optional. " +
  "(ეცადე იყოს კარგი განათება და არაა აუცილებელი ხელთათმანები გეკეთოს) " +
  "სურათი ატვირთე მაისურის გარეშე!";

/** Each discipline's form, in the forms' own question order. */
export const REGISTRATION_FORMS: Record<Discipline, RegistrationForm> = {
  mma: {
    discipline: "mma",
    title: "TFC MMA Registration",
    questions: [
      FULL_NAME,
      EMAIL,
      DATE_OF_BIRTH,
      {
        field: "fighterName",
        label: "Fighter octagon name",
        kind: "text",
        header: "Fighter Octagon name",
      },
      CITY,
      INSTAGRAM,
      PHONE,
      PHYSICAL,
      WEIGHT_CLASS,
      {
        field: "experience",
        label: "Have you trained MMA or any other combat sports?",
        hint: "რა არის თქვენი გამოცდილება?",
        kind: "paragraph",
        header: "Have you trained MMA \nor any other combat sports? \nრა არის თქვენი გამოცდილება?",
      },
      {
        field: "gym",
        label: "What gym do you train at?",
        kind: "text",
        header: "What gym do you train at?",
      },
      {
        field: "record",
        label: "What's your MMA record?",
        kind: "text",
        header: "What's your MMA record? ",
      },
      {
        field: "fightingStyles",
        label: "Fighting style",
        hint: "Tick every one you fight in, and add any other.",
        kind: "choices",
        header: "Fighting style",
        choices: ["Boxing", "Kickboxing", "Wrestling", "Jiu-Jitsu", "Judo", "Karate", "Muay Thai"],
      },
      GOAL,
      REFERRAL,
    ],
    uploads: [highlights(STRIKING_HIGHLIGHTS_HEADER), photo(FIGHTER_PHOTO_HEADER, SHIRTLESS_PHOTO)],
  },
  cagebox: {
    discipline: "cagebox",
    title: "TFC Boxing Registration",
    questions: [
      FULL_NAME,
      EMAIL,
      DATE_OF_BIRTH,
      {
        field: "fighterName",
        label: "Fighter ring name",
        kind: "text",
        header: "Fighter Ring name",
      },
      CITY,
      INSTAGRAM,
      PHONE,
      PHYSICAL,
      WEIGHT_CLASS,
      {
        field: "experience",
        label: "Have you trained boxing or any other combat sports?",
        hint: "რა არის თქვენი გამოცდილება კრივში?",
        kind: "paragraph",
        header:
          "Have you trained Boxing\nor any other combat sports? \nრა არის თქვენი გამოცდილება კრივში?",
      },
      {
        field: "gym",
        label: "What gym do you train at?",
        hint: "რა დარბაზში ვარჯიშობ?",
        kind: "text",
        header: "What gym do you train at?\nრა დარბაზში ვარჯიშობ?",
      },
      {
        field: "record",
        label: "What's your boxing record?",
        kind: "text",
        header: "What's your boxing record? ",
      },
      GOAL,
      REFERRAL,
    ],
    uploads: [highlights(STRIKING_HIGHLIGHTS_HEADER), photo(FIGHTER_PHOTO_HEADER, SHIRTLESS_PHOTO)],
  },
  cage_grappling: {
    discipline: "cage_grappling",
    title: "TFC Cage Grappling",
    questions: [
      FULL_NAME,
      EMAIL,
      DATE_OF_BIRTH,
      {
        field: "fighterName",
        label: "Grappler nickname",
        kind: "text",
        header: "Grappler nickname",
      },
      CITY,
      INSTAGRAM,
      PHONE,
      PHYSICAL,
      {
        field: "experience",
        label: "Tell us about your experience in grappling (background)",
        hint: "მოგვიყევი შენი grappling-ის გამოცდილებაზე",
        kind: "paragraph",
        header: "Tell us about your experience in Grappling (background)",
      },
      {
        field: "gym",
        label: "What gym do you train at?",
        hint: "რომელ დარბაზში ვარჯიშობ?",
        kind: "text",
        header: "What gym do you train at?",
      },
      {
        field: "otherExperience",
        label: "Experience in other combat sports",
        hint: "სხვა საბრძოლო გამოცდილება",
        kind: "text",
        header: "experience in other combat sports",
      },
      GOAL,
      REFERRAL,
    ],
    uploads: [
      highlights("Grappling highlights or training videos"),
      photo(
        "Upload photo like below - ატვირთე ფოტო როგორიც არის ქვემოთ მოცემული",
        "A full-length photo of you in good light, like a fight-poster shot.",
      ),
    ],
  },
};

/** One thing wrong with a registration, addressed to the fighter, beside the question it is about. */
export interface RegistrationProblem {
  field: RegistrationField | UploadName | "discipline";
  message: string;
}

/**
 * Everything the page and the server say when they turn a registration away.
 *
 * Together so `test/unit/fighter-registration.test.ts` can hold all of it to
 * the naming rule in `CONTEXT.md` at once.
 */
export const REGISTRATION_MESSAGES = {
  discipline: "Pick MMA, CageBox or Cage Grappling.",
  required: "Answer this question.",
  email: "Enter an email address TFC can reach you at.",
  dateOfBirth: "Enter your date of birth.",
  choices: "Tick at least one.",
  tooLong: (limit: number) => `Keep this under ${limit} characters.`,
  photo: "Upload a photo of yourself.",
  tooManyFiles: (limit: number) => `Upload at most ${limit === 1 ? "one file" : `${limit} files`}.`,
  fileTooLarge: (name: string, limit: number) =>
    `${name} is too large: each file can be at most ${describeBytes(limit)}.`,
  fileType: (name: string, upload: RegistrationUpload) =>
    `${name} is not ${upload.name === "photo" ? "a photo" : "a video or a photo"}.`,
  failed:
    "Something went wrong on our side and your registration was not sent. Try again in a moment.",
  unavailable:
    "Registration is not open on this site right now. Message TFC on Instagram and we will help.",
} as const;

/** `1 GB`, `100 MB`: a byte limit the way the forms wrote it. */
export function describeBytes(bytes: number): string {
  return bytes >= GIGABYTE ? `${bytes / GIGABYTE} GB` : `${Math.round(bytes / MEGABYTE)} MB`;
}

/** The discipline a value names, or `null` for anything else. */
export function disciplineFrom(value: unknown): Discipline | null {
  return DISCIPLINES.find((discipline) => discipline === value) ?? null;
}

/** What a fighter typed or ticked: text for most questions, a list for `choices`. */
export type Answers = Partial<Record<RegistrationField, string | string[]>>;

/** One answer, ready for its column. */
export interface SheetAnswer {
  header: string;
  value: string;
  kind: QuestionKind;
}

/**
 * Every answer a form's questions accept, or every reason they are not
 * acceptable — all of them, so a fighter fixes the form once.
 */
export function parseAnswers(
  form: RegistrationForm,
  answers: unknown,
): { answers: SheetAnswer[]; problems: RegistrationProblem[] } {
  const given = asRecord(answers);
  const accepted: SheetAnswer[] = [];
  const problems: RegistrationProblem[] = [];

  for (const question of form.questions) {
    const value = answerTo(question, given[question.field]);

    if (typeof value === "object") {
      problems.push({ field: question.field, message: value.problem });
    } else {
      accepted.push({ header: question.header, value, kind: question.kind });
    }
  }

  return { answers: accepted, problems };
}

function answerTo(question: RegistrationQuestion, given: unknown): string | { problem: string } {
  if (question.kind === "choices") {
    const ticked = (Array.isArray(given) ? given : [])
      .filter((choice): choice is string => typeof choice === "string")
      .map((choice) => choice.trim())
      .filter((choice) => choice !== "");

    if (ticked.length === 0) return { problem: REGISTRATION_MESSAGES.choices };

    const value = [...new Set(ticked)].join(", ");

    return value.length > ANSWER_LENGTH.line
      ? { problem: REGISTRATION_MESSAGES.tooLong(ANSWER_LENGTH.line) }
      : value;
  }

  const value = typeof given === "string" ? given.trim() : "";
  const limit = question.kind === "paragraph" ? ANSWER_LENGTH.paragraph : ANSWER_LENGTH.line;

  if (value === "") {
    return {
      problem:
        question.kind === "date"
          ? REGISTRATION_MESSAGES.dateOfBirth
          : REGISTRATION_MESSAGES.required,
    };
  }

  if (value.length > limit) return { problem: REGISTRATION_MESSAGES.tooLong(limit) };
  if (question.kind === "email" && !looksLikeEmail(value)) {
    return { problem: REGISTRATION_MESSAGES.email };
  }
  if (question.kind === "date" && !isPastDate(value)) {
    return { problem: REGISTRATION_MESSAGES.dateOfBirth };
  }

  return value;
}

/** A `YYYY-MM-DD` that is a real day, after 1900 and before today. */
function isPastDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) return false;

  const [year, month, day] = match.slice(1).map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    year >= 1900 &&
    date.getTime() < Date.now()
  );
}

/** A file as the page knows it before it is uploaded. */
export interface ChosenFile {
  name: string;
  size: number;
  type: string;
}

/** Every problem with the files chosen for a form's uploads, before any of them is sent. */
export function checkFiles(
  form: RegistrationForm,
  chosen: Partial<Record<UploadName, readonly ChosenFile[]>>,
): RegistrationProblem[] {
  const problems: RegistrationProblem[] = [];

  for (const upload of form.uploads) {
    const files = chosen[upload.name] ?? [];
    const problem = (message: string) => problems.push({ field: upload.name, message });

    if (upload.required && files.length === 0) problem(REGISTRATION_MESSAGES.photo);
    if (files.length > upload.maxFiles)
      problem(REGISTRATION_MESSAGES.tooManyFiles(upload.maxFiles));

    for (const file of files) {
      const fileProblem = problemWithFile(upload, file);

      if (fileProblem) problem(fileProblem);
    }
  }

  return problems;
}

function problemWithFile(upload: RegistrationUpload, file: ChosenFile): string | undefined {
  if (!upload.accept.some((prefix) => file.type.startsWith(prefix))) {
    return REGISTRATION_MESSAGES.fileType(file.name, upload);
  }
  if (!(file.size > 0 && file.size <= upload.maxBytes)) {
    return REGISTRATION_MESSAGES.fileTooLarge(file.name, upload.maxBytes);
  }

  return undefined;
}

/** One file about to be uploaded, as the page asks the server for somewhere to send it. */
export interface UploadRequest {
  discipline: Discipline;
  upload: UploadName;
  name: string;
  mimeType: string;
  size: number;
}

/** A request for an upload, or why there will not be one. */
export function parseUploadRequest(
  body: unknown,
): { request: UploadRequest; problem?: undefined } | { request?: undefined; problem: string } {
  const given = asRecord(body);
  const discipline = disciplineFrom(given.discipline);

  if (!discipline) return { problem: REGISTRATION_MESSAGES.discipline };

  const upload = REGISTRATION_FORMS[discipline].uploads.find((each) => each.name === given.upload);

  if (!upload) return { problem: "There is no such upload on this form." };

  const file: ChosenFile = {
    name: typeof given.name === "string" ? given.name.trim().slice(0, 200) : "",
    size: typeof given.size === "number" ? given.size : 0,
    type: typeof given.mimeType === "string" ? given.mimeType : "",
  };
  const problem = file.name === "" ? "Every file needs a name." : problemWithFile(upload, file);

  if (problem) return { problem };

  return {
    request: {
      discipline,
      upload: upload.name,
      name: file.name,
      mimeType: file.type,
      size: file.size,
    },
  };
}

/** One registration, in the shape `Code.gs` writes as a row. */
export interface Registration {
  discipline: Discipline;
  /** What uploaded files are renamed after, the way the forms named them. */
  fullName: string;
  answers: SheetAnswer[];
  files: { upload: UploadName; header: string; ids: string[] }[];
}

/** What Drive calls a file: letters, digits, `-` and `_`. */
const DRIVE_FILE_ID = /^[\w-]{10,200}$/;

/**
 * A complete registration as the page submits it — its answers, and the ids
 * Drive gave the files it uploaded — or every reason it is not one.
 */
export function parseRegistration(
  body: unknown,
):
  | { registration: Registration; problems?: undefined }
  | { registration?: undefined; problems: RegistrationProblem[] } {
  const given = asRecord(body);
  const discipline = disciplineFrom(given.discipline);

  if (!discipline) {
    return { problems: [{ field: "discipline", message: REGISTRATION_MESSAGES.discipline }] };
  }

  const form = REGISTRATION_FORMS[discipline];
  const { answers, problems } = parseAnswers(form, given.answers);
  const uploaded = asRecord(given.files);
  const files: Registration["files"] = [];

  for (const upload of form.uploads) {
    const ids = Array.isArray(uploaded[upload.name]) ? (uploaded[upload.name] as unknown[]) : [];
    const valid = ids.filter(
      (id): id is string => typeof id === "string" && DRIVE_FILE_ID.test(id),
    );

    if (valid.length !== ids.length || valid.length > upload.maxFiles) {
      problems.push({
        field: upload.name,
        message: REGISTRATION_MESSAGES.tooManyFiles(upload.maxFiles),
      });
    } else if (upload.required && valid.length === 0) {
      problems.push({ field: upload.name, message: REGISTRATION_MESSAGES.photo });
    } else {
      files.push({ upload: upload.name, header: upload.header, ids: valid });
    }
  }

  if (problems.length > 0) return { problems };

  const fullName = answers.find((answer) => answer.header === FULL_NAME.header)?.value ?? "";

  return { registration: { discipline, fullName, answers, files } };
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
