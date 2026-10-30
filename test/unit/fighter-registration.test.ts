import { describe, expect, it } from "vitest";
import { DISCIPLINES } from "../../shared/fightCard";
import {
  ANSWER_LENGTH,
  checkFiles,
  parseAnswers,
  parseRegistration,
  parseUploadRequest,
  REGISTRATION_FORMS,
  REGISTRATION_MESSAGES,
  type Answers,
} from "../../shared/fighterRegistration";
import { findBannedTerms } from "../helpers/vocabulary";

/** A registration every form accepts: each question answered, a photo uploaded. */
function complete(overrides: Answers = {}): Answers {
  return {
    fullName: "Giorgi Beridze",
    email: "giorgi@example.com",
    dateOfBirth: "2001-04-17",
    fighterName: "The Wall",
    city: "Tbilisi",
    instagram: "giorgi.fights",
    phone: "555 12 34 56",
    physical: "180 cm, 77 kg",
    weightClass: "77 kg",
    experience: "Six years of boxing, two of wrestling.",
    gym: "Tbilisi Fight Club",
    record: "5-1-0",
    otherExperience: "Judo as a junior",
    fightingStyles: ["Boxing", "Wrestling"],
    goal: "A title",
    referral: "Instagram",
    ...overrides,
  };
}

const PHOTO_ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz";

describe("the registration forms", () => {
  it("has one for every discipline TFC books", () => {
    expect(Object.keys(REGISTRATION_FORMS).sort()).toEqual([...DISCIPLINES].sort());
  });

  it("asks each question once, under a column of its own", () => {
    // Two questions writing to one header would put one answer on top of the
    // other in the sheet.
    for (const form of Object.values(REGISTRATION_FORMS)) {
      const headers = [
        ...form.questions.map((question) => question.header),
        ...form.uploads.map((upload) => upload.header),
      ];

      expect(new Set(headers).size).toBe(headers.length);
      expect(new Set(form.questions.map((question) => question.field)).size).toBe(
        form.questions.length,
      );
    }
  });

  it("requires a photo and leaves highlights optional, as the forms did", () => {
    for (const form of Object.values(REGISTRATION_FORMS)) {
      const required = Object.fromEntries(form.uploads.map((u) => [u.name, u.required]));

      expect(required).toEqual({ highlights: false, photo: true });
    }
  });

  it("asks only MMA fighters for their fighting style", () => {
    const asked = DISCIPLINES.filter((discipline) =>
      REGISTRATION_FORMS[discipline].questions.some((q) => q.field === "fightingStyles"),
    );

    expect(asked).toEqual(["mma"]);
  });
});

describe("parseAnswers", () => {
  it("writes each answer under its question's header, trimmed", () => {
    const { answers, problems } = parseAnswers(
      REGISTRATION_FORMS.cagebox,
      complete({ fullName: "  Giorgi Beridze " }),
    );

    expect(problems).toEqual([]);
    expect(answers).toContainEqual({
      header: "Name and Surname:",
      value: "Giorgi Beridze",
      kind: "text",
    });
  });

  it("reports every unanswered question at once", () => {
    const { problems } = parseAnswers(REGISTRATION_FORMS.mma, {});

    expect(problems.map((problem) => problem.field)).toEqual(
      REGISTRATION_FORMS.mma.questions.map((question) => question.field),
    );
  });

  it("refuses an email address nobody could be reached at", () => {
    const { problems } = parseAnswers(REGISTRATION_FORMS.mma, complete({ email: "giorgi" }));

    expect(problems).toEqual([{ field: "email", message: REGISTRATION_MESSAGES.email }]);
  });

  it("refuses a date of birth that is not a day in the past", () => {
    for (const dateOfBirth of ["2001-02-30", "17/04/2001", "2999-01-01", "1850-01-01"]) {
      const { problems } = parseAnswers(REGISTRATION_FORMS.mma, complete({ dateOfBirth }));

      expect(problems).toEqual([
        { field: "dateOfBirth", message: REGISTRATION_MESSAGES.dateOfBirth },
      ]);
    }
  });

  it("joins the fighting styles ticked with the one typed, the way the form wrote them", () => {
    const { answers } = parseAnswers(
      REGISTRATION_FORMS.mma,
      complete({ fightingStyles: ["Boxing", "Judo", " Sambo ", ""] }),
    );

    expect(answers).toContainEqual({
      header: "Fighting style",
      value: "Boxing, Judo, Sambo",
      kind: "choices",
    });
  });

  it("asks for at least one fighting style", () => {
    const { problems } = parseAnswers(REGISTRATION_FORMS.mma, complete({ fightingStyles: ["  "] }));

    expect(problems).toEqual([{ field: "fightingStyles", message: REGISTRATION_MESSAGES.choices }]);
  });

  it("holds a paragraph to a paragraph's length and a line to a line's", () => {
    const form = REGISTRATION_FORMS.mma;

    expect(
      parseAnswers(form, complete({ experience: "x".repeat(ANSWER_LENGTH.paragraph) })).problems,
    ).toEqual([]);
    expect(
      parseAnswers(form, complete({ goal: "x".repeat(ANSWER_LENGTH.line + 1) })).problems,
    ).toEqual([{ field: "goal", message: REGISTRATION_MESSAGES.tooLong(ANSWER_LENGTH.line) }]);
  });
});

describe("checkFiles", () => {
  const form = REGISTRATION_FORMS.mma;
  const photo = { name: "me.jpg", size: 2_000_000, type: "image/jpeg" };

  it("accepts a photo and no highlights", () => {
    expect(checkFiles(form, { photo: [photo] })).toEqual([]);
  });

  it("asks for a photo", () => {
    expect(checkFiles(form, {})).toEqual([
      { field: "photo", message: REGISTRATION_MESSAGES.photo },
    ]);
  });

  it("holds each upload to the forms' own limits", () => {
    const reel = { name: "reel.mp4", size: 900_000_000, type: "video/mp4" };
    const tooLarge = { ...reel, name: "whole-fight.mp4", size: 2 * 1024 ** 3 };

    expect(checkFiles(form, { photo: [photo], highlights: Array(5).fill(reel) })).toEqual([]);
    expect(checkFiles(form, { photo: [photo], highlights: Array(6).fill(reel) })).toEqual([
      { field: "highlights", message: REGISTRATION_MESSAGES.tooManyFiles(5) },
    ]);
    expect(checkFiles(form, { photo: [photo], highlights: [tooLarge] })).toEqual([
      {
        field: "highlights",
        message: REGISTRATION_MESSAGES.fileTooLarge("whole-fight.mp4", 1024 ** 3),
      },
    ]);
  });

  it("takes only a picture as the photo", () => {
    const [problem] = checkFiles(form, {
      photo: [{ name: "me.mp4", size: 10, type: "video/mp4" }],
    });

    expect(problem?.field).toBe("photo");
  });
});

describe("parseUploadRequest", () => {
  it("opens an upload for a file the form accepts", () => {
    expect(
      parseUploadRequest({
        discipline: "cage_grappling",
        upload: "highlights",
        name: "roll.mov",
        mimeType: "video/quicktime",
        size: 50_000_000,
      }),
    ).toEqual({
      request: {
        discipline: "cage_grappling",
        upload: "highlights",
        name: "roll.mov",
        mimeType: "video/quicktime",
        size: 50_000_000,
      },
    });
  });

  it("refuses anything else", () => {
    const fine = {
      discipline: "mma",
      upload: "photo",
      name: "me.jpg",
      mimeType: "image/jpeg",
      size: 10,
    };

    for (const body of [
      { ...fine, discipline: "kickboxing" },
      { ...fine, upload: "contract" },
      { ...fine, name: "" },
      { ...fine, size: 0 },
      { ...fine, size: 101 * 1024 * 1024 },
      { ...fine, mimeType: "application/pdf" },
      null,
    ]) {
      expect(parseUploadRequest(body).problem).toBeTruthy();
    }
  });
});

describe("parseRegistration", () => {
  it("is everything the sheet's row is written from", () => {
    const parsed = parseRegistration({
      discipline: "cagebox",
      answers: complete(),
      files: { photo: [PHOTO_ID], highlights: [] },
    });

    expect(parsed.problems).toBeUndefined();
    expect(parsed.registration?.fullName).toBe("Giorgi Beridze");
    expect(parsed.registration?.files).toEqual([
      { upload: "highlights", header: REGISTRATION_FORMS.cagebox.uploads[0]!.header, ids: [] },
      { upload: "photo", header: REGISTRATION_FORMS.cagebox.uploads[1]!.header, ids: [PHOTO_ID] },
    ]);
  });

  it("asks for the photo that was never uploaded", () => {
    const parsed = parseRegistration({ discipline: "mma", answers: complete(), files: {} });

    expect(parsed.problems).toEqual([{ field: "photo", message: REGISTRATION_MESSAGES.photo }]);
  });

  it("refuses something that is not a Drive file id", () => {
    const parsed = parseRegistration({
      discipline: "mma",
      answers: complete(),
      files: { photo: ["../../etc"] },
    });

    expect(parsed.problems?.map((problem) => problem.field)).toEqual(["photo"]);
  });

  it("refuses a discipline TFC does not book", () => {
    expect(parseRegistration({ discipline: "kickboxing" }).problems).toEqual([
      { field: "discipline", message: REGISTRATION_MESSAGES.discipline },
    ]);
  });
});

describe("what the form says", () => {
  it("holds to the naming rule in CONTEXT.md", () => {
    const upload = REGISTRATION_FORMS.mma.uploads[0]!;
    const said = [
      ...Object.values(REGISTRATION_MESSAGES).filter((message) => typeof message === "string"),
      REGISTRATION_MESSAGES.tooLong(ANSWER_LENGTH.line),
      REGISTRATION_MESSAGES.tooManyFiles(5),
      REGISTRATION_MESSAGES.fileTooLarge("reel.mp4", upload.maxBytes),
      REGISTRATION_MESSAGES.fileType("reel.pdf", upload),
      ...Object.values(REGISTRATION_FORMS).flatMap((form) => [
        ...form.questions.flatMap((question) => [question.label, question.hint ?? ""]),
        ...form.uploads.flatMap((each) => [each.label, each.hint]),
      ]),
    ];

    for (const message of said) expect(findBannedTerms(message)).toEqual([]);
  });
});
