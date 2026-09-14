import { $fetch } from "@nuxt/test-utils/e2e";
import { describe, expect, it } from "vitest";
import { SIGN_IN_MESSAGES } from "../../shared/signIn";
import { signUp } from "../helpers/accounts";
import { cardBout, cardInTheGame } from "../helpers/cards";
import { setupTestServer } from "../helpers/server";

/**
 * Being told an account is needed where the fact is about the Bout in hand,
 * rather than as a refusal at the end or a notice in the way at the start.
 *
 * The card is open to a visitor on purpose, and the requirement used to arrive
 * as a red line under the Submit button — after a fan had worked down ten Bouts
 * and chosen an Amount. That is the bug: at that moment the fact is a refusal,
 * and every answer leading up to it was wasted. The notice that replaced it sat
 * above the card and was in the way of the one thing a visitor came for, so what
 * is left says it on the Bout just answered and on the panel's own button.
 *
 * A server file rather than unit cases because the fix is in what the page
 * *renders*, and this repo has no component-test setup: `shared/signIn.ts`
 * decides the sentences and `test/unit/sign-in.test.ts` holds those, but only a
 * rendered page can say whether a visitor meets them where they should and a
 * signed-in fan meets none of them. The panel's own control is here for the same
 * reason — that it is a link to the form rather than a button that refuses is
 * the whole of the fix, and it is a fact about the HTML.
 */
describe("the card a visitor with no account is reading", async () => {
  await setupTestServer();

  /** A card two hours out, which is a card every Bout on is still open. */
  function upcomingCard() {
    return cardInTheGame({
      scheduledStart: new Date(Date.now() + 120 * 60_000),
      bouts: [cardBout({ cardOrder: 1 }), cardBout({ cardOrder: 2, mainEvent: true })],
    });
  }

  /** The card as it is server-rendered, for a visitor or for a fan. */
  function page(cookie?: string) {
    return $fetch<string>("/predictions", {
      headers: cookie === undefined ? {} : { cookie },
    });
  }

  it("shows them the whole card, with every answer there to press", async () => {
    // What a visitor is told is a fact, not a gate. A card that did nothing
    // until a visitor had an account is the thing this must not become.
    await upcomingCard();

    const rendered = await page();

    expect(rendered).toContain("Giorgi Tsiklauri");
    expect(rendered).toMatch(/aria-pressed="false"/);
  });

  it("puts nothing between them and the card before they have answered", async () => {
    // The Bout they press says what needs an account, and the panel says it
    // again. A standing notice above the card only delays the card.
    await upcomingCard();

    const rendered = await page();

    expect(rendered).not.toMatch(/Sign in before you answer/i);
    expect(rendered).not.toMatch(/Sign in to commit what you have answered/i);
  });

  it("offers the panel's own action as the way to an account, not as a refusal", async () => {
    await upcomingCard();

    const rendered = await page();

    expect(rendered).toContain(SIGN_IN_MESSAGES.action);
    // The button that used to be here answered "sign in first" when pressed.
    expect(rendered).not.toContain("Submit Entry");
  });

  it("sends them to the form in a way that brings them back to the card", async () => {
    await upcomingCard();

    const rendered = await page();

    expect(rendered).toContain("/account/sign-in?next=%2Fpredictions");
  });

  it("keeps the promise on the form it sent them to", async () => {
    const form = await $fetch<string>("/account/sign-in?next=/predictions");

    expect(form).toContain(SIGN_IN_MESSAGES.backToTheCard);
  });

  it("says nothing about an account to a fan who is signed in", async () => {
    await upcomingCard();
    const fan = await signUp();

    const rendered = await page(fan.cookie);

    expect(rendered).not.toContain(SIGN_IN_MESSAGES.onTheBout);
    expect(rendered).not.toContain(SIGN_IN_MESSAGES.action);
    expect(rendered).toContain("Submit Entry");
  });
});
