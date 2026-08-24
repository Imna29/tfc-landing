export interface EligibilityRule {
  /** Stable across rewording, so an editor can point at one and replace it. */
  id: string;
  title: string;
  detail: string;
}

/**
 * The contest constraints TFC publishes, from ADR-0007.
 *
 * Every one of them reaches the page on every render. This is a legal page in
 * a jurisdiction ADR-0007 says counsel still has to sign off, and the failure
 * it must not have is an edit in Prismic quietly removing the 18+ line.
 *
 * They are not frozen, though: an editor can replace any of them by id and no
 * deploy is involved — see `resolveEligibilityRules`. What they cannot do is
 * end up with fewer constraints than this.
 *
 * The wording claims only what the application actually does. ADR-0007 is
 * explicit that one-account-per-person "is enforced only by email
 * verification … a published rule and a speed bump, not a technical
 * guarantee", so nothing here threatens a sanction nothing implements.
 */
export const PUBLISHED_ELIGIBILITY_RULES: readonly EligibilityRule[] = [
  {
    id: "age",
    title: "18 and over",
    detail:
      "TFC Predictions is open to fans aged 18 or over. You give your date of birth when you " +
      "create an account.",
  },
  {
    id: "one-account",
    title: "One account per person",
    detail: "Play a Season on one account. Taking part on more than one is against these rules.",
  },
  {
    id: "verified-email",
    title: "A confirmed email address",
    detail:
      "Confirm your email address before you submit your first Entry. Until you do, you can " +
      "read the card, but you cannot play it.",
  },
  {
    id: "prize-terms",
    title: "Prizes are awarded, never exchanged",
    detail:
      "Prizes are non-transferable and are never exchangeable for cash. Coins have no " +
      "real-money value and cannot be bought, transferred or redeemed.",
  },
];

/** A rule as it arrives from a Prismic group, where every field can be empty. */
export interface AuthoredEligibilityRule {
  /** The id of a published constraint to reword, or empty to add a new rule. */
  replaces?: string | null;
  title?: string | null;
  detail?: string | null;
}

/**
 * The eligibility rules to publish: the constraints above, reworded where an
 * editor has said so, followed by any rules they have added of their own.
 *
 * A row naming a constraint that no longer exists is kept as an addition
 * rather than dropped, so renaming an id here cannot silently delete what
 * someone wrote. Two rows naming the same constraint apply in order, and the
 * last one wins.
 */
export function resolveEligibilityRules(
  authored: readonly AuthoredEligibilityRule[] | null | undefined,
): EligibilityRule[] {
  const published = PUBLISHED_ELIGIBILITY_RULES.map((rule) => ({ ...rule }));
  const added: EligibilityRule[] = [];

  (authored ?? []).forEach((row, index) => {
    const title = (row.title ?? "").trim();
    const detail = (row.detail ?? "").trim();

    if (title === "" && detail === "") {
      return;
    }

    const replaced = published.find((rule) => rule.id === (row.replaces ?? "").trim());

    if (replaced) {
      replaced.title = title || replaced.title;
      replaced.detail = detail || replaced.detail;
      return;
    }

    added.push({ id: `authored-${index}`, title, detail });
  });

  return [...published, ...added];
}
