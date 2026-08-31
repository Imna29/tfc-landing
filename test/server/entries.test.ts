import { $fetch, fetch } from "@nuxt/test-utils/e2e";
import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { STARTING_BALANCE } from "../../shared/coins";
import {
  COMBINED_MULTIPLIER_CAP,
  ENTRY_MESSAGES,
  ENTRY_PREDICTIONS,
  potentialReward,
} from "../../shared/entries";
import {
  balanceCache,
  boutLocks,
  bouts,
  coinTransactions,
  entries,
  predictions,
} from "../../server/db/schema";
import type { SubmittedEntry } from "../../server/utils/entries";
import { postJson, signUp } from "../helpers/accounts";
import {
  adminWithASeason,
  cardBout,
  cardInTheGame,
  priceBout,
  type CardInTheGame,
} from "../helpers/cards";
import { testDatabase } from "../helpers/database";
import { setupTestServer } from "../helpers/server";
import { confirmEmail, fanId } from "../helpers/users";

/**
 * Submitting an Entry: the core of the product, and where every validation
 * rule in it lands.
 *
 * A file of its own rather than more cases in `test/server/bouts.test.ts`,
 * which costs a second Nuxt build on every run. What buys it is that this is a
 * different subject — that file is a card being prepared and read, this is
 * Coins leaving a Balance — and that the failures here are the ones the whole
 * spec says to weigh the suite towards: an Entry that half-commits, a Bout
 * predictable while it is being fought, a fan charged for Coins they do not
 * hold. They are worth reading together.
 *
 * Driven through the API, because that is the seam. The exceptions are all the
 * same exception: some of these rules are held by Postgres and not only by the
 * route, and a test that only asked the API would prove the route behaves
 * rather than that the rule holds. Those cases say so where they are.
 */
describe("submitting an Entry", async () => {
  await setupTestServer();

  /** A fan who can play: a Season's Coins, and a confirmed address. */
  async function fanWithCoins() {
    const signedUp = await signUp();

    await confirmEmail(signedUp.details.email);

    return { ...signedUp, id: await fanId(signedUp.details.email) };
  }

  /** Submits an Entry the way the panel on the card does. */
  function submit(entry: { amount: number; predictions: unknown[] }, cookie?: string) {
    return postJson("/api/predictions/entries", entry, cookie);
  }

  /** The Entry the game accepted, out of a response that accepted one. */
  async function accepted(response: Response) {
    expect(response.status).toBe(201);

    return (await response.json()) as { entry: SubmittedEntry; balance: number };
  }

  /** A winner pick on one Bout of a card, which is the simplest Prediction. */
  function winner(card: CardInTheGame, place = 0, corner: "red" | "blue" = "red") {
    return { boutId: card.bouts[place]!.id, corner };
  }

  /** What the site header would show this fan. */
  function balance(cookie: string) {
    return $fetch<{ balance: number | null }>("/api/coins/balance", { headers: { cookie } });
  }

  /** Every Entry this fan has, newest last. */
  function entriesOf(userId: string) {
    return testDatabase()
      .select()
      .from(entries)
      .where(eq(entries.userId, userId))
      .orderBy(entries.submittedAt);
  }

  /** The Predictions an Entry holds, as they were written. */
  function predictionsIn(entryId: string) {
    return testDatabase().select().from(predictions).where(eq(predictions.entryId, entryId));
  }

  /** Every Coin Transaction written about a fan, oldest first. */
  function ledgerFor(userId: string) {
    return testDatabase()
      .select()
      .from(coinTransactions)
      .where(eq(coinTransactions.userId, userId))
      .orderBy(coinTransactions.createdAt);
  }

  /** A card two hours out, which is a card every Bout on is still open. */
  function upcomingCard(options: Parameters<typeof cardInTheGame>[0] = {}) {
    return cardInTheGame({ scheduledStart: new Date(Date.now() + 120 * 60_000), ...options });
  }

  describe("a fan committing Coins to what they think will happen", () => {
    it("takes a winner, and answers with what the Entry returns", async () => {
      const card = await upcomingCard();
      const fan = await fanWithCoins();

      const { entry, balance: left } = await accepted(
        await submit({ amount: 20, predictions: [winner(card)] }, fan.cookie),
      );

      // The winner Outcome pays ×2, so 20 Coins return 40.
      expect(entry).toMatchObject({ amount: 20, multiplier: 2, capped: false, reward: 40 });
      expect(entry.predictions).toEqual([
        {
          boutId: card.bouts[0]!.id,
          cardOrder: 1,
          corner: "red",
          method: null,
          round: null,
          multiplier: 2,
        },
      ]);

      // The Coins left the Balance at submission, not at settlement.
      expect(left).toBe(STARTING_BALANCE - 20);
      expect(await balance(fan.cookie)).toMatchObject({ balance: STARTING_BALANCE - 20 });
    });

    it("records the commitment in the ledger, pointing at the Entry that caused it", async () => {
      const card = await upcomingCard();
      const fan = await fanWithCoins();

      const { entry } = await accepted(
        await submit({ amount: 30, predictions: [winner(card)] }, fan.cookie),
      );

      const [grant, commitment] = await ledgerFor(fan.id);

      expect(grant).toMatchObject({ kind: "season_grant", amount: STARTING_BALANCE });
      expect(commitment).toMatchObject({
        kind: "entry_commitment",
        amount: -30,
        cause: "entry",
        causeId: entry.id,
      });
      expect(commitment?.reason).toMatch(/Entry of 1 Prediction/);
    });

    it("deepens a Prediction with a method and a round", async () => {
      const card = await upcomingCard();
      const fan = await fanWithCoins();

      const { entry } = await accepted(
        await submit(
          {
            amount: 10,
            predictions: [{ ...winner(card), method: "ko_tko", round: 2 }],
          },
          fan.cookie,
        ),
      );

      // ×2 for the winner, ×2.5 for the method and ×3 for the round, which
      // multiply onto the winner rather than chaining beside it (ADR-0004).
      expect(entry).toMatchObject({ multiplier: 15, reward: 150 });
      expect(entry.predictions[0]).toMatchObject({ method: "ko_tko", round: 2, multiplier: 15 });

      // Each answer's Multiplier is frozen separately, because a
      // disqualification settles the winner and leaves the rest ungradable.
      const [written] = await predictionsIn(entry.id);

      expect(written).toMatchObject({
        corner: "red",
        method: "ko_tko",
        round: 2,
        winnerMultiplier: 2,
        methodMultiplier: 2.5,
        roundMultiplier: 3,
      });
    });

    it("chains Predictions across different Bouts into one Entry", async () => {
      const card = await upcomingCard({
        bouts: [cardBout({ cardOrder: 1 }), cardBout({ cardOrder: 2, mainEvent: true })],
      });
      const fan = await fanWithCoins();

      const { entry } = await accepted(
        await submit(
          { amount: 20, predictions: [winner(card, 0), winner(card, 1, "blue")] },
          fan.cookie,
        ),
      );

      expect(entry).toMatchObject({ multiplier: 4, reward: 80 });
      expect(entry.predictions.map((prediction) => prediction.cardOrder)).toEqual([1, 2]);
      expect(await balance(fan.cookie)).toMatchObject({ balance: STARTING_BALANCE - 20 });
    });

    it("lets a fan spread Coins across several Entries on one Event", async () => {
      const card = await upcomingCard({
        bouts: [cardBout({ cardOrder: 1 }), cardBout({ cardOrder: 2, mainEvent: true })],
      });
      const fan = await fanWithCoins();

      await accepted(await submit({ amount: 20, predictions: [winner(card, 0)] }, fan.cookie));
      const second = await accepted(
        await submit({ amount: 5, predictions: [winner(card, 0, "blue")] }, fan.cookie),
      );

      // Two theories about the same Bout are two Entries, which is allowed:
      // ADR-0004's rule is one Prediction per Bout *within* an Entry.
      expect(second.balance).toBe(STARTING_BALANCE - 25);
      expect((await entriesOf(fan.id)).length).toBe(2);
    });

    it("caps the combined Multiplier at ×100, and says the cap is what decided it", async () => {
      const card = await upcomingCard({
        multipliers: { winner: 5, method: 2.5, round: 3 },
        bouts: [
          cardBout({ cardOrder: 1 }),
          cardBout({ cardOrder: 2 }),
          cardBout({ cardOrder: 3, mainEvent: true }),
        ],
      });
      const fan = await fanWithCoins();

      const { entry } = await accepted(
        await submit(
          { amount: 2, predictions: [winner(card, 0), winner(card, 1), winner(card, 2)] },
          fan.cookie,
        ),
      );

      // 5 × 5 × 5 is 125, and no Entry pays past the cap however far it is
      // chained (ADR-0002: it bounds what a mispriced Outcome can cost).
      expect(entry).toMatchObject({
        multiplier: COMBINED_MULTIPLIER_CAP,
        capped: true,
        reward: 2 * COMBINED_MULTIPLIER_CAP,
      });
    });

    it("leaves the materialised Balance saying what the ledger says", async () => {
      const card = await upcomingCard();
      const fan = await fanWithCoins();

      await submit({ amount: 40, predictions: [winner(card)] }, fan.cookie);

      const [cached] = await testDatabase()
        .select()
        .from(balanceCache)
        .where(eq(balanceCache.userId, fan.id));

      const ledger = (await ledgerFor(fan.id)).reduce((total, row) => total + row.amount, 0);

      expect(cached?.balance).toBe(ledger);
      expect(ledger).toBe(STARTING_BALANCE - 40);
    });
  });

  describe("the Multiplier a fan was shown is the Multiplier they get", () => {
    it("does not change an Entry when the Outcome is repriced afterwards", async () => {
      // ADR-0002, and the reason a Prediction stores its Multiplier as a value.
      const card = await upcomingCard();
      const fan = await fanWithCoins();

      const { entry } = await accepted(
        await submit({ amount: 10, predictions: [winner(card)] }, fan.cookie),
      );

      expect(entry.reward).toBe(20);

      await priceBout(card.bouts[0]!, card.admin.cookie, { winner: 5, method: 2.5, round: 3 });

      // Read back out of the database rather than from an endpoint, because
      // the one that lists a fan's Entries is #17. What is being proved is
      // that the row did not move: the Reward is worked out from what the
      // Prediction stored, by the same function the panel showed it with.
      const held = await predictionsIn(entry.id);

      expect(held[0]?.winnerMultiplier).toBe(2);
      expect(potentialReward(entry.amount, held).reward).toBe(20);

      // And the correction did take: the next Entry is offered the new price.
      const next = await accepted(
        await submit({ amount: 10, predictions: [winner(card)] }, fan.cookie),
      );

      expect(next.entry.reward).toBe(50);
    });
  });

  describe("the Predictions the game refuses", () => {
    it("refuses a round alongside a Decision, which cannot both happen", async () => {
      const card = await upcomingCard();
      const fan = await fanWithCoins();

      const response = await submit(
        { amount: 10, predictions: [{ ...winner(card), method: "decision", round: 2 }] },
        fan.cookie,
      );

      expect(response.status).toBe(422);
      expect((await response.json()).message).toBe(ENTRY_MESSAGES.roundNeedsAFinish);
      expect(await entriesOf(fan.id)).toEqual([]);
    });

    it("refuses a round the Bout is not scheduled for", async () => {
      // A three-round Bout has no round 4 to predict, and the fan was never
      // offered one — this is somebody sending it anyway.
      const card = await upcomingCard({ bouts: [cardBout({ scheduledRounds: 3 })] });
      const fan = await fanWithCoins();

      const response = await submit(
        { amount: 10, predictions: [{ ...winner(card), method: "ko_tko", round: 4 }] },
        fan.cookie,
      );

      expect(response.status).toBe(422);
      expect((await response.json()).message).toBe(ENTRY_MESSAGES.answerNotOffered);
      expect(await entriesOf(fan.id)).toEqual([]);
    });

    it("refuses two Predictions on the same Bout in one Entry", async () => {
      const card = await upcomingCard();
      const fan = await fanWithCoins();

      const response = await submit(
        {
          amount: 10,
          predictions: [
            { ...winner(card), method: "ko_tko" },
            { ...winner(card), method: "submission" },
          ],
        },
        fan.cookie,
      );

      expect(response.status).toBe(422);
      expect((await response.json()).message).toBe(ENTRY_MESSAGES.onePredictionPerBout);
    });

    it("refuses the second Prediction on a Bout even when it is written by hand", async () => {
      // ADR-0004 is what stops the correlation exploit — "A wins" and "A wins
      // by KO" are nearly the same prediction, and chaining them would pay as
      // though a fan had predicted two things. A rule that lived only in the
      // route above would be one refactor away from disappearing.
      const card = await upcomingCard();
      const fan = await fanWithCoins();

      const { entry } = await accepted(
        await submit({ amount: 10, predictions: [winner(card)] }, fan.cookie),
      );

      const written = await testDatabase()
        .execute(
          sql`insert into predictions (entry_id, bout_id, corner, winner_multiplier)
              values (${entry.id}::uuid, ${card.bouts[0]!.id}::uuid, 'blue', 2.00)`,
        )
        .then(
          () => "wrote it",
          (refusal: Error) => `${refusal.message} ${refusal.cause}`,
        );

      expect(written).toMatch(/predictions_one_per_bout_in_an_entry/);
    });

    it("refuses more Predictions than an Entry holds", async () => {
      const eleven = Array.from({ length: ENTRY_PREDICTIONS.maximum + 1 }, (_, index) =>
        cardBout({ cardOrder: index + 1 }),
      );

      const card = await upcomingCard({ bouts: eleven });
      const fan = await fanWithCoins();

      const response = await submit(
        { amount: 10, predictions: card.bouts.map((bout) => ({ boutId: bout.id, corner: "red" })) },
        fan.cookie,
      );

      expect(response.status).toBe(422);
      expect((await response.json()).message).toBe(ENTRY_MESSAGES.tooManyPredictions);
      expect(await entriesOf(fan.id)).toEqual([]);

      // The ten it does hold are accepted, which is what makes the refusal
      // above about the eleventh rather than about the card.
      const ten = card.bouts.slice(0, ENTRY_PREDICTIONS.maximum);

      const accepted10 = await submit(
        { amount: 10, predictions: ten.map((bout) => ({ boutId: bout.id, corner: "red" })) },
        fan.cookie,
      );

      expect(accepted10.status).toBe(201);
    });

    it("refuses an Entry with no Predictions at all, even written by hand", async () => {
      // Coins committed to nothing is not a prediction, and an Entry holding
      // none would sit in a fan's history forever with nothing to settle it.
      await adminWithASeason();

      const fan = await fanWithCoins();

      const empty = await testDatabase()
        .execute(
          sql`insert into entries (season_id, user_id, amount)
              select id, ${fan.id}::uuid, 10 from seasons where status = 'open'`,
        )
        .then(
          () => "wrote it",
          (refusal: Error) => `${refusal.message} ${refusal.cause}`,
        );

      expect(empty).toMatch(/entries_hold_one_to_ten_predictions/);
    });

    it("refuses an Amount below one Coin", async () => {
      const card = await upcomingCard();
      const fan = await fanWithCoins();

      for (const amount of [0, -20, 2.5]) {
        const response = await submit({ amount, predictions: [winner(card)] }, fan.cookie);

        expect(response.status).toBe(422);
        expect((await response.json()).message).toBe(ENTRY_MESSAGES.amount);
      }

      expect(await entriesOf(fan.id)).toEqual([]);
    });

    it("refuses an Amount above the fan's Balance, and says what they hold", async () => {
      const card = await upcomingCard();
      const fan = await fanWithCoins();

      const response = await submit(
        { amount: STARTING_BALANCE + 1, predictions: [winner(card)] },
        fan.cookie,
      );

      expect(response.status).toBe(422);
      expect((await response.json()).message).toBe(ENTRY_MESSAGES.notEnoughCoins(STARTING_BALANCE));

      // Nothing was written: not the Entry, and not a Coin Transaction.
      expect(await entriesOf(fan.id)).toEqual([]);
      expect((await ledgerFor(fan.id)).length).toBe(1);
      expect(await balance(fan.cookie)).toMatchObject({ balance: STARTING_BALANCE });
    });

    it("refuses a commitment beyond the Balance written by hand, too", async () => {
      // The route asks first so that a fan is told what they hold. This is the
      // rule: no fan commits Coins they do not have, whatever asked.
      await adminWithASeason();

      const fan = await fanWithCoins();

      const written = await testDatabase()
        .execute(
          sql`insert into coin_transactions (season_id, user_id, kind, amount, reason, cause, cause_id)
              select id, ${fan.id}::uuid, 'entry_commitment', ${-(STARTING_BALANCE + 1)},
                     'By hand', 'entry', gen_random_uuid()
              from seasons where status = 'open'`,
        )
        .then(
          () => "wrote it",
          (refusal: Error) => `${refusal.message} ${refusal.cause}`,
        );

      expect(written).toMatch(/entry_commitments_are_within_the_balance/);
    });

    it("refuses a Bout named as something that is not an id at all", async () => {
      // Not pedantry: casting it inside the query would raise halfway down and
      // answer the fan a 500 rather than a sentence.
      const fan = await fanWithCoins();

      await upcomingCard();

      const response = await submit(
        { amount: 10, predictions: [{ boutId: "the main event", corner: "red" }] },
        fan.cookie,
      );

      expect(response.status).toBe(409);
      expect((await response.json()).message).toBe(ENTRY_MESSAGES.boutNotOnTheCard);
    });

    it("refuses a Bout nobody has opened", async () => {
      const card = await upcomingCard({ open: false });
      const fan = await fanWithCoins();

      const response = await submit({ amount: 10, predictions: [winner(card)] }, fan.cookie);

      expect(response.status).toBe(409);
      expect((await response.json()).message).toBe(ENTRY_MESSAGES.boutNotOpen);
    });

    it("refuses a Bout whose Lock has passed, though nothing wrote it down", async () => {
      // The card started a minute ago: the Bout fought first locked at the
      // scheduled start with nobody pressing anything (ADR-0006), and the rest
      // are still live. A Bout predictable while it is being fought is the one
      // failure that lets a fan win with certainty.
      const card = await cardInTheGame({
        scheduledStart: new Date(Date.now() - 60_000),
        bouts: [cardBout({ cardOrder: 1 }), cardBout({ cardOrder: 2, mainEvent: true })],
      });
      const fan = await fanWithCoins();

      const locked = await submit({ amount: 10, predictions: [winner(card, 0)] }, fan.cookie);

      expect(locked.status).toBe(409);
      expect((await locked.json()).message).toBe(ENTRY_MESSAGES.boutNotOpen);

      const stillOpen = await submit({ amount: 10, predictions: [winner(card, 1)] }, fan.cookie);

      expect(stillOpen.status).toBe(201);
    });

    it("refuses a Bout an admin has locked", async () => {
      // The Lock doing what it exists for. Once a Bout is locked nothing more
      // is committed to it, whatever page a fan still has open.
      const card = await cardInTheGame({
        bouts: [cardBout({ cardOrder: 1 }), cardBout({ cardOrder: 2, mainEvent: true })],
      });
      const fan = await fanWithCoins();

      const locked = await postJson(
        `/api/admin/bouts/${card.bouts[0]!.id}/lock`,
        {},
        card.admin.cookie,
      );

      expect(locked.status).toBe(200);

      const refused = await submit({ amount: 10, predictions: [winner(card, 0)] }, fan.cookie);

      expect(refused.status).toBe(409);
      expect((await refused.json()).message).toBe(ENTRY_MESSAGES.boutNotOpen);

      // And only that Bout: the rest of the card is still being played on,
      // which is the whole of ADR-0006.
      expect(
        (await submit({ amount: 10, predictions: [winner(card, 1)] }, fan.cookie)).status,
      ).toBe(201);
    });

    it("writes the Lock down when a card's backstop has passed, and refuses on it", async () => {
      // Nothing schedules the sweep, so the submission itself is what applies
      // it: by the time the Prediction is written the Bout is `locked` in the
      // row, and `predictions_are_made_on_open_bouts` refuses it too.
      const card = await cardInTheGame({
        scheduledStart: new Date(Date.now() - 7 * 60 * 60_000),
        bouts: [cardBout({ cardOrder: 1 }), cardBout({ cardOrder: 2, mainEvent: true })],
      });
      const fan = await fanWithCoins();

      const refused = await submit({ amount: 10, predictions: [winner(card, 1)] }, fan.cookie);

      expect(refused.status).toBe(409);
      expect((await refused.json()).message).toBe(ENTRY_MESSAGES.boutNotOpen);

      // The refusal is not the route's opinion alone: the sweep ran first, so
      // the row itself says the Bout is done, and it says who closed it.
      const [headliner] = await testDatabase()
        .select({ status: bouts.status, kind: boutLocks.kind })
        .from(bouts)
        .innerJoin(boutLocks, eq(boutLocks.boutId, bouts.id))
        .where(eq(bouts.id, card.bouts[1]!.id));

      expect(headliner).toEqual({ status: "locked", kind: "sweep" });
    });

    it("refuses a Prediction on a Bout that is not open, even written by hand", async () => {
      const card = await upcomingCard({ open: false });
      const fan = await fanWithCoins();

      // One transaction, because an Entry with no Predictions in it is refused
      // by a rule of its own: writing the two rows apart would prove that one
      // instead.
      const written = await testDatabase()
        .transaction(async (tx) => {
          const rows = await tx.execute<{ id: string }>(
            sql`insert into entries (season_id, user_id, amount)
                select id, ${fan.id}::uuid, 10 from seasons where status = 'open'
                returning id`,
          );

          await tx.execute(
            sql`insert into predictions (entry_id, bout_id, corner, winner_multiplier)
                values (${rows[0]!.id}::uuid, ${card.bouts[0]!.id}::uuid, 'red', 2.00)`,
          );
        })
        .then(
          () => "wrote it",
          (refusal: Error) => `${refusal.message} ${refusal.cause}`,
        );

      expect(written).toMatch(/predictions_are_made_on_open_bouts/);
    });

    it("refuses an answer nobody offered, even written by hand", async () => {
      // Round 4 of a three-round Bout has no Outcome row to point at, so the
      // foreign key is what refuses it — the Multiplier a Prediction froze can
      // only ever be one the Bout was actually offering.
      const card = await upcomingCard({
        bouts: [
          cardBout({ cardOrder: 1, scheduledRounds: 3 }),
          cardBout({ cardOrder: 2, scheduledRounds: 3, mainEvent: true }),
        ],
      });
      const fan = await fanWithCoins();

      const { entry } = await accepted(
        await submit({ amount: 10, predictions: [winner(card)] }, fan.cookie),
      );

      // On the Bout the Entry has nothing on yet, so that what refuses this is
      // the round rather than ADR-0004's one Prediction per Bout.
      const written = await testDatabase()
        .execute(
          sql`insert into predictions
                (entry_id, bout_id, corner, method, round,
                 winner_multiplier, method_multiplier, round_multiplier)
              values (${entry.id}::uuid, ${card.bouts[1]!.id}::uuid, 'blue', 'ko_tko', 4,
                      2.00, 2.50, 3.00)`,
        )
        .then(
          () => "wrote it",
          (refusal: Error) => `${refusal.message} ${refusal.cause}`,
        );

      expect(written).toMatch(/predictions_round_is_offered/);
    });
  });

  describe("who may submit at all", () => {
    it("prompts a signed-out visitor to sign in", async () => {
      const card = await upcomingCard();

      const response = await submit({ amount: 10, predictions: [winner(card)] });

      expect(response.status).toBe(401);
      expect((await response.json()).message).toBe(ENTRY_MESSAGES.signIn);
      expect(await testDatabase().select().from(entries)).toEqual([]);
    });

    it("tells a fan with an unconfirmed address exactly what is blocking them", async () => {
      // The published contest rules promise a confirmed address before a first
      // Entry (ADR-0007), and it is the whole of "one account per person".
      const card = await upcomingCard();
      const signedUp = await signUp();

      const response = await submit({ amount: 10, predictions: [winner(card)] }, signedUp.cookie);

      const { message } = await response.json();

      expect(response.status).toBe(403);
      expect(message).toBe(ENTRY_MESSAGES.emailUnverified);
      expect(message).toMatch(/confirm your email/i);
    });

    it("refuses an Entry while no Season is being played", async () => {
      const card = await upcomingCard();
      const fan = await fanWithCoins();

      // Closing a Season is #19's, so reaching this state means writing it by
      // hand — the card and its Coins outlive the Season being open.
      await testDatabase().execute(
        sql`update seasons set status = 'closed', closed_at = now() where status = 'open'`,
      );

      const response = await submit({ amount: 10, predictions: [winner(card)] }, fan.cookie);

      expect(response.status).toBe(409);
      expect((await response.json()).message).toBe(ENTRY_MESSAGES.noSeasonOpen);
    });
  });

  describe("the card a fan builds an Entry on", () => {
    /** The page as a browser gets it, signed in or not. */
    function page(cookie?: string) {
      return $fetch<string>("/predictions", {
        headers: cookie === undefined ? {} : { cookie },
      });
    }

    it("offers every answer on an open Bout as something to pick", async () => {
      await upcomingCard();
      const fan = await fanWithCoins();

      const rendered = await page(fan.cookie);

      // The answers are buttons rather than a list, and none of them is picked
      // when the page arrives.
      expect(rendered).toMatch(/aria-pressed="false"/);
      expect(rendered).toContain("Giorgi Tsiklauri");
      expect(rendered).toContain("×2.00");

      // And the panel says what to do first, rather than showing a Reward for
      // an Entry with nothing in it.
      expect(rendered).toContain(ENTRY_MESSAGES.nothingPicked);
    });

    it("tells a fan with an unconfirmed address before they try", async () => {
      await upcomingCard();
      const signedUp = await signUp();

      expect(await page(signedUp.cookie)).toContain(ENTRY_MESSAGES.emailUnverified);
    });

    it("still shows the whole card to a visitor with no account", async () => {
      await upcomingCard();

      const response = await fetch("/predictions");
      const rendered = await response.text();

      expect(response.status).toBe(200);
      expect(rendered).toContain("Giorgi Tsiklauri");
      expect(rendered).toMatch(/aria-pressed="false"/);
    });

    it("offers nothing to pick on a Bout nobody has opened", async () => {
      await upcomingCard({ open: false });
      const fan = await fanWithCoins();

      const rendered = await page(fan.cookie);

      expect(rendered).not.toMatch(/aria-pressed/);
    });
  });
});
