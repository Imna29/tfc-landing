import { describe, expect, it } from "vitest";
import {
  MINIMUM_PASSWORD_LENGTH,
  PHONE_DIGITS,
  SIGN_UP_MESSAGES,
  normalisePhone,
  parseSignUpDetails,
} from "../../shared/signUp";
import { findBannedTerms } from "../helpers/vocabulary";

/**
 * A phone number is the one thing sign-up asks for that no other account can
 * hold (ADR-0018), so the shape it is stored in is what "no other account"
 * means. Every spelling of one number has to reduce to one string, or
 * `users_phone_unique` is looking at two rows and seeing two people.
 */
describe("normalisePhone", () => {
  it("throws away the punctuation people type numbers with", () => {
    for (const typed of [
      "+995 555 12 34 56",
      "+995-555-12-34-56",
      "+995 (555) 12.34.56",
      "  +995555123456  ",
    ]) {
      expect(normalisePhone(typed)).toBe("+995555123456");
    }
  });

  it("reads the 00 prefix as the + it stands for", () => {
    // The same number, dialled the way half of Europe writes it. Left alone,
    // this is a second account for somebody who already has one.
    expect(normalisePhone("00995555123456")).toBe("+995555123456");
    expect(normalisePhone("00 995 555 12 34 56")).toBe("+995555123456");
  });

  it("refuses a number with no country code, rather than guessing one", () => {
    // `555123456` is a Georgian number to a Georgian and a Dutch one to
    // somebody in Amsterdam. Guessing would file two people under one row;
    // accepting it as-is would file one person under two.
    expect(normalisePhone("555123456")).toBe("");
    expect(normalisePhone("0555123456")).toBe("");
  });

  it("answers empty for text that is not a number at all", () => {
    for (const text of ["", "   ", "call me", "+", "-", "00"]) {
      expect(normalisePhone(text)).toBe("");
    }
  });

  it("refuses a plus that is not leading, rather than quietly dropping it", () => {
    expect(normalisePhone("555+123456")).toBe("");
  });

  it("holds a number to a dialable length, counting digits and not the plus", () => {
    expect(normalisePhone(`+${"1".repeat(PHONE_DIGITS.minimum - 1)}`)).toBe("");
    expect(normalisePhone(`+${"1".repeat(PHONE_DIGITS.minimum)}`)).not.toBe("");
    expect(normalisePhone(`+${"1".repeat(PHONE_DIGITS.maximum)}`)).not.toBe("");
    expect(normalisePhone(`+${"1".repeat(PHONE_DIGITS.maximum + 1)}`)).toBe("");
  });

  it("is idempotent, because the stored form is fed back through it", () => {
    // The database hook in `server/utils/auth.ts` normalises whatever reaches
    // it, including a number this function already answered with.
    const once = normalisePhone("+995 555 12 34 56");

    expect(normalisePhone(once)).toBe(once);
  });
});

describe("parseSignUpDetails", () => {
  const complete = {
    username: "corner-man",
    email: "fan@example.com",
    password: "a good long password",
    phone: "+995555123456",
  };

  const problemsFor = (body: unknown) => {
    const parsed = parseSignUpDetails(body);
    return (parsed.problems ?? []).map((problem) => problem.field);
  };

  it("accepts a complete answer", () => {
    expect(parseSignUpDetails(complete)).toEqual({ details: complete });
  });

  it("takes the email as an address, however it was typed", () => {
    const parsed = parseSignUpDetails({ ...complete, email: "  Fan@Example.COM " });

    expect(parsed.details?.email).toBe("fan@example.com");
  });

  it("keeps a username exactly as the fan chose it, minus the whitespace", () => {
    const parsed = parseSignUpDetails({ ...complete, username: "  IronMike  " });

    expect(parsed.details?.username).toBe("IronMike");
  });

  it("stores the phone number normalised, not as it was typed", () => {
    const parsed = parseSignUpDetails({ ...complete, phone: "+995 555 12 34 56" });

    expect(parsed.details?.phone).toBe("+995555123456");
  });

  it("rejects a username nobody could type or read", () => {
    for (const username of ["", "ab", "a".repeat(21), "iron mike", "iron.mike", "iron/mike"]) {
      expect(problemsFor({ ...complete, username })).toEqual(["username"]);
    }
  });

  it("rejects an email address that is not one", () => {
    for (const email of ["", "fan", "fan@", "@example.com", "fan @example.com"]) {
      expect(problemsFor({ ...complete, email })).toEqual(["email"]);
    }
  });

  it("rejects a password shorter than the minimum", () => {
    expect(problemsFor({ ...complete, password: "a".repeat(MINIMUM_PASSWORD_LENGTH - 1) })).toEqual(
      ["password"],
    );
    expect(problemsFor({ ...complete, password: "a".repeat(MINIMUM_PASSWORD_LENGTH) })).toEqual([]);
  });

  it("rejects a phone number left blank, unreachable, or missing its country code", () => {
    for (const phone of ["", "   ", "call me", "+", "555123456"]) {
      expect(problemsFor({ ...complete, phone })).toEqual(["phone"]);
    }
  });

  it("rejects a number too short or too long to dial", () => {
    expect(problemsFor({ ...complete, phone: `+${"1".repeat(PHONE_DIGITS.minimum - 1)}` })).toEqual(
      ["phone"],
    );
    expect(problemsFor({ ...complete, phone: `+${"1".repeat(PHONE_DIGITS.minimum)}` })).toEqual([]);
    expect(problemsFor({ ...complete, phone: `+${"1".repeat(PHONE_DIGITS.maximum)}` })).toEqual([]);
    expect(problemsFor({ ...complete, phone: `+${"1".repeat(PHONE_DIGITS.maximum + 1)}` })).toEqual(
      ["phone"],
    );
  });

  it("says which of the two things is wrong with a number without a country code", () => {
    const parsed = parseSignUpDetails({ ...complete, phone: "555123456" });

    expect(parsed.problems?.[0]?.message).toMatch(/country code/i);
  });

  it("reports every problem at once, so the form can be fixed in one pass", () => {
    expect(problemsFor({ ...complete, username: "x", password: "short", phone: "" })).toEqual([
      "username",
      "password",
      "phone",
    ]);
  });

  it("rejects a body that is not an answer at all", () => {
    for (const body of [null, undefined, "", 12, []]) {
      expect(problemsFor(body).length).toBeGreaterThan(0);
    }
  });

  it("says all of it in the approved vocabulary", () => {
    for (const message of Object.values(SIGN_UP_MESSAGES)) {
      expect(findBannedTerms(message)).toEqual([]);
    }
  });
});
