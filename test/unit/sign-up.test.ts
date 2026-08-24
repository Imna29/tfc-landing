import { describe, expect, it } from "vitest";
import {
  MINIMUM_AGE,
  MINIMUM_PASSWORD_LENGTH,
  SIGN_UP_MESSAGES,
  contestDateOn,
  isOldEnoughOn,
  parseSignUpDetails,
} from "../../shared/signUp";
import { findBannedTerms } from "../helpers/vocabulary";

/**
 * ADR-0007: TFC Predictions is 18+, and a date of birth is the only evidence
 * of it the application ever holds. The gate is arithmetic on two calendar
 * dates, so it is checked here rather than through a server that would have to
 * be told what day it is.
 */
describe("the 18+ gate", () => {
  it("is the age ADR-0007 publishes", () => {
    expect(MINIMUM_AGE).toBe(18);
  });

  it("lets in a fan who is comfortably old enough", () => {
    expect(isOldEnoughOn("1990-06-01", "2026-08-24")).toBe(true);
  });

  it("keeps out a fan who is comfortably too young", () => {
    expect(isOldEnoughOn("2015-06-01", "2026-08-24")).toBe(false);
  });

  it("lets a fan in on their eighteenth birthday, not the day before", () => {
    expect(isOldEnoughOn("2008-08-24", "2026-08-24")).toBe(true);
    expect(isOldEnoughOn("2008-08-25", "2026-08-24")).toBe(false);
  });

  it("counts the calendar, not the elapsed days", () => {
    // A birthday later in the same year has not happened yet.
    expect(isOldEnoughOn("2008-12-31", "2026-08-24")).toBe(false);
    expect(isOldEnoughOn("2008-01-01", "2026-08-24")).toBe(true);
  });

  it("turns a leapling eighteen on the first of March", () => {
    // 2008-02-29 + 18 years is a date that does not exist. Constructing it
    // would silently become the first of March or the first of the month
    // before, depending on the library; the answer must not depend on that.
    expect(isOldEnoughOn("2008-02-29", "2026-02-28")).toBe(false);
    expect(isOldEnoughOn("2008-02-29", "2026-03-01")).toBe(true);
  });
});

/**
 * TFC operates from Georgia (ADR-0007), so the day the 18+ gate is measured
 * against is the day it is in Tbilisi — not the day it is in UTC, which is the
 * day before for the first four hours of every Georgian morning.
 */
describe("the day the contest is having", () => {
  it("is the Georgian day, not the UTC one", () => {
    // 22:30 UTC is half past two the next morning in Tbilisi.
    expect(contestDateOn(new Date("2026-08-24T22:30:00Z"))).toBe("2026-08-25");
  });

  it("agrees with UTC in the middle of the Georgian day", () => {
    expect(contestDateOn(new Date("2026-08-24T09:00:00Z"))).toBe("2026-08-24");
  });
});

describe("parseSignUpDetails", () => {
  const today = "2026-08-24";

  const complete = {
    username: "corner-man",
    email: "fan@example.com",
    password: "a good long password",
    firstName: "Nino",
    lastName: "Beridze",
    dateOfBirth: "1994-03-02",
  };

  const problemsFor = (body: unknown) => {
    const parsed = parseSignUpDetails(body, today);
    return (parsed.problems ?? []).map((problem) => problem.field);
  };

  it("accepts a complete answer", () => {
    expect(parseSignUpDetails(complete, today)).toEqual({ details: complete });
  });

  it("takes the email as an address, however it was typed", () => {
    const parsed = parseSignUpDetails({ ...complete, email: "  Fan@Example.COM " }, today);

    expect(parsed.details?.email).toBe("fan@example.com");
  });

  it("keeps a username exactly as the fan chose it, minus the whitespace", () => {
    const parsed = parseSignUpDetails({ ...complete, username: "  IronMike  " }, today);

    expect(parsed.details?.username).toBe("IronMike");
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

  it("rejects a real name left blank", () => {
    expect(problemsFor({ ...complete, firstName: "   " })).toEqual(["firstName"]);
    expect(problemsFor({ ...complete, lastName: "" })).toEqual(["lastName"]);
  });

  it("rejects a date of birth that is not a date", () => {
    for (const dateOfBirth of ["", "yesterday", "1994-13-02", "1994-02-30", "02/03/1994"]) {
      expect(problemsFor({ ...complete, dateOfBirth })).toEqual(["dateOfBirth"]);
    }
  });

  it("tells a fan who typed a date in the future what is wrong with it", () => {
    const parsed = parseSignUpDetails({ ...complete, dateOfBirth: "2030-01-01" }, today);

    expect(parsed.problems?.map((problem) => problem.field)).toEqual(["dateOfBirth"]);
    expect(parsed.problems?.[0]?.message).not.toMatch(/\b18\b/);
    expect(parsed.problems?.[0]?.message).toMatch(/future|has not happened/i);
  });

  it("rejects a fan who is not yet eighteen", () => {
    expect(problemsFor({ ...complete, dateOfBirth: "2010-01-01" })).toEqual(["dateOfBirth"]);
  });

  it("explains being too young as being too young", () => {
    const parsed = parseSignUpDetails({ ...complete, dateOfBirth: "2010-01-01" }, today);

    expect(parsed.problems?.[0]?.message).toMatch(/\b18\b/);
  });

  it("reports every problem at once, so the form can be fixed in one pass", () => {
    expect(problemsFor({ ...complete, username: "x", password: "short", lastName: "" })).toEqual([
      "username",
      "password",
      "lastName",
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
