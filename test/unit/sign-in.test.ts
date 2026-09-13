import { describe, expect, it } from "vitest";
import { coinsLabel, STARTING_BALANCE } from "../../shared/coins";
import { ENTRY_MESSAGES } from "../../shared/entries";
import { SIGN_IN_MESSAGES, signInPrompt } from "../../shared/signIn";

/**
 * What the card says to somebody answering it without an account.
 *
 * The card is deliberately open to a visitor — reading it and answering it
 * needs no account, and only committing Coins does — so the one thing this has
 * to get right is *when* the requirement is said. Said at the moment a fan
 * presses Submit, it is a refusal; said before they start, it is an
 * instruction. Both sentences are checked here, because the difference between
 * them is the whole of the fix.
 */
describe("the prompt a visitor is shown", () => {
  it("says nothing at all to a fan who is signed in", () => {
    expect(signInPrompt(true, 0)).toBe(null);
    expect(signInPrompt(true, 4)).toBe(null);
  });

  it("asks a visitor to sign in before they have answered anything", () => {
    const prompt = signInPrompt(false, 0);

    expect(prompt?.standing).toBe("reading");
    expect(prompt?.headline).toBe(SIGN_IN_MESSAGES.reading.headline);
  });

  it("says up front that it is committing Coins that needs the account", () => {
    // The instruction only works if it also says what a visitor may do
    // without one — otherwise it reads as a card that cannot be looked at.
    expect(signInPrompt(false, 0)?.detail).toMatch(/need no account/i);
    expect(signInPrompt(false, 0)?.detail).toMatch(/committing coins/i);

    // And it is not the API's refusal wearing a headline: that one states the
    // rule to somebody who has already run into it. See `ENTRY_MESSAGES.signIn`.
    expect(signInPrompt(false, 0)?.detail).not.toBe(ENTRY_MESSAGES.signIn);
  });

  it("changes what it says the moment one Bout is answered", () => {
    const reading = signInPrompt(false, 0);
    const answered = signInPrompt(false, 1);

    expect(answered?.standing).toBe("answered");
    expect(answered?.headline).not.toBe(reading?.headline);
  });

  it("names how many Bouts are waiting on the account", () => {
    expect(signInPrompt(false, 1)?.detail).toContain("1 Bout is");
    expect(signInPrompt(false, 3)?.detail).toContain("3 Bouts are");
  });

  it("promises the answers survive the trip, because the card keeps them", () => {
    // `app/pages/predictions/index.vue` holds the answers in `useState` for
    // exactly this sentence: a prompt that cost a fan their answers would be
    // a worse deal than the refusal it replaced.
    expect(signInPrompt(false, 2)?.detail).toMatch(/stay on the card/i);
  });

  it("says what an account costs, which is nothing", () => {
    expect(signInPrompt(false, 2)?.detail).toContain(coinsLabel(STARTING_BALANCE));
  });

  it("has a line short enough for the Bout the fan just answered", () => {
    // It renders inside one Bout of a card that may hold ten, beside a
    // countdown — a paragraph there is a paragraph nobody reads.
    expect(SIGN_IN_MESSAGES.onTheBout.length).toBeLessThan(80);
    expect(SIGN_IN_MESSAGES.onTheBout).toMatch(/account/i);
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
