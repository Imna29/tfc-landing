import { $fetch, fetch } from "@nuxt/test-utils/e2e";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { PRICING_MESSAGES } from "../../shared/pricing";
import type { ImportedEvent } from "../../server/utils/events";
import type { CardToPrice } from "../../server/utils/pricing";
import { postJson, signUpAdmin } from "../helpers/accounts";
import { boutOutcomes, cardBout, importedBouts, importTestCard } from "../helpers/cards";
import { testDatabase } from "../helpers/database";
import { setupTestServer } from "../helpers/server";
import { fanId } from "../helpers/users";

/**
 * Pricing a fight card and opening its Bouts for predictions.
 *
 * The half of ADR-0002 that costs somebody at TFC their time: Multipliers are
 * fixed by hand, so every card has to be priced before it opens, forever. What
 * makes that payable is that import seeds every Outcome from a table, and what
 * keeps it honest is that a seeded number is not a price — a Bout nobody has
 * looked at cannot be opened, and Postgres is what says so rather than the
 * route that asks first.
 */
describe("pricing a card and opening its Bouts", async () => {
  await setupTestServer();

  /** An admin with a Season open, ready to import a card into. */
  async function admin() {
    const signedUp = await signUpAdmin();

    await postJson("/api/admin/seasons", { name: "Season 1" }, signedUp.cookie);

    return { ...signedUp, id: await fanId(signedUp.details.email) };
  }

  /**
   * The card an admin is pricing, as the admin area reads it.
   *
   * Typed from what the route answers with, because `@nuxt/test-utils`'s
   * `$fetch` does not know this app's routes the way the app's own does. The
   * moments in it arrive as the strings JSON makes of them; nothing here reads
   * one.
   */
  function cardToPrice(eventId: string, cookie: string) {
    return $fetch<CardToPrice>(`/api/admin/events/${eventId}`, { headers: { cookie } });
  }

  /** What the card listing says about each card, at a glance. */
  async function listedCards(cookie: string) {
    const { cards } = await $fetch<{ cards: { imported: ImportedEvent | null }[] }>(
      "/api/admin/events",
      { headers: { cookie } },
    );

    return cards;
  }

  /** Saves the same Multiplier onto every Outcome of a Bout, as the form does. */
  function priceEveryOutcome(
    bout: { id: string; outcomes: { id: string }[] },
    cookie: string,
    multiplier = 2.5,
  ) {
    return postJson(
      `/api/admin/bouts/${bout.id}/multipliers`,
      { multipliers: Object.fromEntries(bout.outcomes.map((outcome) => [outcome.id, multiplier])) },
      cookie,
    );
  }

  /** Opens a Bout for predictions, as the button does. */
  function open(boutId: string, cookie: string) {
    return postJson(`/api/admin/bouts/${boutId}/open`, {}, cookie);
  }

  /** An imported card with one Bout on it, ready to be priced. */
  async function importedCard() {
    const signedIn = await admin();
    const imported = await importTestCard(signedIn.id);
    const card = await cardToPrice(imported.id, signedIn.cookie);

    return { ...signedIn, eventId: imported.id, card, bout: card.bouts[0]! };
  }

  describe("importing a card", () => {
    it("seeds a Multiplier on every Outcome of every Bout, priced by nobody", async () => {
      const { id } = await admin();

      const imported = await importTestCard(id, {
        bouts: [
          cardBout({ cardOrder: 1, scheduledRounds: 3 }),
          cardBout({ cardOrder: 2, scheduledRounds: 5, mainEvent: true }),
        ],
      });

      const [threeRounder, fiveRounder] = await importedBouts(imported.id);

      // Two winners, three methods, and a round for each round scheduled.
      const opener = await boutOutcomes(threeRounder!.id);
      const headliner = await boutOutcomes(fiveRounder!.id);

      expect(opener.length).toBe(8);
      expect(headliner.length).toBe(10);

      // Nothing offers a round the Bout is not scheduled for.
      expect(
        opener.filter((outcome) => outcome.question === "round").map((outcome) => outcome.round),
      ).toEqual([1, 2, 3]);

      // Seeded, and every one of them still waiting for an admin.
      expect(opener.every((outcome) => outcome.multiplier > 1)).toBe(true);
      expect(opener.every((outcome) => outcome.pricedAt === null)).toBe(true);
      expect(opener.every((outcome) => outcome.pricedBy === null)).toBe(true);
    });
  });

  describe("what an admin is shown to price", () => {
    it("asks each Bout its three Questions, in the order they are answered", async () => {
      const { card, bout } = await importedCard();

      expect(card).toMatchObject({ title: "TFC 12", seasonName: "Season 1" });
      expect(bout).toMatchObject({
        cardOrder: 1,
        redName: "Giorgi Tsiklauri",
        blueName: "Levan Beridze",
        division: "Lightweight",
        scheduledRounds: 3,
        status: "closed",
        priced: false,
      });

      expect(
        bout.outcomes.map((outcome) => [
          outcome.question,
          outcome.corner ?? outcome.method ?? outcome.round,
          outcome.priced,
        ]),
      ).toEqual([
        ["winner", "red", false],
        ["winner", "blue", false],
        ["method", "ko_tko", false],
        ["method", "submission", false],
        ["method", "decision", false],
        ["round", 1, false],
        ["round", 2, false],
        ["round", 3, false],
      ]);
    });

    it("renders the card with its Questions on it, for the admin pricing it", async () => {
      const { cookie, eventId } = await importedCard();

      const page = await $fetch<string>(`/admin/events/${eventId}`, { headers: { cookie } });

      expect(page).toContain("Giorgi Tsiklauri");
      expect(page).toMatch(/Method of victory/i);
      expect(page).toMatch(/Round of victory/i);

      // And says which Bouts still need sitting down with, which is what the
      // admin came to the page to find out.
      expect(page).toMatch(/Nobody has priced this Bout/i);
    });

    it("says nothing about a card nobody has imported", async () => {
      const { cookie } = await admin();

      const response = await fetch(`/api/admin/events/2fd25b0a-2f9e-4a06-9d4a-30d6d1c4a1f0`, {
        headers: { cookie },
      });

      expect(response.status).toBe(404);
    });
  });

  describe("adjusting a Multiplier", () => {
    it("prices the Outcomes an admin saved, and records which admin", async () => {
      const { id, cookie, bout, eventId } = await importedCard();
      const [winner, ...rest] = bout.outcomes;

      const response = await postJson(
        `/api/admin/bouts/${bout.id}/multipliers`,
        { multipliers: { [winner!.id]: 3.25 } },
        cookie,
      );

      expect(response.status).toBe(200);

      const stored = await boutOutcomes(bout.id);
      const priced = stored.find((outcome) => outcome.id === winner!.id);

      expect(priced).toMatchObject({ multiplier: 3.25, pricedBy: id });
      expect(priced?.pricedAt).toBeInstanceOf(Date);

      // The Outcomes that were not sent keep their seeded Multiplier, and stay
      // Outcomes nobody has priced.
      const untouched = stored.filter((outcome) => outcome.id !== winner!.id);

      expect(untouched.length).toBe(rest.length);
      expect(untouched.every((outcome) => outcome.pricedAt === null)).toBe(true);

      // Which is what the card still says about the Bout as a whole.
      const card = await cardToPrice(eventId, cookie);

      expect(card.bouts[0]?.priced).toBe(false);
    });

    it("refuses a Multiplier at or below 1, which pays a correct Prediction nothing", async () => {
      const { cookie, bout } = await importedCard();
      const winner = bout.outcomes[0]!;

      for (const refused of [1, 0.5, -3]) {
        const response = await postJson(
          `/api/admin/bouts/${bout.id}/multipliers`,
          { multipliers: { [winner.id]: refused } },
          cookie,
        );

        expect(response.status).toBe(422);
        expect((await response.json()).message).toBe(PRICING_MESSAGES.multiplier);
      }

      expect((await boutOutcomes(bout.id)).every((outcome) => outcome.multiplier > 1)).toBe(true);
    });

    it("refuses a Multiplier at or below 1 written by hand, too", async () => {
      const { bout } = await importedCard();

      const outcome = await testDatabase()
        .execute(sql`update outcomes set multiplier = 0.90 where bout_id = ${bout.id}::uuid`)
        .then(
          () => "stored it",
          (refusal: Error) => `${refusal.message} ${refusal.cause}`,
        );

      expect(outcome).toMatch(/outcomes_multiplier_pays/);
    });

    it("refuses a whole save when one Multiplier in it is not a price", async () => {
      const { cookie, bout } = await importedCard();
      const [winner, method] = bout.outcomes;

      const response = await postJson(
        `/api/admin/bouts/${bout.id}/multipliers`,
        { multipliers: { [winner!.id]: 3.25, [method!.id]: 0.5 } },
        cookie,
      );

      expect(response.status).toBe(422);

      // Not one of them written: a Bout priced in part reads as priced.
      expect((await boutOutcomes(bout.id)).every((outcome) => outcome.pricedAt === null)).toBe(
        true,
      );
    });

    it("refuses an Outcome that is not on that Bout", async () => {
      const { cookie, bout } = await importedCard();

      const response = await postJson(
        `/api/admin/bouts/${bout.id}/multipliers`,
        { multipliers: { "0f6d0f5a-2c0e-4b0a-9d51-6a0a3f0f9c11": 2.5 } },
        cookie,
      );

      expect(response.status).toBe(422);
      expect((await response.json()).message).toBe(PRICING_MESSAGES.notThisBout);
    });
  });

  describe("opening a Bout for predictions", () => {
    it("refuses a Bout with an Outcome nobody has priced", async () => {
      const { cookie, bout, eventId } = await importedCard();

      const response = await open(bout.id, cookie);

      expect(response.status).toBe(409);
      expect((await response.json()).message).toBe(PRICING_MESSAGES.unpriced);

      const [stillClosed] = await importedBouts(eventId);

      expect(stillClosed?.status).toBe("closed");
    });

    it("refuses a Bout priced all but one Outcome, which is the case that matters", async () => {
      const { cookie, bout } = await importedCard();
      const [, ...allButTheFirst] = bout.outcomes;

      await postJson(
        `/api/admin/bouts/${bout.id}/multipliers`,
        {
          multipliers: Object.fromEntries(
            allButTheFirst.map((outcome) => [outcome.id, 2.5] as const),
          ),
        },
        cookie,
      );

      const response = await open(bout.id, cookie);

      expect(response.status).toBe(409);
      expect((await response.json()).message).toBe(PRICING_MESSAGES.unpriced);
    });

    it("opens it once every Outcome on it has been priced", async () => {
      const { cookie, bout, eventId } = await importedCard();

      expect((await priceEveryOutcome(bout, cookie)).status).toBe(200);
      expect((await open(bout.id, cookie)).status).toBe(200);

      const card = await cardToPrice(eventId, cookie);

      expect(card.bouts[0]).toMatchObject({ status: "open", priced: true });
    });

    it("refuses to open a Bout that is already open", async () => {
      const { cookie, bout } = await importedCard();

      await priceEveryOutcome(bout, cookie);
      await open(bout.id, cookie);

      const response = await open(bout.id, cookie);

      expect(response.status).toBe(409);
      expect((await response.json()).message).toBe(PRICING_MESSAGES.alreadyOpen);
    });

    it("refuses an unpriced Bout even when the opening is written by hand", async () => {
      // The route asks first so that an admin is told which rule it was. This
      // is the rule: a mispriced Outcome is exploitable and nothing in
      // ADR-0002 self-corrects it, so the last thing between a seeded default
      // and a fan's Coins is somebody having looked at it.
      const { bout } = await importedCard();

      const outcome = await testDatabase()
        .execute(sql`update bouts set status = 'open' where id = ${bout.id}::uuid`)
        .then(
          () => "opened it",
          (refusal: Error) => `${refusal.message} ${refusal.cause}`,
        );

      expect(outcome).toMatch(/bouts_are_opened_only_when_priced/);
    });

    it("refuses a Bout inserted open, which is the same rule by the other door", async () => {
      // A Bout's Outcomes are written after it, so one born open has none at
      // all — and nothing that ever wanted a Multiplier on it.
      const { eventId } = await importedCard();

      const born = await testDatabase()
        .execute(
          sql`insert into bouts (event_id, card_order, status, red_name, blue_name, division,
                                 scheduled_rounds)
              values (${eventId}::uuid, 2, 'open', 'Zurab Kapanadze', 'Data Chigogidze',
                      'Lightweight', 3)`,
        )
        .then(
          () => "inserted it",
          (refusal: Error) => `${refusal.message} ${refusal.cause}`,
        );

      expect(born).toMatch(/bouts_are_opened_only_when_priced/);
    });
  });

  describe("what the card listing says at a glance", () => {
    it("counts the Bouts still to price and the ones already open", async () => {
      const signedIn = await admin();
      const imported = await importTestCard(signedIn.id, {
        bouts: [cardBout({ cardOrder: 1 }), cardBout({ cardOrder: 2, mainEvent: true })],
      });

      const before = await listedCards(signedIn.cookie);

      expect(before[0]?.imported).toMatchObject({ bouts: 2, unpriced: 2, open: 0 });

      const card = await cardToPrice(imported.id, signedIn.cookie);

      await priceEveryOutcome(card.bouts[0]!, signedIn.cookie);
      await open(card.bouts[0]!.id, signedIn.cookie);

      const after = await listedCards(signedIn.cookie);

      expect(after[0]?.imported).toMatchObject({ bouts: 2, unpriced: 1, open: 1 });
    });
  });

  describe("re-importing a priced card", () => {
    it("gives back a card to be priced again, because its Bouts are new rows", async () => {
      const { id, cookie, eventId, bout } = await importedCard();

      await priceEveryOutcome(bout, cookie);
      expect((await cardToPrice(eventId, cookie)).bouts[0]?.priced).toBe(true);

      // A lineup change pulled through: the Bout is replaced, and so are the
      // Multipliers that were hung off it (ADR-0002).
      await importTestCard(id, { bouts: [cardBout({ scheduledRounds: 5 })] });

      const repriced = await cardToPrice(eventId, cookie);

      expect(repriced.bouts[0]).toMatchObject({ priced: false, scheduledRounds: 5 });
      expect(repriced.bouts[0]?.outcomes.length).toBe(10);
    });
  });
});
