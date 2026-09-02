import { $fetch, fetch } from "@nuxt/test-utils/e2e";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { CONSOLE_MESSAGES, nextToLock, type LockConsole } from "../../shared/console";
import type { FightCard } from "../../shared/fightCard";
import { LOCK_KIND_LABELS, LOCK_MESSAGES, SWEEP_AFTER } from "../../shared/locks";
import {
  boutState,
  BOUT_STATE_LABELS,
  PREDICTION_MESSAGES,
  type CardPredictions,
} from "../../shared/predictions";
import { METHOD_LABELS, PRICING_MESSAGES, QUESTION_LABELS } from "../../shared/pricing";
import type { CardBout } from "../../server/utils/cardImport";
import type { ImportedEvent } from "../../server/utils/events";
import {
  applyAutomaticLocks,
  A_LOCKED_BOUT_IS_NEVER_REOPENED,
  BOUT_LOCKS_ARE_APPEND_ONLY,
  lockBout,
  LOCKED_BOUTS_ARE_RECORDED,
} from "../../server/utils/locks";
import type { CardToPrice } from "../../server/utils/pricing";
import { postJson, signUpAdmin } from "../helpers/accounts";
import {
  boutOutcomes,
  card,
  cardBout,
  corner,
  importedBouts,
  importTestCard,
} from "../helpers/cards";
import { testDatabase } from "../helpers/database";
import { setupTestServer } from "../helpers/server";
import { fanId } from "../helpers/users";

/**
 * A fight card in the game, from both sides: pricing it, opening its Bouts,
 * locking them again as it is fought, and the card a fan reads throughout.
 *
 * The first part is what ADR-0002 costs somebody at TFC in time. Multipliers
 * are fixed by hand, so every card has to be priced before it opens, forever.
 * What makes that payable is that import seeds every Outcome from a table, and
 * what keeps it honest is that a seeded number is not a price — a Bout nobody
 * has looked at cannot be opened, and Postgres is what says so rather than the
 * route that asks first.
 *
 * The second is what ADR-0006 costs somebody in attention: Bouts lock one at a
 * time as a card is fought, by an admin who is also watching it. The backstops
 * behind that person are the point of those cases — an admin who forgets is
 * the expected case, not the exceptional one.
 *
 * The third is what all of it was for: the card a fan sees, which is where a
 * seeded number becomes a Multiplier somebody is weighing up. All three are
 * here rather than in files of their own because they are the same card,
 * arranged the same way, and each file is a second Nuxt build on every run.
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
    const { cards } = await $fetch<{
      cards: { prismicId: string; imported: ImportedEvent | null }[];
    }>("/api/admin/events", { headers: { cookie } });

    return cards;
  }

  /**
   * The test card's row in that listing, found by the document it came from.
   *
   * Deliberately not the first row. The listing is every card in Prismic with
   * whatever the game holds for it, and the test card is not one of them — it
   * is imported straight into Postgres, so it is listed among the cards that
   * are in the game and no longer in Prismic, after however many the live
   * repository happens to be holding.
   */
  async function listedTestCard(cookie: string) {
    return (await listedCards(cookie)).find((listed) => listed.prismicId === card().prismicId);
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

  /** What a Bout's rounds were seeded at, in the order they are fought. */
  async function seededRounds(boutId: string) {
    const stored = await boutOutcomes(boutId);

    return stored
      .filter((outcome) => outcome.question === "round")
      .map((outcome) => outcome.multiplier);
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
    /** A card of both formats TFC books: a three-round opener, a five-round headliner. */
    async function importedFormats() {
      const { id } = await admin();

      const imported = await importTestCard(id, {
        bouts: [
          cardBout({ cardOrder: 1, scheduledRounds: 3 }),
          cardBout({ cardOrder: 2, scheduledRounds: 5, mainEvent: true }),
        ],
      });

      const [threeRounder, fiveRounder] = await importedBouts(imported.id);

      return { threeRounder: threeRounder!, fiveRounder: fiveRounder! };
    }

    it("seeds a Multiplier on every Outcome of every Bout, priced by nobody", async () => {
      const { threeRounder, fiveRounder } = await importedFormats();

      // Two winners, three methods, and a round for each round scheduled.
      const opener = await boutOutcomes(threeRounder.id);
      const headliner = await boutOutcomes(fiveRounder.id);

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

    it("seeds a three-round Bout's rounds from a different row than a five-round Bout's", async () => {
      const { threeRounder, fiveRounder } = await importedFormats();

      // Round 3 is the last round of the opener and a middle round of the
      // headliner, so it is not the same question and is not seeded the same.
      expect(await seededRounds(threeRounder.id)).toEqual([3.15, 4.75, 5.7]);
      expect(await seededRounds(fiveRounder.id)).toEqual([3.75, 5.95, 8.9, 11.85, 14.25]);
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

  describe("locking a Bout as a card is fought", () => {
    /** Locks a Bout, as the button does and as #20's console will. */
    function lock(boutId: string, cookie: string) {
      return postJson(`/api/admin/bouts/${boutId}/lock`, {}, cookie);
    }

    /**
     * A card priced and open, starting a given number of minutes from now.
     *
     * Minutes into the past are how a card being fought is arranged: its first
     * Bout is past the moment it locks at, and the rest are what an admin is
     * advancing the Lock through. Relative rather than a fixed date, for the
     * reason `upcomingIn` below gives.
     */
    async function liveCard(minutes: number, bouts: CardBout[]) {
      const signedIn = await admin();
      const scheduledStart = new Date(Date.now() + minutes * 60_000);
      const imported = await importTestCard(signedIn.id, { scheduledStart, bouts });
      const priced = await cardToPrice(imported.id, signedIn.cookie);

      for (const bout of priced.bouts) {
        await priceEveryOutcome(bout, signedIn.cookie);
        await open(bout.id, signedIn.cookie);
      }

      return { ...signedIn, eventId: imported.id, scheduledStart };
    }

    /** Every Bout of the card as the admin area reads it, in card order. */
    async function asAdminSeesIt(eventId: string, cookie: string) {
      return (await cardToPrice(eventId, cookie)).bouts;
    }

    const twoBouts = [cardBout({ cardOrder: 1 }), cardBout({ cardOrder: 2, mainEvent: true })];

    it("locks the Bout fought first when the card reaches its scheduled start", async () => {
      // The first of the three backstops ADR-0006 calls mandatory. Nobody
      // presses anything: the card starts, and the Bout being fought stops
      // taking Predictions.
      const { cookie, eventId, scheduledStart } = await liveCard(-1, twoBouts);

      const [opener, headliner] = await asAdminSeesIt(eventId, cookie);

      expect(opener).toMatchObject({
        status: "locked",
        lock: { kind: "scheduled", at: scheduledStart.toISOString(), by: null },
      });

      // And only that one: keeping the rest open while it is being fought is
      // the engagement case for the whole product.
      expect(headliner).toMatchObject({ status: "open", lock: null });
    });

    it("dates an automatic Lock at the moment it fell due, not the moment it ran", async () => {
      // "When a fan complains their Bout locked too early, that log is the
      // answer." Nothing writes the row until a request arrives, which may be
      // hours later; dating it then would answer a fan with a moment that has
      // nothing to do with them.
      const { cookie, eventId, scheduledStart } = await liveCard(-90, twoBouts);

      const [opener] = await asAdminSeesIt(eventId, cookie);

      expect(opener?.lock?.at).toBe(scheduledStart.toISOString());
    });

    it("lets an admin lock one Bout early and leaves the rest of the card open", async () => {
      // A fighter withdrew from the main event two hours out. That Bout stops
      // taking Predictions; nothing else on the card is affected.
      const { cookie, details, eventId } = await liveCard(120, twoBouts);
      const [, headliner] = await asAdminSeesIt(eventId, cookie);

      expect((await lock(headliner!.id, cookie)).status).toBe(200);

      const [opener, locked] = await asAdminSeesIt(eventId, cookie);

      expect(locked).toMatchObject({
        status: "locked",
        lock: { kind: "manual", by: details.username },
      });
      expect(opener).toMatchObject({ status: "open", lock: null });
    });

    it("advances the Lock down the card, one Bout at a time", async () => {
      // The ordinary shape of a live event: the card has started, its opener
      // locked by itself, and an admin closes each fight as it comes up.
      const { cookie, eventId } = await liveCard(-1, [
        cardBout({ cardOrder: 1 }),
        cardBout({ cardOrder: 2 }),
        cardBout({ cardOrder: 3, mainEvent: true }),
      ]);

      const [, second] = await asAdminSeesIt(eventId, cookie);

      expect((await lock(second!.id, cookie)).status).toBe(200);

      expect((await asAdminSeesIt(eventId, cookie)).map((bout) => bout.status)).toEqual([
        "locked",
        "locked",
        "open",
      ]);
    });

    it("refuses a second press, so a double tap does not lock the next fight", async () => {
      // #20's console is used one-handed in a dark arena. The control names a
      // Bout, so pressing it twice asks twice about the same Bout — and the
      // second press is told it has locked rather than closing the next fight.
      const { cookie, eventId } = await liveCard(120, twoBouts);
      const [opener] = await asAdminSeesIt(eventId, cookie);

      expect((await lock(opener!.id, cookie)).status).toBe(200);

      const again = await lock(opener!.id, cookie);

      expect(again.status).toBe(409);
      expect((await again.json()).message).toBe(LOCK_MESSAGES.alreadyLocked);
      expect((await asAdminSeesIt(eventId, cookie))[1]).toMatchObject({ status: "open" });
    });

    it("refuses to lock a Bout nobody has opened", async () => {
      const { cookie, bout } = await importedCard();

      const response = await lock(bout.id, cookie);

      expect(response.status).toBe(409);
      expect((await response.json()).message).toBe(LOCK_MESSAGES.notOpen);
    });

    it("refuses a Bout that is not on a card, and one that is not an id at all", async () => {
      const { cookie } = await importedCard();

      expect((await lock("2fd25b0a-2f9e-4a06-9d4a-30d6d1c4a1f0", cookie)).status).toBe(404);
      expect((await lock("the main event", cookie)).status).toBe(404);
    });

    it("locks everything still open once the card's backstop passes", async () => {
      // The last backstop, and the one that says an admin stopped advancing
      // the Lock partway through an evening. Seven hours past the start is
      // past the six the window defaults to.
      const { cookie, eventId, scheduledStart } = await liveCard(-7 * 60, [
        cardBout({ cardOrder: 1 }),
        cardBout({ cardOrder: 2 }),
        cardBout({ cardOrder: 3, mainEvent: true }),
      ]);

      const card = await asAdminSeesIt(eventId, cookie);

      expect(card.map((bout) => bout.lock?.kind)).toEqual(["scheduled", "sweep", "sweep"]);
      expect(card.every((bout) => bout.status === "locked")).toBe(true);

      // Dated six hours after the card started, whatever time it is now.
      expect(card[1]?.lock?.at).toBe(
        new Date(scheduledStart.getTime() + SWEEP_AFTER).toISOString(),
      );
      expect(card.every((bout) => bout.lock?.by === null)).toBe(true);
    });

    it("takes that window from configuration, so TFC can shorten it", async () => {
      // Asked of the sweep itself rather than through the API, because the
      // server under test was handed its environment when it booted and this
      // is what a shorter window would actually change.
      const { cookie, eventId, scheduledStart } = await liveCard(-40, twoBouts);

      process.env.LOCK_SWEEP_HOURS = "0.5";

      const locked = await applyAutomaticLocks(new Date(), testDatabase()).finally(() => {
        delete process.env.LOCK_SWEEP_HOURS;
      });

      // Both: the card started forty minutes ago, so the opener was due at the
      // start and the headliner thirty minutes after it.
      expect(locked.map((bout) => bout.kind).sort()).toEqual(["scheduled", "sweep"]);

      expect((await asAdminSeesIt(eventId, cookie))[1]).toMatchObject({
        status: "locked",
        lock: {
          kind: "sweep",
          at: new Date(scheduledStart.getTime() + 30 * 60_000).toISOString(),
        },
      });
    });

    it("locks a Bout from inside a transaction, which is how a result will", async () => {
      // Nothing enters a result yet — that is #14 — so this is the seam and
      // not the whole criterion. What it proves is the part #12 owes: a Lock
      // can be taken inside somebody else's transaction, so that #14 can grade
      // every Entry, move the Coins and close the Bout together or not at all.
      // A result entered with the Bout still taking Predictions is the gap the
      // backstops exist for, and one somebody could commit Coins into knowing
      // the answer.
      const { cookie, details, eventId, id } = await liveCard(120, twoBouts);
      const [opener] = await asAdminSeesIt(eventId, cookie);

      const locked = await testDatabase().transaction((tx) =>
        lockBout(tx, { boutId: opener!.id, kind: "result", by: id }),
      );

      expect(locked).toBe(true);
      expect((await asAdminSeesIt(eventId, cookie))[0]).toMatchObject({
        status: "locked",
        lock: { kind: "result", by: details.username },
      });
    });

    it("never reopens a Bout that has locked, through the route that opens one", async () => {
      const { cookie, eventId } = await liveCard(120, twoBouts);
      const [opener] = await asAdminSeesIt(eventId, cookie);

      await lock(opener!.id, cookie);

      const response = await open(opener!.id, cookie);

      expect(response.status).toBe(409);
      expect((await response.json()).message).toBe(LOCK_MESSAGES.alreadyLocked);
    });

    it("never reopens one written by hand either", async () => {
      // The rule with the most riding on it after `predictions_are_made_on_open_bouts`:
      // a Bout reopened after being fought is a Bout somebody can commit Coins
      // to knowing how it went.
      const { cookie, eventId } = await liveCard(120, twoBouts);
      const [opener] = await asAdminSeesIt(eventId, cookie);

      await lock(opener!.id, cookie);

      const reopened = await testDatabase()
        .execute(sql`update bouts set status = 'open' where id = ${opener!.id}::uuid`)
        .then(
          () => "reopened it",
          (refusal: Error) => `${refusal.message} ${refusal.cause}`,
        );

      expect(reopened).toContain(A_LOCKED_BOUT_IS_NEVER_REOPENED);
    });

    it("refuses a Lock nobody recorded, even written by hand", async () => {
      // The audit log is not left to whichever statement locks a Bout to
      // remember: the Bout a fan complains about is exactly the one whose row
      // somebody forgot to write.
      const { cookie, eventId } = await liveCard(120, twoBouts);
      const [opener] = await asAdminSeesIt(eventId, cookie);

      const unrecorded = await testDatabase()
        .execute(sql`update bouts set status = 'locked' where id = ${opener!.id}::uuid`)
        .then(
          () => "locked it",
          (refusal: Error) => `${refusal.message} ${refusal.cause}`,
        );

      expect(unrecorded).toContain(LOCKED_BOUTS_ARE_RECORDED);
    });

    it("refuses a record of a Lock that did not happen", async () => {
      const { cookie, eventId } = await liveCard(120, twoBouts);
      const [opener] = await asAdminSeesIt(eventId, cookie);

      const invented = await testDatabase()
        .execute(sql`insert into bout_locks (bout_id, kind) values (${opener!.id}::uuid, 'sweep')`)
        .then(
          () => "wrote it",
          (refusal: Error) => `${refusal.message} ${refusal.cause}`,
        );

      expect(invented).toContain(LOCKED_BOUTS_ARE_RECORDED);
    });

    it("refuses to rewrite the log afterwards", async () => {
      // A log somebody can tidy up answers nothing, which is the reason
      // ADR-0003 gives about the Coin ledger.
      const { cookie, eventId } = await liveCard(120, twoBouts);
      const [opener] = await asAdminSeesIt(eventId, cookie);

      await lock(opener!.id, cookie);

      const erased = await testDatabase()
        .execute(sql`delete from bout_locks where bout_id = ${opener!.id}::uuid`)
        .then(
          () => "erased it",
          (refusal: Error) => `${refusal.message} ${refusal.cause}`,
        );

      expect(erased).toContain(BOUT_LOCKS_ARE_APPEND_ONLY);
    });

    it("shows an admin how each Bout came to be locked, and when", async () => {
      // The log where the question is asked: down the card, after the event,
      // with a fan's complaint in hand.
      const { cookie, details, eventId } = await liveCard(-1, twoBouts);
      const [, headliner] = await asAdminSeesIt(eventId, cookie);

      await lock(headliner!.id, cookie);

      const page = await $fetch<string>(`/admin/events/${eventId}`, { headers: { cookie } });

      expect(page).toContain(LOCK_KIND_LABELS.scheduled);
      expect(page).toContain(LOCK_KIND_LABELS.manual);
      expect(page).toContain(details.username);
    });

    it("tells a fan a locked Bout has locked", async () => {
      const { cookie, eventId } = await liveCard(120, twoBouts);
      const [opener] = await asAdminSeesIt(eventId, cookie);

      await lock(opener!.id, cookie);

      const { predictions } = await $fetch<{ predictions: CardPredictions | null }>(
        "/api/predictions/card",
      );

      expect(predictions?.bouts[1]?.status).toBe("locked");
      expect(await $fetch<string>("/predictions")).toContain(BOUT_STATE_LABELS.locked);
    });

    /**
     * The screen an admin actually uses cageside: the card being fought, in the
     * order it is being fought, with one control on it.
     *
     * Here rather than in a file of its own because it is the same card
     * arranged the same way — and because it is the same capability as the
     * cases above, seen from the phone rather than from the desk. What the
     * console adds to `POST /api/admin/bouts/[id]/lock` is knowing which Bout
     * that is without an admin reading a form to work it out.
     */
    describe("the live lock console", () => {
      /**
       * The console as the page asks for it, or nothing when no card is being
       * fought. Typed from what the route answers with, for the same reason
       * {@link cardToPrice} is.
       */
      function liveConsole(cookie: string) {
        return $fetch<{ card: LockConsole | null }>("/api/admin/console", { headers: { cookie } });
      }

      /** Three fights with three different pairs of names, so a control that
       * names one is unmistakably about it. */
      const threeBouts = [
        cardBout({ cardOrder: 1 }),
        cardBout({
          cardOrder: 2,
          red: corner("Zurab Kapanadze"),
          blue: corner("Irakli Nadiradze"),
        }),
        cardBout({
          cardOrder: 3,
          mainEvent: true,
          red: corner("Davit Chkheidze"),
          blue: corner("Sandro Gogia"),
        }),
      ];

      it("lists the card being fought in card order, with where each Bout has got to", async () => {
        // A minute past the scheduled start: the opener has locked by itself,
        // nobody having pressed anything, and the rest of the card is what the
        // admin is about to advance the Lock through.
        const { cookie, eventId, scheduledStart } = await liveCard(-1, threeBouts);

        const { card } = await liveConsole(cookie);

        expect(card).toMatchObject({
          eventId,
          title: "TFC 12",
          venue: "Tbilisi Sports Palace",
          scheduledStart: scheduledStart.toISOString(),
        });
        expect(card?.bouts.map((bout) => [bout.cardOrder, bout.status])).toEqual([
          [1, "locked"],
          [2, "open"],
          [3, "open"],
        ]);
        expect(card?.bouts[2]).toMatchObject({
          redName: "Davit Chkheidze",
          blueName: "Sandro Gogia",
          mainEvent: true,
        });
      });

      it("carries what the one control is decided from, and moves it down the card", async () => {
        const { cookie, eventId } = await liveCard(-1, threeBouts);

        const before = await liveConsole(cookie);

        expect(nextToLock(before.card!.bouts, Date.parse(before.card!.answeredAt))).toMatchObject({
          cardOrder: 2,
          redName: "Zurab Kapanadze",
        });

        const [, second] = await asAdminSeesIt(eventId, cookie);

        await lock(second!.id, cookie);

        const after = await liveConsole(cookie);

        expect(nextToLock(after.card!.bouts, Date.parse(after.card!.answeredAt))).toMatchObject({
          cardOrder: 3,
        });
      });

      it("says which Bouts locked themselves, and which an admin locked", async () => {
        const { cookie, details, eventId, scheduledStart } = await liveCard(-1, threeBouts);
        const [, second] = await asAdminSeesIt(eventId, cookie);

        await lock(second!.id, cookie);

        const { card } = await liveConsole(cookie);

        // The audit log where the locking happens: an admin who looked away
        // for two fights reads what closed behind them and what closed it.
        expect(card?.bouts[0]?.lock).toEqual({
          kind: "scheduled",
          at: scheduledStart.toISOString(),
          by: null,
        });
        expect(card?.bouts[1]?.lock).toMatchObject({ kind: "manual", by: details.username });
        expect(card?.bouts[2]?.lock).toBe(null);
      });

      it("carries the moment everything still open locks regardless", async () => {
        const { cookie, scheduledStart } = await liveCard(-1, threeBouts);
        const sweep = new Date(scheduledStart.getTime() + SWEEP_AFTER).toISOString();

        const { card } = await liveConsole(cookie);

        expect(card?.sweepAt).toBe(sweep);

        // And each Bout's own moment with it: the opener locks when the card
        // starts, and everything behind it at the backstop.
        expect(card?.bouts.map((bout) => bout.locksAt)).toEqual([
          scheduledStart.toISOString(),
          sweep,
          sweep,
        ]);
      });

      it("says there is no card being fought rather than showing an empty one", async () => {
        const { cookie } = await admin();

        expect((await liveConsole(cookie)).card).toBe(null);
      });

      it("leaves a card behind once the backstop has closed everything on it", async () => {
        // Seven hours past the start, which is past the six the window
        // defaults to: every Bout on it has locked and none of them can ever
        // reopen, so there is nothing left on that card for this screen to do.
        const { cookie } = await liveCard(-7 * 60, threeBouts);

        expect((await liveConsole(cookie)).card).toBe(null);
      });

      /** The console itself, fetched the way an admin's phone gets it. */
      function consolePage(cookie: string) {
        return $fetch<string>("/admin/console", { headers: { cookie } });
      }

      it("puts one control on the screen, about the fight being locked next", async () => {
        const { cookie } = await liveCard(-1, threeBouts);

        const page = await consolePage(cookie);

        // Unambiguous is the acceptance criterion, and ambiguity in a dark
        // arena is an admin locking the wrong fight. The opener has locked and
        // the main event is two fights away; only Bout 2 is offered.
        expect(page).toContain(CONSOLE_MESSAGES.lock(2));
        expect(page).not.toContain(CONSOLE_MESSAGES.lock(1));
        expect(page).not.toContain(CONSOLE_MESSAGES.lock(3));

        // Named by the fight rather than only by its place, because the place
        // is what an admin is least sure of between two rounds.
        expect(page).toContain("Zurab Kapanadze");
        expect(page).toContain("Irakli Nadiradze");
      });

      it("lists every Bout on the card, in the order they are fought", async () => {
        const { cookie } = await liveCard(-1, threeBouts);

        const page = await consolePage(cookie);
        // The places as the list writes them, `>Bout 2<`, which is not how the
        // control at the bottom writes the one it is about: `>Lock Bout 2<`.
        const places = [...page.matchAll(/>Bout (\d)</g)].map((found) => found[1]);

        expect(places).toEqual(["1", "2", "3"]);
        expect(page).toContain("Davit Chkheidze");
      });

      it("says on the page which Bouts locked themselves, and which an admin did", async () => {
        const { cookie, details, eventId } = await liveCard(-1, threeBouts);
        const [, second] = await asAdminSeesIt(eventId, cookie);

        await lock(second!.id, cookie);

        const page = await consolePage(cookie);

        expect(page).toContain(LOCK_KIND_LABELS.scheduled);
        expect(page).toContain(LOCK_KIND_LABELS.manual);
        expect(page).toContain(details.username);
      });

      it("shows how long is left before the backstop closes the card", async () => {
        const { cookie } = await liveCard(-1, threeBouts);

        const page = await consolePage(cookie);

        expect(page).toContain(CONSOLE_MESSAGES.sweep);
        // Six hours less the minute the card has been running, as a clock.
        expect(page).toMatch(/5:5\d:\d\d/);
      });

      it("asks twice before the card has started, where a Lock is not a reflex", async () => {
        // The console is armed by the card rather than by an admin remembering
        // which of two screens they are looking at. Two hours out, the same
        // control is offering to close a fight nobody is fighting — and a Lock
        // is never taken back.
        const { cookie } = await liveCard(120, threeBouts);

        const page = await consolePage(cookie);

        expect(page).toContain(CONSOLE_MESSAGES.lockEarly(1));
        expect(page).toContain(CONSOLE_MESSAGES.early);
      });

      it("says there is no card being fought rather than showing an empty console", async () => {
        const { cookie } = await admin();

        expect(await consolePage(cookie)).toContain(CONSOLE_MESSAGES.noCard);
      });

      it("says so, rather than offering a control, once the whole card has locked", async () => {
        const { cookie, eventId } = await liveCard(-1, threeBouts);
        const [, second, headliner] = await asAdminSeesIt(eventId, cookie);

        await lock(second!.id, cookie);
        await lock(headliner!.id, cookie);

        const page = await consolePage(cookie);

        expect(page).toContain(CONSOLE_MESSAGES.everythingLocked);
        expect(page).not.toContain(CONSOLE_MESSAGES.lock(3));
      });

      it("is one tap from the admin index, since it is reached mid-event", async () => {
        const { cookie } = await admin();

        expect(await $fetch<string>("/admin", { headers: { cookie } })).toContain("/admin/console");
      });
    });
  });

  describe("what the card listing says at a glance", () => {
    it("counts the Bouts still to price, the open ones and the locked ones", async () => {
      const signedIn = await admin();
      const imported = await importTestCard(signedIn.id, {
        bouts: [cardBout({ cardOrder: 1 }), cardBout({ cardOrder: 2, mainEvent: true })],
      });

      const before = await listedTestCard(signedIn.cookie);

      expect(before?.imported).toMatchObject({
        bouts: 2,
        unpriced: 2,
        open: 0,
        locked: 0,
        opened: 0,
      });

      const card = await cardToPrice(imported.id, signedIn.cookie);

      await priceEveryOutcome(card.bouts[0]!, signedIn.cookie);
      await open(card.bouts[0]!.id, signedIn.cookie);

      const after = await listedTestCard(signedIn.cookie);

      expect(after?.imported).toMatchObject({ bouts: 2, unpriced: 1, open: 1, locked: 0 });

      await postJson(`/api/admin/bouts/${card.bouts[0]!.id}/lock`, {}, signedIn.cookie);

      const fought = await listedTestCard(signedIn.cookie);

      // A locked Bout is no longer open, and still shuts the door on a
      // re-import: fans hold Coins against it whatever it is doing now.
      expect(fought?.imported).toMatchObject({ open: 0, locked: 1, opened: 1 });
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

      // Every Outcome is offered by the route above; the card renders the
      // Questions in `OFFERED_QUESTIONS`, which is the winner and the method
      // until #34 stands the round up. The round is priced, stored and simply
      // not on the card yet.
      expect(page).toContain("×2.50");
      expect(page).toContain(QUESTION_LABELS.winner);
      expect(page).toContain(QUESTION_LABELS.method);
      expect(page).toContain(METHOD_LABELS.submission);
      expect(page).not.toMatch(/Round 2/);
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
