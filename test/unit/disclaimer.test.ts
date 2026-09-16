import { describe, expect, it } from "vitest";
import {
  DISCLAIMER_EDITION,
  disclaimerSeen,
  PLAY_DISCLAIMER,
  rememberDisclaimerSeen,
} from "../../app/utils/disclaimer";

/** A `localStorage` that lives for one test. */
function storage() {
  const kept = new Map<string, string>();

  return {
    getItem: (key: string) => kept.get(key) ?? null,
    setItem: (key: string, value: string) => {
      kept.set(key, value);
    },
    kept,
  };
}

/** A browser that blocks site data, which throws on reaching the storage at all. */
function refused(): never {
  throw new DOMException("The operation is insecure.", "SecurityError");
}

/**
 * PlayTFC tells a fan what the game is the first time they reach it, and then
 * stops. The popup is the page's; whether this browser has already been told is
 * decided here.
 */
describe("the PlayTFC disclaimer", () => {
  it("is shown to a browser that has never dismissed it", () => {
    const local = storage();

    expect(disclaimerSeen(() => local)).toBe(false);
  });

  it("is not shown again once dismissed", () => {
    const local = storage();

    rememberDisclaimerSeen(() => local);

    expect(disclaimerSeen(() => local)).toBe(true);
  });

  it("is shown again when its wording has changed since", () => {
    const local = storage();

    rememberDisclaimerSeen(() => local);
    const [key] = [...local.kept.keys()];
    local.kept.set(key!, `before-${DISCLAIMER_EDITION}`);

    expect(disclaimerSeen(() => local)).toBe(false);
  });

  it("is shown when the browser will not say, and dismissing it there does not throw", () => {
    expect(disclaimerSeen(refused)).toBe(false);
    expect(() => rememberDisclaimerSeen(refused)).not.toThrow();
  });

  it("is published in English and in Georgian", () => {
    expect(PLAY_DISCLAIMER.map((language) => language.lang)).toEqual(["en", "ka"]);

    for (const language of PLAY_DISCLAIMER) {
      expect(language.paragraphs).toHaveLength(3);
    }
  });
});
