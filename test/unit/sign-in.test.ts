import { describe, expect, it } from "vitest";
import { SIGN_IN_MESSAGES } from "../../shared/signIn";

/**
 * What the card says to somebody answering it without an account.
 *
 * The card is deliberately open to a visitor — reading it and answering it
 * needs no account, and only committing Coins does — so the one thing this has
 * to get right is *when* the requirement is said. Said at the moment a fan
 * presses Submit, it is a refusal; said on the Bout they have just answered and
 * on the button that takes them to the form, it is a fact about the thing in
 * front of them. Each of those sentences is checked here.
 */
describe("what a visitor is told about the account", () => {
  it("has a line short enough for the Bout the fan just answered", () => {
    // It renders inside one Bout of a card that may hold ten, beside a
    // countdown — a paragraph there is a paragraph nobody reads.
    expect(SIGN_IN_MESSAGES.onTheBout.length).toBeLessThan(80);
    expect(SIGN_IN_MESSAGES.onTheBout).toMatch(/account/i);
  });

  it("says on that line that it is committing Coins that needs the account", () => {
    // The card stays open to a visitor either way, so the line has to name the
    // one part that does not — otherwise it reads as a Bout that was refused.
    expect(SIGN_IN_MESSAGES.onTheBout).toMatch(/committing coins/i);
  });

  it("keeps on the form the promise the card made about the answers", () => {
    // Both forms show it, so it names neither of them: a fan who reached the
    // sign-up page by way of "Create an account" is being told the same thing.
    expect(SIGN_IN_MESSAGES.backToTheCard).toMatch(/back to the card/i);
    expect(SIGN_IN_MESSAGES.backToTheCard).not.toMatch(/signing in/i);
  });

  it("labels the panel's own action as what it actually does", () => {
    // The panel's button used to say "Submit Entry" and refuse; it now says
    // this and goes to the sign-in form.
    expect(SIGN_IN_MESSAGES.action).toMatch(/sign in/i);
  });
});
