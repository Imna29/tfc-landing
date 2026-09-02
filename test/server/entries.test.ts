import { $fetch, fetch } from "@nuxt/test-utils/e2e";
import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { COIN_REASONS, STARTING_BALANCE } from "../../shared/coins";
import {
  CANCELLATION_MESSAGES,
  COMBINED_MULTIPLIER_CAP,
  ENTRY_MESSAGES,
  ENTRY_PREDICTIONS,
  potentialReward,
  type CommittedEntries,
} from "../../shared/entries";
import { METHODS, QUESTION_LABELS, type Method } from "../../shared/pricing";
import {
  balanceCache,
  boutLocks,
  bouts,
  coinTransactions,
  entries,
  events,
  predictions,
} from "../../server/db/schema";
import {
  AN_ENTRY_IS_CANCELLED_ONCE_OUT_OF_OPEN,
  ENTRIES_ARE_REFUNDED_IN_FULL,
  ENTRIES_ARE_CANCELLED_WHILE_EVERY_BOUT_IS_OPEN,
} from "../../server/utils/cancellation";
import type { SubmittedEntry } from "../../server/utils/entries";
import { postJson, signUp } from "../helpers/accounts";
import {
  adminWithASeason,
  cardBout,
  cardInTheGame,
  closeOpenSeason,
  enterResult,
  lockBout,
  priceBout,
  type CardInTheGame,
} from "../helpers/cards";
import { testDatabase } from "../helpers/database";
import { cancel, winnerOn } from "../helpers/playing";
import { setupTestServer } from "../helpers/server";
import { confirmEmail, fanId } from "../helpers/users";

/**
 * Submitting an Entry and cancelling one: the core of the product, and where
 * every validation rule in it lands.
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
describe("the Entry a fan commits, and takes back", async () => {
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

  /** A winner Prediction on one Bout of a card, which is what the card offers. */
  function winner(card: CardInTheGame, place = 0, corner: "red" | "blue" = "red") {
    return { boutId: card.bouts[place]!.id, question: "winner", corner };
  }

  /**
   * A method Prediction on one Bout of a card, which names no winner at all.
   *
   * The Question #33 stands up beside the winner: a fan sure a Bout ends by
   * Submission and with no read on which fighter gets it says exactly that,
   * and it is a whole Prediction at the method's own Multiplier.
   */
  function byMethod(card: CardInTheGame, place = 0, method: Method = "submission") {
    return { boutId: card.bouts[place]!.id, question: "method", method };
  }

  /**
   * A round Prediction on one Bout of a card.
   *
   * Here because two cases below are about the keys holding an answer to the
   * ones its Bout was offering, and a round is where that is provable without
   * a second card: a three-round Bout has no round 4 to point at. #34 is what
   * puts this Question on the card; the Outcomes it answers are priced and
   * stored either way (ADR-0014).
   */
  function inRound(card: CardInTheGame, place: number, round: number) {
    return { boutId: card.bouts[place]!.id, question: "round", round };
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
          question: "winner",
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

    it("writes one answer, in the shape of the Outcome it was copied from", async () => {
      const card = await upcomingCard();
      const fan = await fanWithCoins();

      const { entry } = await accepted(
        await submit({ amount: 10, predictions: [winner(card)] }, fan.cookie),
      );

      expect(entry).toMatchObject({ multiplier: 2, reward: 20 });

      // A Question, exactly one non-null answer, and the one Multiplier that
      // answer pays (ADR-0014) — the same three columns and the same number
      // the Outcome row carries, so nothing joining or grading the two carries
      // a translation step.
      const [written] = await predictionsIn(entry.id);

      expect(written).toMatchObject({
        question: "winner",
        corner: "red",
        method: null,
        round: null,
        multiplier: 2,
      });
    });

    it("takes a method with no winner named, and returns what that answer pays", async () => {
      // #33's whole point: a fan who is confident a Bout ends by Submission
      // and has no read on which fighter gets it commits that alone, and
      // carries only the risk they meant to take. There is no winner in this
      // Entry to have been priced in.
      const card = await upcomingCard();
      const fan = await fanWithCoins();

      const { entry, balance: left } = await accepted(
        await submit({ amount: 20, predictions: [byMethod(card)] }, fan.cookie),
      );

      // The method Outcome pays ×2.50, so 20 Coins return 50.
      expect(entry).toMatchObject({ amount: 20, multiplier: 2.5, capped: false, reward: 50 });
      expect(entry.predictions).toEqual([
        {
          boutId: card.bouts[0]!.id,
          cardOrder: 1,
          question: "method",
          corner: null,
          method: "submission",
          round: null,
          multiplier: 2.5,
        },
      ]);

      // Written in the shape of the Outcome it was copied from: one Question,
      // one non-null answer, one Multiplier (ADR-0014).
      const [written] = await predictionsIn(entry.id);

      expect(written).toMatchObject({
        question: "method",
        corner: null,
        method: "submission",
        round: null,
        multiplier: 2.5,
      });

      expect(left).toBe(STARTING_BALANCE - 20);
    });

    it("chains a method on one Bout with a winner on another", async () => {
      // The two Questions are answered on different Bouts, which are
      // independent events — so the Multipliers multiply, which is the whole
      // of what chaining is (ADR-0014).
      const card = await upcomingCard({
        bouts: [cardBout({ cardOrder: 1 }), cardBout({ cardOrder: 2, mainEvent: true })],
      });
      const fan = await fanWithCoins();

      const { entry } = await accepted(
        await submit(
          { amount: 10, predictions: [byMethod(card, 0, "ko_tko"), winner(card, 1, "blue")] },
          fan.cookie,
        ),
      );

      // ×2.50 on the method and ×2 on the winner: ×5, so 10 Coins return 50.
      expect(entry).toMatchObject({ multiplier: 5, reward: 50 });
      expect(entry.predictions.map((prediction) => prediction.question)).toEqual([
        "method",
        "winner",
      ]);
    });

    it("writes a round Prediction with no method beside it", async () => {
      // The constraint that required a round to sit alongside a finish went
      // with the compound shape (ADR-0014): a round stands on its own now, and
      // is graded wrong rather than refused on a Bout that goes the distance.
      // The card does not offer the Question yet (#34) and the Outcome is
      // priced and stored all the same — which is what makes this the case
      // that proves the old rule is not still standing underneath.
      const card = await upcomingCard();
      const fan = await fanWithCoins();

      const { entry } = await accepted(
        await submit({ amount: 10, predictions: [inRound(card, 0, 2)] }, fan.cookie),
      );

      expect(entry).toMatchObject({ multiplier: 3, reward: 30 });

      const [written] = await predictionsIn(entry.id);

      expect(written).toMatchObject({
        question: "round",
        corner: null,
        method: null,
        round: 2,
        multiplier: 3,
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
      // ADR-0014's rule is one Prediction per Bout *within* an Entry, and two
      // Entries are separately funded with nothing multiplying between them.
      expect(second.balance).toBe(STARTING_BALANCE - 25);
      expect((await entriesOf(fan.id)).length).toBe(2);
    });

    it("lets a fan answer two different Questions on one Bout, in two Entries", async () => {
      // The rule is one Prediction per Bout *within* an Entry (ADR-0014), and
      // #33 is where that distinction starts to matter: a fan with a view on
      // the winner and a separate view on the method holds two Entries, each
      // funded on its own with nothing multiplying between them, so there is
      // nothing to overpay.
      const card = await upcomingCard();
      const fan = await fanWithCoins();

      const onTheWinner = await accepted(
        await submit({ amount: 10, predictions: [winner(card)] }, fan.cookie),
      );
      const onTheMethod = await accepted(
        await submit({ amount: 15, predictions: [byMethod(card)] }, fan.cookie),
      );

      expect(onTheWinner.entry.reward).toBe(20);
      expect(onTheMethod.entry.reward).toBe(38);
      expect((await entriesOf(fan.id)).length).toBe(2);
      expect(await balance(fan.cookie)).toMatchObject({ balance: STARTING_BALANCE - 25 });
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

      // Read back out of the database rather than through a listing, which
      // would work the answer out from the same row and prove nothing about
      // it. What is being proved is that the row did not move: the Reward is
      // worked out from what the Prediction stored, by the same function the
      // panel showed it with.
      const held = await predictionsIn(entry.id);

      expect(held[0]?.multiplier).toBe(2);
      expect(potentialReward(entry.amount, held).reward).toBe(20);

      // And the correction did take: the next Entry is offered the new price.
      const next = await accepted(
        await submit({ amount: 10, predictions: [winner(card)] }, fan.cookie),
      );

      expect(next.entry.reward).toBe(50);
    });
  });

  describe("the Predictions the game refuses", () => {
    it("refuses a Prediction carrying more than one answer", async () => {
      // A Prediction is one answer to one Question (ADR-0014), so a body
      // naming a corner and a round at once is not a Prediction anything could
      // grade — there would be no saying which of them the fan gave.
      const card = await upcomingCard();
      const fan = await fanWithCoins();

      const response = await submit(
        { amount: 10, predictions: [{ ...winner(card), round: 2 }] },
        fan.cookie,
      );

      expect(response.status).toBe(422);
      expect((await response.json()).message).toBe(ENTRY_MESSAGES.unreadable);
      expect(await entriesOf(fan.id)).toEqual([]);
    });

    it("refuses a Prediction whose answer is not the one its Question asks for", async () => {
      const card = await upcomingCard();
      const fan = await fanWithCoins();

      const response = await submit(
        {
          amount: 10,
          predictions: [{ boutId: card.bouts[0]!.id, question: "round", round: null }],
        },
        fan.cookie,
      );

      expect(response.status).toBe(422);
      expect((await response.json()).message).toBe(ENTRY_MESSAGES.unreadable);
      expect(await entriesOf(fan.id)).toEqual([]);
    });

    it("refuses a round the Bout is not scheduled for", async () => {
      // A three-round Bout has no round 4 to predict, and the fan was never
      // offered one — this is somebody sending it anyway.
      const card = await upcomingCard({ bouts: [cardBout({ scheduledRounds: 3 })] });
      const fan = await fanWithCoins();

      const response = await submit({ amount: 10, predictions: [inRound(card, 0, 4)] }, fan.cookie);

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
          predictions: [winner(card, 0, "red"), winner(card, 0, "blue")],
        },
        fan.cookie,
      );

      expect(response.status).toBe(422);
      expect((await response.json()).message).toBe(ENTRY_MESSAGES.onePredictionPerBout);
    });

    it("refuses a winner and a method on the same Bout in one Entry", async () => {
      // Both Questions are on the card now, so this is a shape a fan can build
      // towards rather than one only a hand-written body reaches. "Red wins"
      // and "it ends by Submission" are nearly the same prediction, and one
      // Entry holding both would pay as though they were two (ADR-0014).
      const card = await upcomingCard();
      const fan = await fanWithCoins();

      const response = await submit(
        { amount: 10, predictions: [winner(card), byMethod(card)] },
        fan.cookie,
      );

      expect(response.status).toBe(422);
      expect((await response.json()).message).toBe(ENTRY_MESSAGES.onePredictionPerBout);
      expect(await entriesOf(fan.id)).toEqual([]);
    });

    it("refuses the second Prediction on a Bout even when it is written by hand", async () => {
      // ADR-0014 is what makes this model safe to multiply — "A wins" and "the
      // Bout ends by KO" are nearly the same prediction, and chaining them
      // would pay as though a fan had predicted two things. A rule that lived
      // only in the route above would be one refactor away from disappearing.
      const card = await upcomingCard();
      const fan = await fanWithCoins();

      const { entry } = await accepted(
        await submit({ amount: 10, predictions: [winner(card)] }, fan.cookie),
      );

      const written = await testDatabase()
        .execute(
          sql`insert into predictions (entry_id, bout_id, question, corner, multiplier)
              values (${entry.id}::uuid, ${card.bouts[0]!.id}::uuid, 'winner', 'blue', 2.00)`,
        )
        .then(
          () => "wrote it",
          (refusal: Error) => `${refusal.message} ${refusal.cause}`,
        );

      expect(written).toMatch(/predictions_one_per_bout_in_an_entry/);
    });

    it("refuses a row carrying two answers, even written by hand", async () => {
      // The rule the route asks about above, held by Postgres — the same one
      // `outcomes_answers_its_question` holds the Outcome to, because a
      // Prediction is a copy of one.
      const card = await upcomingCard();
      const fan = await fanWithCoins();

      const { entry } = await accepted(
        await submit({ amount: 10, predictions: [winner(card)] }, fan.cookie),
      );

      const written = await testDatabase()
        .execute(
          sql`insert into predictions (entry_id, bout_id, question, corner, round, multiplier)
              values (${entry.id}::uuid, ${card.bouts[0]!.id}::uuid, 'winner', 'blue', 2, 2.00)`,
        )
        .then(
          () => "wrote it",
          (refusal: Error) => `${refusal.message} ${refusal.cause}`,
        );

      expect(written).toMatch(/predictions_answers_its_question/);
    });

    it("refuses more Predictions than an Entry holds", async () => {
      const eleven = Array.from({ length: ENTRY_PREDICTIONS.maximum + 1 }, (_, index) =>
        cardBout({ cardOrder: index + 1 }),
      );

      const card = await upcomingCard({ bouts: eleven });
      const fan = await fanWithCoins();

      const response = await submit(
        { amount: 10, predictions: card.bouts.map((bout) => winnerOn(bout.id, "red")) },
        fan.cookie,
      );

      expect(response.status).toBe(422);
      expect((await response.json()).message).toBe(ENTRY_MESSAGES.tooManyPredictions);
      expect(await entriesOf(fan.id)).toEqual([]);

      // The ten it does hold are accepted, which is what makes the refusal
      // above about the eleventh rather than about the card.
      const ten = card.bouts.slice(0, ENTRY_PREDICTIONS.maximum);

      const accepted10 = await submit(
        { amount: 10, predictions: ten.map((bout) => winnerOn(bout.id, "red")) },
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
        { amount: 10, predictions: [winnerOn("the main event", "red")] },
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
            sql`insert into predictions (entry_id, bout_id, question, corner, multiplier)
                values (${rows[0]!.id}::uuid, ${card.bouts[0]!.id}::uuid, 'winner', 'red', 2.00)`,
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
      // the round rather than ADR-0014's one Prediction per Bout.
      const written = await testDatabase()
        .execute(
          sql`insert into predictions (entry_id, bout_id, question, round, multiplier)
              values (${entry.id}::uuid, ${card.bouts[1]!.id}::uuid, 'round', 4, 3.00)`,
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

      // The Season is closed the way an admin closes one, which means
      // finishing its card first. The Bout being settled is not what refuses
      // the Entry below: `entries.post.ts` asks whether a Season is being
      // played before it looks at a single Bout.
      await lockBout(card.bouts[0]!.id, card.admin.cookie);
      await enterResult(
        card.bouts[0]!.id,
        { winner: "red", method: "decision", round: null },
        card.admin.cookie,
      );
      await closeOpenSeason(card.admin.cookie);

      const response = await submit({ amount: 10, predictions: [winner(card)] }, fan.cookie);

      expect(response.status).toBe(409);
      expect((await response.json()).message).toBe(ENTRY_MESSAGES.noSeasonOpen);
    });
  });

  describe("cancelling an Entry", () => {
    /** The Entries a fan is holding, as their own listing reads them. */
    function listing(cookie: string) {
      return $fetch<CommittedEntries>("/api/predictions/entries", { headers: { cookie } });
    }

    /** A card of two Bouts, which is what a Chained Entry needs. */
    function twoBoutCard(options: Parameters<typeof cardInTheGame>[0] = {}) {
      return upcomingCard({
        bouts: [cardBout({ cardOrder: 1 }), cardBout({ cardOrder: 2, mainEvent: true })],
        ...options,
      });
    }

    /**
     * Moves a card back so that it has already started.
     *
     * The one thing a test cannot do is wait, and this is the state waiting
     * would produce: the card reached its scheduled start with the Bout fought
     * first still open, which is the Lock ADR-0006 promises with nobody
     * pressing anything. Written straight to the row because no route moves a
     * card once its Bouts are open — that is the point of the import door
     * shutting.
     */
    async function cardHasStarted(eventId: string, since = 60_000) {
      await testDatabase()
        .update(events)
        .set({ scheduledStart: new Date(Date.now() - since) })
        .where(eq(events.id, eventId));
    }

    it("returns the Amount in full while every Bout in the Entry is still open", async () => {
      const card = await twoBoutCard();
      const fan = await fanWithCoins();

      const { entry } = await accepted(
        await submit({ amount: 30, predictions: [winner(card, 0), winner(card, 1)] }, fan.cookie),
      );

      const response = await cancel(entry.id, fan.cookie);
      const cancelled = (await response.json()) as {
        entry: { id: string; status: string; amount: number };
        balance: number;
        message: string;
      };

      expect(response.status).toBe(200);
      expect(cancelled.entry).toEqual({ id: entry.id, status: "cancelled", amount: 30 });
      expect(cancelled.message).toBe(CANCELLATION_MESSAGES.cancelled(30));

      // Exactly what was committed, and no more: the Balance is where it was
      // before the Entry existed.
      expect(cancelled.balance).toBe(STARTING_BALANCE);
      expect(await balance(fan.cookie)).toMatchObject({ balance: STARTING_BALANCE });
      expect((await entriesOf(fan.id)).at(0)).toMatchObject({ status: "cancelled", amount: 30 });
    });

    it("records the refund in the ledger, pointing at the Entry that caused it", async () => {
      const card = await twoBoutCard();
      const fan = await fanWithCoins();

      const { entry } = await accepted(
        await submit({ amount: 25, predictions: [winner(card)] }, fan.cookie),
      );

      expect((await cancel(entry.id, fan.cookie)).status).toBe(200);

      // Three rows, and the commitment still among them: the ledger is
      // append-only, so a cancellation is Coins coming back rather than a
      // commitment being unwritten (ADR-0003).
      const ledger = await ledgerFor(fan.id);

      expect(ledger.map((row) => [row.kind, row.amount])).toEqual([
        ["season_grant", STARTING_BALANCE],
        ["entry_commitment", -25],
        ["entry_refund", 25],
      ]);
      expect(ledger.at(-1)).toMatchObject({
        cause: "entry",
        causeId: entry.id,
        reason: COIN_REASONS.entryCancelled,
      });
    });

    it("keeps the cancelled Entry in the fan's listing, with its status", async () => {
      const card = await twoBoutCard();
      const fan = await fanWithCoins();

      const { entry } = await accepted(
        await submit({ amount: 10, predictions: [winner(card)] }, fan.cookie),
      );

      await cancel(entry.id, fan.cookie);

      const { entries: held } = await listing(fan.cookie);

      expect(held).toHaveLength(1);
      expect(held[0]).toMatchObject({ id: entry.id, status: "cancelled", amount: 10 });
      expect(held[0]?.predictions).toHaveLength(1);
    });

    it("refuses once a Bout in the Entry has locked, and leaves the Coins committed", async () => {
      const card = await twoBoutCard();
      const fan = await fanWithCoins();

      const { entry } = await accepted(
        await submit({ amount: 40, predictions: [winner(card, 0), winner(card, 1)] }, fan.cookie),
      );

      // The opener locks as the card reaches it. The main event is still open,
      // and it makes no difference: part of this Entry has started being
      // decided.
      await lockBout(card.bouts[0]!.id, card.admin.cookie);

      const response = await cancel(entry.id, fan.cookie);

      expect(response.status).toBe(409);
      expect((await response.json()).message).toBe(CANCELLATION_MESSAGES.boutLocked);
      expect((await entriesOf(fan.id)).at(0)).toMatchObject({ status: "open" });
      expect(await balance(fan.cookie)).toMatchObject({ balance: STARTING_BALANCE - 40 });
    });

    it("tells the fan a Bout has locked before they try to cancel", async () => {
      const card = await twoBoutCard();
      const fan = await fanWithCoins();

      await accepted(
        await submit({ amount: 10, predictions: [winner(card, 0), winner(card, 1)] }, fan.cookie),
      );

      await lockBout(card.bouts[0]!.id, card.admin.cookie);

      // What the listing carries is where each Bout stands, which is what the
      // page decides from — `cancellationOf` in `shared/entries.ts`, the same
      // function the route refused with above.
      const { entries: held } = await listing(fan.cookie);

      expect(held[0]?.predictions.map((prediction) => prediction.status)).toEqual([
        "locked",
        "open",
      ]);
    });

    it("refuses once the card has started, though nobody locked anything", async () => {
      const card = await twoBoutCard();
      const fan = await fanWithCoins();

      const { entry } = await accepted(
        await submit({ amount: 10, predictions: [winner(card, 0)] }, fan.cookie),
      );

      await cardHasStarted(card.eventId);

      const response = await cancel(entry.id, fan.cookie);

      expect(response.status).toBe(409);
      expect((await response.json()).message).toBe(CANCELLATION_MESSAGES.boutLocked);

      // The refusal is not the route's opinion alone: cancelling applies the
      // Locks that have fallen due first, so the row itself says the Bout is
      // closed and says what closed it.
      const [opener] = await testDatabase()
        .select({ status: bouts.status, kind: boutLocks.kind })
        .from(bouts)
        .innerJoin(boutLocks, eq(boutLocks.boutId, bouts.id))
        .where(eq(bouts.id, card.bouts[0]!.id));

      expect(opener).toEqual({ status: "locked", kind: "scheduled" });
    });

    it("refuses to cancel another fan's Entry, and does not admit it exists", async () => {
      const card = await twoBoutCard();
      const fan = await fanWithCoins();
      const stranger = await fanWithCoins();

      const { entry } = await accepted(
        await submit({ amount: 10, predictions: [winner(card)] }, fan.cookie),
      );

      const response = await cancel(entry.id, stranger.cookie);

      expect(response.status).toBe(404);
      expect((await response.json()).message).toBe(CANCELLATION_MESSAGES.notYours);
      expect((await entriesOf(fan.id)).at(0)).toMatchObject({ status: "open" });
      expect(await balance(fan.cookie)).toMatchObject({ balance: STARTING_BALANCE - 10 });
    });

    it("refuses an Entry id that is not one at all", async () => {
      const fan = await fanWithCoins();

      const response = await cancel("the-one-i-regret", fan.cookie);

      expect(response.status).toBe(404);
      expect((await response.json()).message).toBe(CANCELLATION_MESSAGES.notYours);
    });

    it("asks a signed-out visitor to sign in", async () => {
      const card = await twoBoutCard();
      const fan = await fanWithCoins();

      const { entry } = await accepted(
        await submit({ amount: 10, predictions: [winner(card)] }, fan.cookie),
      );

      expect((await cancel(entry.id)).status).toBe(401);
    });

    it("cancels once, and refuses the second attempt", async () => {
      const card = await twoBoutCard();
      const fan = await fanWithCoins();

      const { entry } = await accepted(
        await submit({ amount: 10, predictions: [winner(card)] }, fan.cookie),
      );

      expect((await cancel(entry.id, fan.cookie)).status).toBe(200);

      const again = await cancel(entry.id, fan.cookie);

      expect(again.status).toBe(409);
      expect((await again.json()).message).toBe(CANCELLATION_MESSAGES.alreadyCancelled);

      // One refund, and a Balance that was restored once.
      const refunds = (await ledgerFor(fan.id)).filter((row) => row.kind === "entry_refund");

      expect(refunds).toHaveLength(1);
      expect(await balance(fan.cookie)).toMatchObject({ balance: STARTING_BALANCE });
    });

    it("leaves a cancelled Entry out of the grading when its Bout settles", async () => {
      const card = await twoBoutCard();
      const fan = await fanWithCoins();

      const { entry: withdrawn } = await accepted(
        await submit({ amount: 10, predictions: [winner(card, 0)] }, fan.cookie),
      );
      const { entry: kept } = await accepted(
        await submit({ amount: 10, predictions: [winner(card, 0)] }, fan.cookie),
      );

      expect((await cancel(withdrawn.id, fan.cookie)).status).toBe(200);

      await lockBout(card.bouts[0]!.id, card.admin.cookie);

      const settled = await enterResult(
        card.bouts[0]!.id,
        { winner: "red", method: "decision", round: null },
        card.admin.cookie,
      );

      expect(settled.status).toBe(200);
      expect(await settled.json()).toMatchObject({ settlement: { graded: 1, won: 1 } });

      // The cancelled Entry is where the fan left it, and was paid nothing on
      // top of the Amount it had already returned.
      const held = await entriesOf(fan.id);

      expect(held.find((one) => one.id === withdrawn.id)).toMatchObject({ status: "cancelled" });
      expect(held.find((one) => one.id === kept.id)).toMatchObject({ status: "won" });

      const rewards = (await ledgerFor(fan.id)).filter((row) => row.kind === "entry_reward");

      expect(rewards.map((row) => row.causeId)).toEqual([kept.id]);
    });

    it("refuses a cancellation with no refund behind it, even written by hand", async () => {
      // The rule that makes a cancelled Entry and its Coins one thing: an
      // Entry marked cancelled and never refunded is Coins destroyed with no
      // error anywhere.
      const card = await twoBoutCard();
      const fan = await fanWithCoins();

      const { entry } = await accepted(
        await submit({ amount: 10, predictions: [winner(card)] }, fan.cookie),
      );

      const written = await testDatabase()
        .execute(sql`update entries set status = 'cancelled' where id = ${entry.id}::uuid`)
        .then(
          () => "wrote it",
          (refusal: Error) => `${refusal.message} ${refusal.cause}`,
        );

      expect(written).toContain(ENTRIES_ARE_REFUNDED_IN_FULL);
    });

    it("refuses an Entry written straight into cancelled, refund or no refund", async () => {
      // Nothing writes one, and that is why the rule has to hold here too: an
      // Entry inserted already cancelled would otherwise carry no refund and
      // meet no rule saying so.
      const card = await twoBoutCard();
      const fan = await fanWithCoins();

      const written = await testDatabase()
        .transaction(async (tx) => {
          const rows = await tx.execute<{ id: string }>(
            sql`insert into entries (season_id, user_id, amount, status)
                select id, ${fan.id}::uuid, 10, 'cancelled' from seasons where status = 'open'
                returning id`,
          );

          await tx.execute(
            sql`insert into predictions (entry_id, bout_id, question, corner, multiplier)
                values (${rows[0]!.id}::uuid, ${card.bouts[0]!.id}::uuid, 'winner', 'red', 2.00)`,
          );
        })
        .then(
          () => "wrote it",
          (refusal: Error) => `${refusal.message} ${refusal.cause}`,
        );

      expect(written).toContain(ENTRIES_ARE_REFUNDED_IN_FULL);
    });

    it("refuses a refund of less than the Amount, even written by hand", async () => {
      const card = await twoBoutCard();
      const fan = await fanWithCoins();

      const { entry } = await accepted(
        await submit({ amount: 10, predictions: [winner(card)] }, fan.cookie),
      );

      const written = await testDatabase()
        .transaction(async (tx) => {
          await tx.execute(
            sql`update entries set status = 'cancelled' where id = ${entry.id}::uuid`,
          );

          await tx.execute(
            sql`insert into coin_transactions
                  (season_id, user_id, kind, amount, reason, cause, cause_id)
                select season_id, user_id, 'entry_refund', 9, 'most of it', 'entry', id
                from entries where id = ${entry.id}::uuid`,
          );
        })
        .then(
          () => "wrote it",
          (refusal: Error) => `${refusal.message} ${refusal.cause}`,
        );

      expect(written).toContain(ENTRIES_ARE_REFUNDED_IN_FULL);
    });

    it("refuses a second refund on an Entry, even written by hand", async () => {
      const card = await twoBoutCard();
      const fan = await fanWithCoins();

      const { entry } = await accepted(
        await submit({ amount: 10, predictions: [winner(card)] }, fan.cookie),
      );

      expect((await cancel(entry.id, fan.cookie)).status).toBe(200);

      const written = await testDatabase()
        .execute(
          sql`insert into coin_transactions
                (season_id, user_id, kind, amount, reason, cause, cause_id)
              select season_id, user_id, 'entry_refund', amount, 'again', 'entry', id
              from entries where id = ${entry.id}::uuid`,
        )
        .then(
          () => "wrote it",
          (refusal: Error) => `${refusal.message} ${refusal.cause}`,
        );

      expect(written).toContain(ENTRIES_ARE_REFUNDED_IN_FULL);
    });

    it("refuses to put a cancelled Entry back, even written by hand", async () => {
      // A cancelled Entry whose Coins are already in the Balance, playing on
      // as though they were still committed.
      const card = await twoBoutCard();
      const fan = await fanWithCoins();

      const { entry } = await accepted(
        await submit({ amount: 10, predictions: [winner(card)] }, fan.cookie),
      );

      expect((await cancel(entry.id, fan.cookie)).status).toBe(200);

      const written = await testDatabase()
        .execute(sql`update entries set status = 'open' where id = ${entry.id}::uuid`)
        .then(
          () => "wrote it",
          (refusal: Error) => `${refusal.message} ${refusal.cause}`,
        );

      expect(written).toContain(AN_ENTRY_IS_CANCELLED_ONCE_OUT_OF_OPEN);
    });

    it("refuses to cancel an Entry whose Bout has locked, even written by hand", async () => {
      // The route asks first so that a fan is told which Bout and why; this is
      // what is true regardless, and it is the rule the whole ticket rests on.
      const card = await twoBoutCard();
      const fan = await fanWithCoins();

      const { entry } = await accepted(
        await submit({ amount: 10, predictions: [winner(card, 0)] }, fan.cookie),
      );

      await lockBout(card.bouts[0]!.id, card.admin.cookie);

      const written = await testDatabase()
        .transaction(async (tx) => {
          await tx.execute(
            sql`update entries set status = 'cancelled' where id = ${entry.id}::uuid`,
          );

          await tx.execute(
            sql`insert into coin_transactions
                  (season_id, user_id, kind, amount, reason, cause, cause_id)
                select season_id, user_id, 'entry_refund', amount, 'by hand', 'entry', id
                from entries where id = ${entry.id}::uuid`,
          );
        })
        .then(
          () => "wrote it",
          (refusal: Error) => `${refusal.message} ${refusal.cause}`,
        );

      expect(written).toContain(ENTRIES_ARE_CANCELLED_WHILE_EVERY_BOUT_IS_OPEN);
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

    it("offers every answer to both Questions as something to pick", async () => {
      // #33 puts the method beside the winner, and both are pickable in their
      // own right: two corners and three methods, five buttons, none of them
      // reachable only after another has been pressed.
      await upcomingCard();
      const fan = await fanWithCoins();

      const rendered = await page(fan.cookie);

      expect(rendered).toContain(QUESTION_LABELS.winner);
      expect(rendered).toContain(QUESTION_LABELS.method);
      expect(rendered.match(/aria-pressed=/g)).toHaveLength(2 + METHODS.length);
    });

    it("no longer tells a fan to name a winner before anything else", async () => {
      // A guard on copy #33 retired rather than an assertion about today's
      // wording: a method standing on its own makes "pick a winner first"
      // actively wrong, and it is the sort of sentence that comes back.
      await upcomingCard();
      const fan = await fanWithCoins();

      expect(await page(fan.cookie)).not.toMatch(/pick a winner/i);
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

    it("lists the Entries a fan has committed, with a way to take one back", async () => {
      // The listing is server-rendered with the fan's own cookie, which is the
      // half a component test would not have caught: a page that asked the API
      // without it would be answered 401 for exactly the fans it is for.
      const card = await upcomingCard();
      const fan = await fanWithCoins();

      await submit({ amount: 15, predictions: [winner(card, 0, "blue")] }, fan.cookie);

      const rendered = await page(fan.cookie);

      expect(rendered).toContain("Your Entries");
      expect(rendered).toContain("Levan Beridze");
      expect(rendered).toContain("Cancel Entry");
    });

    it("says why an Entry can no longer be cancelled, before the fan tries", async () => {
      const card = await upcomingCard();
      const fan = await fanWithCoins();

      await submit({ amount: 15, predictions: [winner(card)] }, fan.cookie);
      await lockBout(card.bouts[0]!.id, card.admin.cookie);

      const rendered = await page(fan.cookie);

      expect(rendered).toContain(CANCELLATION_MESSAGES.boutLocked);
      expect(rendered).not.toContain("Cancel Entry");
    });

    it("tells a fan with no Entries that this is where they will be", async () => {
      await upcomingCard();
      const fan = await fanWithCoins();

      expect(await page(fan.cookie)).toContain(CANCELLATION_MESSAGES.noneYet);
    });

    it("offers nothing to pick on a Bout nobody has opened", async () => {
      await upcomingCard({ open: false });
      const fan = await fanWithCoins();

      const rendered = await page(fan.cookie);

      expect(rendered).not.toMatch(/aria-pressed/);
    });
  });
});
