import { describe, expect, it } from "vitest";
import {
  PUBLISHED_ELIGIBILITY_RULES,
  resolveEligibilityRules,
} from "../../app/utils/eligibilityRules";
import { findBannedTerms } from "../helpers/vocabulary";

/**
 * ADR-0007 names four constraints the contest publishes. They are what tells a
 * fan whether they qualify before they invest any time in the game, so no
 * amount of editing in Prismic may leave the page without them.
 */
describe("the published eligibility rules", () => {
  it("states every constraint ADR-0007 publishes", () => {
    const rules = PUBLISHED_ELIGIBILITY_RULES.map((rule) => `${rule.title} ${rule.detail}`);

    expect(rules.some((rule) => /\b18\b/.test(rule))).toBe(true);
    expect(rules.some((rule) => /one account/i.test(rule))).toBe(true);
    expect(rules.some((rule) => /confirm/i.test(rule) && /email/i.test(rule))).toBe(true);
    expect(rules.some((rule) => /transfer/i.test(rule) && /cash/i.test(rule))).toBe(true);
  });

  it("says it in the approved vocabulary", () => {
    for (const rule of PUBLISHED_ELIGIBILITY_RULES) {
      expect(findBannedTerms(`${rule.title} ${rule.detail}`)).toEqual([]);
    }
  });

  it("claims no enforcement the application does not have", () => {
    // ADR-0007: one account per person "is enforced only by email
    // verification … a published rule and a speed bump, not a technical
    // guarantee". Copy that threatens a sanction describes a different app.
    const everything = PUBLISHED_ELIGIBILITY_RULES.map((r) => `${r.title} ${r.detail}`).join(" ");

    expect(everything).not.toMatch(/removed from|forfeit|banned|suspend|deleted/i);
  });
});

describe("resolveEligibilityRules", () => {
  const idsOf = (rules: { id: string }[]) => rules.map((rule) => rule.id);
  const publishedIds = PUBLISHED_ELIGIBILITY_RULES.map((rule) => rule.id);

  it("publishes the constraints when Prismic has nothing to say yet", () => {
    expect(resolveEligibilityRules(null)).toEqual([...PUBLISHED_ELIGIBILITY_RULES]);
    expect(resolveEligibilityRules(undefined)).toEqual([...PUBLISHED_ELIGIBILITY_RULES]);
    expect(resolveEligibilityRules([])).toEqual([...PUBLISHED_ELIGIBILITY_RULES]);
  });

  it("lets an editor reword a constraint without a deploy", () => {
    const resolved = resolveEligibilityRules([
      { replaces: "age", title: "Over 18s only", detail: "Proof of age on request." },
    ]);

    expect(resolved).toContainEqual({
      id: "age",
      title: "Over 18s only",
      detail: "Proof of age on request.",
    });
  });

  it("still publishes every constraint when one of them is reworded", () => {
    const resolved = resolveEligibilityRules([{ replaces: "age", title: "Over 18s only" }]);

    expect(idsOf(resolved)).toEqual(publishedIds);
  });

  it("keeps the published wording for the half an editor left alone", () => {
    const [age] = PUBLISHED_ELIGIBILITY_RULES;
    const resolved = resolveEligibilityRules([{ replaces: "age", title: "Over 18s only" }]);

    expect(resolved[0]).toEqual({ id: "age", title: "Over 18s only", detail: age?.detail });
  });

  it("adds a rule of its own after the constraints, not instead of them", () => {
    const resolved = resolveEligibilityRules([
      { title: "Open to Georgian residents", detail: "Wherever you watch from." },
    ]);

    expect(idsOf(resolved)).toEqual([...publishedIds, "authored-0"]);
    expect(resolved.at(-1)).toEqual({
      id: "authored-0",
      title: "Open to Georgian residents",
      detail: "Wherever you watch from.",
    });
  });

  it("keeps a rule pointed at a constraint that no longer exists", () => {
    // Renaming an id here must not silently delete what someone wrote.
    const resolved = resolveEligibilityRules([{ replaces: "retired-rule", title: "Still counts" }]);

    expect(resolved.map((rule) => rule.title)).toContain("Still counts");
    expect(idsOf(resolved).slice(0, publishedIds.length)).toEqual(publishedIds);
  });

  it("drops a row an author left entirely empty", () => {
    expect(resolveEligibilityRules([{ title: "", detail: null }])).toEqual([
      ...PUBLISHED_ELIGIBILITY_RULES,
    ]);
  });

  it("tidies up the whitespace an author left behind", () => {
    const resolved = resolveEligibilityRules([
      { title: "  Bring ID  ", detail: " Any photo ID. " },
    ]);

    expect(resolved.at(-1)).toEqual({
      id: "authored-0",
      title: "Bring ID",
      detail: "Any photo ID.",
    });
  });

  it("cannot be edited down to a page with no constraints on it", () => {
    for (const authored of [
      [],
      [{ title: " ", detail: "" }],
      [{ replaces: "age", title: "", detail: "" }],
      [{ title: "Something else entirely", detail: "" }],
    ]) {
      expect(idsOf(resolveEligibilityRules(authored))).toEqual(
        expect.arrayContaining(publishedIds),
      );
    }
  });
});
