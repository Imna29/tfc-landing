import { describe, expect, it } from "vitest";
import {
  EMAIL_MESSAGES,
  PASSWORD_RESET_LINK_HOURS,
  VERIFICATION_LINK_HOURS,
  looksLikeEmail,
  passwordResetEmail,
  verificationEmail,
} from "../../shared/emails";
import { findBannedTerms } from "../helpers/vocabulary";

/**
 * The two messages TFC ever sends a fan. Both are read outside the app, in a
 * client nobody chose, and both carry the only link that finishes what the fan
 * started — so what matters here is that the link survives being written down
 * twice, once as text and once as HTML.
 */
describe("the messages TFC sends", () => {
  const link = "https://tfcgeo.com/api/auth/verify-email?token=abc.def&callbackURL=%2Fprofile";

  it.each([
    ["verificationEmail", verificationEmail(link)],
    ["passwordResetEmail", passwordResetEmail(link)],
  ])("%s says what it is about in its subject", (_name, message) => {
    expect(message.subject.length).toBeGreaterThan(0);
    expect(message.subject).not.toContain("\n");
  });

  it.each([
    ["verificationEmail", verificationEmail(link)],
    ["passwordResetEmail", passwordResetEmail(link)],
  ])("%s carries the link a fan can read and one they can click", (_name, message) => {
    expect(message.text).toContain(link);
    expect(message.html).toContain(`href="${link.replace(/&/g, "&amp;")}"`);
  });

  it("escapes the link rather than pasting a query string into HTML", () => {
    // `&callbackURL=` is a character reference to a mail client that parses
    // HTML strictly, and the link arrives truncated at the ampersand.
    expect(verificationEmail(link).html).not.toMatch(/href="[^"]*[^&]&callbackURL/);
  });

  it("tells a fan how long the link lasts, in the words the config is set to", () => {
    expect(verificationEmail(link).text).toContain(`${VERIFICATION_LINK_HOURS} hours`);
    expect(passwordResetEmail(link).text).toContain("one hour");
    expect(PASSWORD_RESET_LINK_HOURS).toBe(1);
  });

  it("tells a fan who did not ask for it that they can ignore it", () => {
    expect(verificationEmail(link).text).toMatch(/ignore/i);
    expect(passwordResetEmail(link).text).toMatch(/ignore/i);
  });

  it("promises a password reset link is single use, because it is", () => {
    expect(passwordResetEmail(link).text).toMatch(/once/i);
  });

  it("uses the approved vocabulary", () => {
    const everything = [
      verificationEmail(link),
      passwordResetEmail(link),
      ...Object.values(EMAIL_MESSAGES).map((text) => ({ subject: "", text, html: "" })),
    ]
      .map((message) => `${message.subject}\n${message.text}`)
      .join("\n");

    expect(findBannedTerms(everything)).toEqual([]);
  });
});

describe("looksLikeEmail", () => {
  it.each(["nino@example.com", "nino.beridze+tfc@mail.example.co.uk", " NINO@EXAMPLE.COM "])(
    "accepts %s",
    (address) => {
      expect(looksLikeEmail(address)).toBe(true);
    },
  );

  it.each(["", "nino", "nino@example", "nino @example.com", "@example.com"])(
    "rejects %s",
    (address) => {
      expect(looksLikeEmail(address)).toBe(false);
    },
  );
});
