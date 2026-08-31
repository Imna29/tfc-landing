import { $fetch, fetch } from "@nuxt/test-utils/e2e";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import type { FightCard } from "../../shared/fightCard";
import {
  boutState,
  BOUT_STATE_LABELS,
  PREDICTION_MESSAGES,
  type CardPredictions,
} from "../../shared/predictions";
import { PRICING_MESSAGES } from "../../shared/pricing";
import type { CardBout } from "../../server/utils/cardImport";
import type { ImportedEvent } from "../../server/utils/events";
import type { CardToPrice } from "../../server/utils/pricing";
import { postJson, signUpAdmin } from "../helpers/accounts";
import { boutOutcomes, cardBout, corner, importedBouts, importTestCard } from "../helpers/cards";
import { testDatabase } from "../helpers/database";
import { setupTestServer } from "../helpers/server";
import { fanId } from "../helpers/users";

/**
 * A fight card in the game: pricing it, opening its Bouts, and the card a fan
 * reads once both are done.
 *
 * The first half is what ADR-0002 costs somebody at TFC in time. Multipliers
 * are fixed by hand, so every card has to be priced before it opens, forever.
 * What makes that payable is that import seeds every Outcome from a table, and
 * what keeps it honest is that a seeded number is not a price — a Bout nobody
 * has looked at cannot be opened, and Postgres is what says so rather than the
 * route that asks first.
 *
 * The second half is what all of that was for: the card a fan sees, which is
 * where a seeded number becomes a Multiplier somebody is weighing up. Both
 * halves are here rather than in a file of their own because they are the same
 * card, arranged the same way, and a second file would be a second Nuxt build
 * on every run.
 */
describe("a fight card in the game", async () => {
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

  describe("the card a fan reads", () => {
    /**
     * The public card, as the page asks for it.
     *
     * Typed from what the route answers with, for the same reason
     * {@link cardToPrice} is.
     */
    function publicCard() {
      return $fetch<{ card: FightCard | null; predictions: CardPredictions | null }>(
        "/api/predictions/card",
      );
    }

    /** The page itself, fetched the way a visitor with no account gets it. */
    function publicPage() {
      return $fetch<string>("/predictions");
    }

    /**
     * A card starting a given number of minutes from now.
     *
     * Relative rather than a fixed date: the upcoming Event is the next one,
     * so a card pinned to a day in 2026 would stop being upcoming on that day
     * and take this suite with it. Minutes into the past are how a card that
     * has already started is arranged — its first Bout has locked.
     */
    async function upcomingIn(minutes: number, bouts: CardBout[]) {
      const signedIn = await admin();
      const imported = await importTestCard(signedIn.id, {
        scheduledStart: new Date(Date.now() + minutes * 60_000),
        bouts,
      });

      return {
        ...signedIn,
        eventId: imported.id,
        card: await cardToPrice(imported.id, signedIn.cookie),
      };
    }

    it("says there is no card rather than showing an empty one", async () => {
      const { card, predictions } = await publicCard();

      expect(card).toBe(null);
      expect(predictions).toBe(null);
      expect(await publicPage()).toContain(PREDICTION_MESSAGES.noCard);
    });

    it("shows the upcoming Event with every Bout on it, in card order", async () => {
      const { card } = await upcomingIn(120, [
        cardBout({ cardOrder: 3, mainEvent: true }),
        cardBout({ cardOrder: 1 }),
        cardBout({ cardOrder: 2 }),
      ]);

      expect(card.bouts.length).toBe(3);

      const shown = await publicCard();

      expect(shown.card).toMatchObject({ title: "TFC 12", venue: "Tbilisi Sports Palace" });
      expect(shown.card?.bouts.map((bout) => bout.cardOrder)).toEqual([1, 2, 3]);
    });

    it("shows both fighters with their photos, records and profile pages", async () => {
      await upcomingIn(120, [cardBout()]);

      const { card } = await publicCard();

      expect(card?.bouts[0]?.red).toEqual({
        name: "Giorgi Tsiklauri",
        fighterUid: "giorgi-tsiklauri",
        imageUrl: "https://images.prismic.io/tfc/giorgi-tsiklauri.png",
        record: "12-3-0",
      });

      const page = await publicPage();

      expect(page).toContain("Giorgi Tsiklauri");
      expect(page).toContain("12-3-0");
      expect(page).toContain("https://images.prismic.io/tfc/giorgi-tsiklauri.png");
      // The research a fan does before predicting is on the fighter's own page.
      expect(page).toContain("/fighters/giorgi-tsiklauri");
    });

    it("shows a fallback name with no photo and nowhere to click", async () => {
      // A late replacement booked days before the card, who has no `fighter`
      // document yet. The Bout is predictable; the corner is a name.
      await upcomingIn(120, [
        cardBout({
          blue: corner("Zurab Kapanadze", {
            fighterId: null,
            fighterUid: null,
            imageUrl: null,
            record: null,
          }),
        }),
      ]);

      const { card } = await publicCard();

      expect(card?.bouts[0]?.blue).toEqual({
        name: "Zurab Kapanadze",
        fighterUid: null,
        imageUrl: null,
        record: null,
      });

      const page = await publicPage();

      // The name is on the card. The photo and the link are the two things a
      // corner only has when there is a document behind it, and the red corner
      // beside them is the control: both are rendered by the same component.
      expect(page).toContain("Zurab Kapanadze");
      expect(page).toContain(`alt="Giorgi Tsiklauri"`);
      expect(page).not.toContain(`alt="Zurab Kapanadze"`);
      expect(page).toContain("/fighters/giorgi-tsiklauri");
      expect(page).not.toContain("/fighters/zurab-kapanadze");
    });

    it("shows the weight class and how many rounds a Bout is scheduled for", async () => {
      await upcomingIn(120, [cardBout({ division: "Featherweight", scheduledRounds: 5 })]);

      const page = await publicPage();

      expect(page).toContain("Featherweight");
      expect(page).toMatch(/5 rounds/);
    });

    it("shows what every answer pays, once the Bout is open", async () => {
      const { cookie, card } = await upcomingIn(120, [cardBout({ scheduledRounds: 3 })]);
      const bout = card.bouts[0]!;

      await priceEveryOutcome(bout, cookie, 2.5);
      await open(bout.id, cookie);

      const shown = await publicCard();
      const offered = shown.predictions?.bouts[1];

      // The whole set, in the order they are asked: two winners, three
      // methods, and a round for each round scheduled.
      expect(
        offered?.outcomes.map((outcome) => [
          outcome.question,
          outcome.corner ?? outcome.method ?? outcome.round,
        ]),
      ).toEqual([
        ["winner", "red"],
        ["winner", "blue"],
        ["method", "ko_tko"],
        ["method", "submission"],
        ["method", "decision"],
        ["round", 1],
        ["round", 2],
        ["round", 3],
      ]);

      const page = await publicPage();

      expect(page).toContain("×2.50");
      expect(page).toMatch(/Method of victory/i);
      expect(page).toMatch(/Round 2/);
    });

    it("offers nothing on a Bout nobody has opened, because nothing on it is priced", async () => {
      // Every Outcome arrives seeded from a fixed table, and ADR-0002 is
      // emphatic that a seeded number is not a price: nothing that wrote it
      // knows which fighter is favoured. A Bout is open only once an admin has
      // been through it, so those are the only numbers a fan is ever shown.
      await upcomingIn(120, [cardBout()]);

      const { predictions } = await publicCard();

      expect(predictions?.bouts[1]).toMatchObject({ status: "closed", outcomes: [] });
      expect(await publicPage()).toContain(PREDICTION_MESSAGES.notOpenYet);
    });

    it("renders the whole fight with no Multiplier anywhere on it", async () => {
      // The half of the card that is not the game, rendered on its own. A
      // lineup is worth showing wherever one is — a marketing page, an archive
      // — and `app/components/FightCard.vue` takes what the game adds as an
      // optional prop for exactly that reason. This is as far as a running
      // server can carry that: a real card, rendered by the real component,
      // with not one number from the game on it.
      await upcomingIn(120, [
        cardBout({ cardOrder: 1, division: "Featherweight", scheduledRounds: 5 }),
      ]);

      const page = await publicPage();

      expect(page).toContain("Giorgi Tsiklauri");
      expect(page).toContain("Levan Beridze");
      expect(page).toContain("12-3-0");
      expect(page).toContain("Featherweight");
      expect(page).toMatch(/5 rounds/);
      expect(page).toContain("/fighters/giorgi-tsiklauri");

      // Nothing priced, so nothing paying: no Multiplier is rendered at all.
      expect(page).not.toMatch(/×\d/);
    });

    it("tells an open Bout from one that has locked", async () => {
      // The card started a minute ago: its first Bout locks automatically at
      // the scheduled start (ADR-0006) and the rest are still live, which is
      // the whole shape of a card being fought.
      const { cookie, card } = await upcomingIn(-1, [
        cardBout({ cardOrder: 1 }),
        cardBout({ cardOrder: 2, mainEvent: true }),
      ]);

      for (const bout of card.bouts) {
        await priceEveryOutcome(bout, cookie);
        await open(bout.id, cookie);
      }

      const { predictions } = await publicCard();
      const now = Date.parse(predictions!.answeredAt);

      expect(boutState(predictions!.bouts[1]!, now)).toBe("locked");
      expect(boutState(predictions!.bouts[2]!, now)).toBe("open");

      const page = await publicPage();

      expect(page).toContain(BOUT_STATE_LABELS.locked);
      expect(page).toContain(BOUT_STATE_LABELS.open);
    });

    it("counts down to the Lock on the Bout that locks by itself", async () => {
      const { cookie, card } = await upcomingIn(120, [
        cardBout({ cardOrder: 1 }),
        cardBout({ cardOrder: 2, mainEvent: true }),
      ]);

      for (const bout of card.bouts) {
        await priceEveryOutcome(bout, cookie);
        await open(bout.id, cookie);
      }

      const { card: shown, predictions } = await publicCard();

      // Only the Bout fought first has a Lock a fan can be counted down to.
      // An admin advances the rest as the card progresses, so a countdown on
      // them would be a promise the game does not make.
      expect(predictions?.bouts[1]?.locksAt).toBe(shown?.scheduledStart);
      expect(predictions?.bouts[2]?.locksAt).toBe(null);

      const page = await publicPage();

      expect(page).toMatch(/Locks in/);
      expect(page).toContain(PREDICTION_MESSAGES.locksWhenReached);
    });

    it("shows the whole card to a visitor with no account", async () => {
      // A visitor should be able to see the game before deciding to join it,
      // so nothing here asks who is asking.
      const { cookie, card } = await upcomingIn(120, [cardBout()]);

      await priceEveryOutcome(card.bouts[0]!, cookie, 1.9);
      await open(card.bouts[0]!.id, cookie);

      const response = await fetch("/predictions");
      const page = await response.text();

      expect(response.status).toBe(200);
      expect(page).toContain("Giorgi Tsiklauri");
      expect(page).toContain("Levan Beridze");
      expect(page).toContain("×1.90");
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
