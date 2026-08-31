import { $fetch } from "@nuxt/test-utils/e2e";
import { eq, inArray, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { STARTING_BALANCE } from "../../shared/coins";
import { COMBINED_MULTIPLIER_CAP } from "../../shared/entries";
import { gradePrediction, RESULT_MESSAGES } from "../../shared/results";
import {
  balanceCache,
  boutLocks,
  boutResults,
  bouts,
  coinTransactions,
  entries,
  predictions,
} from "../../server/db/schema";
import { A_LOCKED_BOUT_IS_NEVER_REOPENED } from "../../server/utils/locks";
import {
  A_RESULTS_ROUND_WAS_OFFERED,
  ONE_RESULT_PER_BOUT,
  RESULTS_ARE_ENTERED_ON_BOUTS_THAT_LOCKED,
  RESULTS_ARE_ENTERED_ON_SETTLED_BOUTS,
} from "../../server/utils/results";
import type { Settlement } from "../../server/utils/results";
import { postJson, signUp } from "../helpers/accounts";
import {
  cardBout,
  cardInTheGame,
  cardToPrice,
  enterResult,
  lockBout,
  openedSeasonId,
  TEST_MULTIPLIERS,
  type CardInTheGame,
} from "../helpers/cards";
import { testDatabase } from "../helpers/database";
import { setupTestServer } from "../helpers/server";
import { confirmEmail, fanId } from "../helpers/users";

/**
 * Entering a result, and the Coins that move behind it.
 *
 * The highest-risk file in the suite, about the highest-risk ticket in the set.
 * This is the only place in the product where a bug creates or destroys Coins
 * with no error anywhere: everything else either takes an Amount a fan typed or
 * grants a fixed hundred, and here the numbers are worked out from Multipliers
 * frozen weeks earlier against a Result somebody typed while watching a fight.
 *
 * So the cases are weighted towards the failures that would go unnoticed rather
 * than the ones that would throw: a Reward paid twice, an Entry that won and
 * was never paid, a Balance that stopped matching the ledger, and a settlement
 * that committed half of itself.
 *
 * A file of its own rather than more cases in `test/server/entries.test.ts`,
 * which costs a second Nuxt build on every run. What buys it is that the
 * failures here are a different kind: that file is a fan being refused, this
 * one is the game paying out. It runs on `DATABASE_POOL_MAX=1` like the rest of
 * the suite, so a read reaching for a second connection while settlement holds
 * a transaction deadlocks here rather than in production (ADR-0010).
 */
/** A promise something else decides the moment of, and the switch that does. */
function resolvable() {
  let resolve = () => {};
  const waited = new Promise<void>((settle) => {
    resolve = settle;
  });

  return { waited, resolve: () => resolve() };
}

describe("entering a result", async () => {
  await setupTestServer();

  /** A fan who can play: a Season's Coins, and a confirmed address. */
  async function fanWithCoins() {
    const signedUp = await signUp();

    await confirmEmail(signedUp.details.email);

    return { ...signedUp, id: await fanId(signedUp.details.email) };
  }

  /** A card two hours out, which is a card every Bout on is still open. */
  function upcomingCard(bouts: number) {
    return cardInTheGame({
      scheduledStart: new Date(Date.now() + 120 * 60_000),
      bouts: Array.from({ length: bouts }, (_, place) =>
        cardBout({ cardOrder: place + 1, mainEvent: place === bouts - 1 }),
      ),
    });
  }

  /** Submits an Entry the way the panel on the card does. */
  async function submit(
    fan: { cookie: string },
    amount: number,
    predictions: { boutId: string; corner?: "red" | "blue"; method?: string; round?: number }[],
  ) {
    const response = await postJson(
      "/api/predictions/entries",
      { amount, predictions: predictions.map((one) => ({ corner: "red", ...one })) },
      fan.cookie,
    );

    if (response.status !== 201) {
      throw new Error(`The Entry was not accepted: ${await response.text()}`);
    }

    return (await response.json()) as { entry: { id: string }; balance: number };
  }

  /** Locks a Bout and enters its result, which is how a card is settled. */
  async function settle(
    card: CardInTheGame,
    place: number,
    result: {
      winner?: "red" | "blue";
      method?: "ko_tko" | "submission" | "decision";
      round?: number | null;
    },
  ) {
    const bout = card.bouts[place]!;

    await lockBout(bout.id, card.admin.cookie);

    const entered = await enterResult(
      bout.id,
      { winner: "red", method: "decision", round: null, ...result },
      card.admin.cookie,
    );

    if (!entered.ok) throw new Error(`The result was not entered: ${await entered.text()}`);

    return (await entered.json()) as { settlement: Settlement };
  }

  /** Where an Entry stands, read back from the row settlement wrote. */
  async function statusOf(entryId: string): Promise<string> {
    const [entry] = await testDatabase()
      .select({ status: entries.status })
      .from(entries)
      .where(eq(entries.id, entryId));

    return entry?.status ?? "no such Entry";
  }

  /** Every Coin Transaction written about a fan, oldest first. */
  function ledgerFor(userId: string) {
    return testDatabase()
      .select()
      .from(coinTransactions)
      .where(eq(coinTransactions.userId, userId))
      .orderBy(coinTransactions.createdAt);
  }

  /** What the site header would show this fan. */
  function balance(cookie: string) {
    return $fetch<{ balance: number | null }>("/api/coins/balance", { headers: { cookie } });
  }

  describe("a single Prediction", () => {
    it("returns the Amount at its Multiplier when it lands", async () => {
      const card = await upcomingCard(1);
      const fan = await fanWithCoins();

      const { entry } = await submit(fan, 20, [{ boutId: card.bouts[0]!.id, corner: "red" }]);

      const { settlement } = await settle(card, 0, { winner: "red" });

      expect(settlement).toMatchObject({ graded: 1, won: 1, lost: 0, stillOpen: 0, paid: 40 });
      expect(await statusOf(entry.id)).toBe("won");

      // The winner Outcome pays ×2, so 20 Coins return 40: the Amount left the
      // Balance at submission and the Reward comes back on top of what is left.
      const ledger = await ledgerFor(fan.id);

      expect(ledger.map((row) => [row.kind, row.amount])).toEqual([
        ["season_grant", STARTING_BALANCE],
        ["entry_commitment", -20],
        ["entry_reward", 40],
      ]);

      expect(await balance(fan.cookie)).toMatchObject({ balance: STARTING_BALANCE - 20 + 40 });
    });

    it("credits nothing when the fan picked the other corner", async () => {
      const card = await upcomingCard(1);
      const fan = await fanWithCoins();

      const { entry } = await submit(fan, 20, [{ boutId: card.bouts[0]!.id, corner: "blue" }]);

      const { settlement } = await settle(card, 0, { winner: "red" });

      expect(settlement).toMatchObject({ graded: 1, won: 0, lost: 1, paid: 0 });
      expect(await statusOf(entry.id)).toBe("lost");

      // A Lost Entry writes no Coin Transaction at all: the Amount left the
      // Balance when it was submitted, so losing is a status and nothing more.
      const ledger = await ledgerFor(fan.id);

      expect(ledger.map((row) => row.kind)).toEqual(["season_grant", "entry_commitment"]);
      expect(await balance(fan.cookie)).toMatchObject({ balance: STARTING_BALANCE - 20 });
    });

    it("is wrong when the method the fan named is not the one it ended by", async () => {
      const card = await upcomingCard(1);
      const fan = await fanWithCoins();

      const { entry } = await submit(fan, 10, [
        { boutId: card.bouts[0]!.id, corner: "red", method: "submission", round: 2 },
      ]);

      await settle(card, 0, { winner: "red", method: "ko_tko", round: 2 });

      expect(await statusOf(entry.id)).toBe("lost");
    });

    it("pays a deepened Prediction at the product of its answers", async () => {
      const card = await upcomingCard(1);
      const fan = await fanWithCoins();

      const { entry } = await submit(fan, 10, [
        { boutId: card.bouts[0]!.id, corner: "red", method: "ko_tko", round: 2 },
      ]);

      const { settlement } = await settle(card, 0, {
        winner: "red",
        method: "ko_tko",
        round: 2,
      });

      // ×2 for the winner, ×2.5 for the method and ×3 for the round is ×15.
      expect(settlement.paid).toBe(150);
      expect(await statusOf(entry.id)).toBe("won");
    });
  });

  describe("a Chained Entry", () => {
    it("pays only once every Prediction in it has won", async () => {
      const card = await upcomingCard(2);
      const fan = await fanWithCoins();

      const { entry } = await submit(fan, 20, [
        { boutId: card.bouts[0]!.id },
        { boutId: card.bouts[1]!.id },
      ]);

      const first = await settle(card, 0, { winner: "red" });

      // Correct, and nothing has been paid: a Reward is the Amount at the
      // combined Multiplier of the whole chain, so there is nothing to pay yet.
      expect(first.settlement).toMatchObject({ graded: 1, won: 0, lost: 0, stillOpen: 1, paid: 0 });
      expect(await statusOf(entry.id)).toBe("open");
      expect(await balance(fan.cookie)).toMatchObject({ balance: STARTING_BALANCE - 20 });

      const second = await settle(card, 1, { winner: "red" });

      // ×2 twice is ×4, so 20 Coins return 80.
      expect(second.settlement).toMatchObject({ won: 1, paid: 80 });
      expect(await statusOf(entry.id)).toBe("won");
    });

    it("is Lost the moment one Prediction fails, with Bouts still to settle", async () => {
      const card = await upcomingCard(3);
      const fan = await fanWithCoins();

      const { entry } = await submit(fan, 20, [
        { boutId: card.bouts[0]!.id, corner: "blue" },
        { boutId: card.bouts[1]!.id },
        { boutId: card.bouts[2]!.id },
      ]);

      const { settlement } = await settle(card, 0, { winner: "red" });

      expect(settlement).toMatchObject({ graded: 1, lost: 1, stillOpen: 0 });
      expect(await statusOf(entry.id)).toBe("lost");
    });

    it("is left alone by the Bouts that settle after it has lost", async () => {
      const card = await upcomingCard(2);
      const fan = await fanWithCoins();

      const { entry } = await submit(fan, 20, [
        { boutId: card.bouts[0]!.id, corner: "blue" },
        { boutId: card.bouts[1]!.id, corner: "red" },
      ]);

      await settle(card, 0, { winner: "red" });

      const second = await settle(card, 1, { winner: "red" });

      // The second Bout's Result is entered and the Bout settles; the Entry is
      // not among the ones it grades, because it was decided a Bout ago.
      expect(second.settlement).toMatchObject({ graded: 0, won: 0, lost: 0, paid: 0 });
      expect(await statusOf(entry.id)).toBe("lost");
      expect((await ledgerFor(fan.id)).map((row) => row.kind)).toEqual([
        "season_grant",
        "entry_commitment",
      ]);
    });

    it("returns no more than the cap however far it is chained", async () => {
      const card = await upcomingCard(8);
      const fan = await fanWithCoins();

      const { entry } = await submit(
        fan,
        10,
        card.bouts.map((bout) => ({ boutId: bout.id })),
      );

      let paid = 0;

      for (const place of card.bouts.keys()) {
        paid = (await settle(card, place, { winner: "red" })).settlement.paid;
      }

      // Eight winner picks at ×2 multiply out to ×256, which is well past the
      // cap: 10 Coins return 1000 rather than 2560.
      expect(TEST_MULTIPLIERS.winner ** card.bouts.length).toBeGreaterThan(COMBINED_MULTIPLIER_CAP);
      expect(paid).toBe(10 * COMBINED_MULTIPLIER_CAP);
      expect(await statusOf(entry.id)).toBe("won");
    });
  });

  describe("the Bout itself", () => {
    it("locks a Bout that was still open, and records the admin who settled it", async () => {
      const card = await upcomingCard(1);
      const bout = card.bouts[0]!;

      // Deliberately not locked first: this is #12's last criterion, and the
      // case is an admin who reaches the result before they reach the Lock.
      const entered = await enterResult(
        bout.id,
        { winner: "red", method: "decision", round: null },
        card.admin.cookie,
      );

      expect(entered.status).toBe(200);

      const [lock] = await testDatabase()
        .select()
        .from(boutLocks)
        .where(eq(boutLocks.boutId, bout.id));

      expect(lock).toMatchObject({ kind: "result", lockedBy: card.admin.id });

      const [settled] = await testDatabase()
        .select({ status: bouts.status })
        .from(bouts)
        .where(eq(bouts.id, bout.id));

      expect(settled?.status).toBe("settled");
    });

    it("keeps the Lock an admin already made rather than writing a second one", async () => {
      const card = await upcomingCard(1);
      const bout = card.bouts[0]!;

      await lockBout(bout.id, card.admin.cookie);

      const [manual] = await testDatabase()
        .select()
        .from(boutLocks)
        .where(eq(boutLocks.boutId, bout.id));

      await enterResult(
        bout.id,
        { winner: "red", method: "decision", round: null },
        card.admin.cookie,
      );

      const recorded = await testDatabase()
        .select()
        .from(boutLocks)
        .where(eq(boutLocks.boutId, bout.id));

      expect(recorded.length).toBe(1);
      expect(recorded[0]?.lockedAt).toEqual(manual?.lockedAt);
      expect(recorded[0]?.kind).toBe("manual");
    });
  });

  describe("the Balance the ledger says", () => {
    it("matches the materialised copy after a settlement", async () => {
      const card = await upcomingCard(2);
      const fans = [await fanWithCoins(), await fanWithCoins()];

      await submit(fans[0]!, 30, [{ boutId: card.bouts[0]!.id }, { boutId: card.bouts[1]!.id }]);
      await submit(fans[1]!, 15, [{ boutId: card.bouts[0]!.id, corner: "blue" }]);

      await settle(card, 0, { winner: "red" });
      await settle(card, 1, { winner: "red" });

      const cached = await testDatabase()
        .select()
        .from(balanceCache)
        .where(
          inArray(
            balanceCache.userId,
            fans.map((fan) => fan.id),
          ),
        );

      for (const fan of fans) {
        const ledger = await ledgerFor(fan.id);
        const owed = ledger.reduce((coins, row) => coins + row.amount, 0);

        expect(cached.find((row) => row.userId === fan.id)?.balance).toBe(owed);
      }

      // 30 Coins on a chain of two at ×2 each returns 120; 15 on the losing
      // corner returns nothing.
      expect(await balance(fans[0]!.cookie)).toMatchObject({
        balance: STARTING_BALANCE - 30 + 120,
      });
      expect(await balance(fans[1]!.cookie)).toMatchObject({ balance: STARTING_BALANCE - 15 });
    });
  });

  describe("settling the same Bout twice", () => {
    it("is refused, and pays nobody a second time", async () => {
      const card = await upcomingCard(1);
      const fan = await fanWithCoins();

      await submit(fan, 20, [{ boutId: card.bouts[0]!.id }]);
      await settle(card, 0, { winner: "red" });

      const again = await enterResult(
        card.bouts[0]!.id,
        { winner: "blue", method: "ko_tko", round: 1 },
        card.admin.cookie,
      );

      expect(again.status).toBe(409);
      expect((await again.json()).message).toBe(RESULT_MESSAGES.alreadySettled);

      // The Result stands as it was entered, and one Reward was paid.
      const ledger = await ledgerFor(fan.id);

      expect(ledger.filter((row) => row.kind === "entry_reward").length).toBe(1);
      expect(await balance(fan.cookie)).toMatchObject({ balance: STARTING_BALANCE - 20 + 40 });
    });

    it("is refused by Postgres too, whatever a route believed", async () => {
      const card = await upcomingCard(1);

      await settle(card, 0, { winner: "red" });

      // Both admins pressed at once and both were told the Bout was open. The
      // key on `bout_results` is what makes the second of them harmless.
      const written = await testDatabase()
        .insert(boutResults)
        .values({
          boutId: card.bouts[0]!.id,
          winner: "blue",
          method: "decision",
          round: null,
          enteredBy: card.admin.id,
        })
        .then(
          () => "wrote it",
          (refusal: Error) => `${refusal.message} ${refusal.cause}`,
        );

      expect(written).toMatch(new RegExp(ONE_RESULT_PER_BOUT));
    });
  });

  describe("a settlement that cannot finish", () => {
    it("moves no Coins and grades no Entry", async () => {
      const card = await upcomingCard(1);
      const fan = await fanWithCoins();

      const { entry } = await submit(fan, 20, [{ boutId: card.bouts[0]!.id }]);

      await lockBout(card.bouts[0]!.id, card.admin.cookie);

      // A Reward this Entry already holds, which is a state nothing can
      // actually reach — and exactly what `coin_transactions_one_reward_per_entry`
      // is there to refuse. Planting it is how this test makes the write at the
      // very end of settlement fail, with everything before it already done.
      await testDatabase()
        .insert(coinTransactions)
        .values({
          seasonId: await openedSeasonId(),
          userId: fan.id,
          kind: "entry_reward",
          amount: 1,
          reason: "A Reward this Entry is not owed",
          cause: "entry",
          causeId: entry.id,
        });

      const entered = await enterResult(
        card.bouts[0]!.id,
        { winner: "red", method: "decision", round: null },
        card.admin.cookie,
      );

      expect(entered.ok).toBe(false);

      // Nothing happened. Not the Result, not the settling of the Bout, not the
      // grading of the Entry, and not a second Reward.
      expect(
        (
          await testDatabase()
            .select()
            .from(boutResults)
            .where(eq(boutResults.boutId, card.bouts[0]!.id))
        ).length,
      ).toBe(0);

      const [bout] = await testDatabase()
        .select({ status: bouts.status })
        .from(bouts)
        .where(eq(bouts.id, card.bouts[0]!.id));

      expect(bout?.status).toBe("locked");
      expect(await statusOf(entry.id)).toBe("open");
      expect((await ledgerFor(fan.id)).filter((row) => row.kind === "entry_reward").length).toBe(1);
    });
  });

  describe("a Lost Entry's remaining Predictions", () => {
    it("are still graded, so a fan can see how close they were", async () => {
      const card = await upcomingCard(2);
      const fan = await fanWithCoins();

      const { entry } = await submit(fan, 20, [
        { boutId: card.bouts[0]!.id, corner: "blue" },
        { boutId: card.bouts[1]!.id, corner: "red" },
      ]);

      await settle(card, 0, { winner: "red" });
      await settle(card, 1, { winner: "red" });

      const settled = await cardToPrice(card.eventId, card.admin.cookie);
      const results = new Map(settled.bouts.map((bout) => [bout.id, bout.result]));

      // Both Bouts carry a Result, including the one whose Entries were already
      // decided — so the second Prediction can still be graded and shown.
      const made = await testDatabase()
        .select()
        .from(predictions)
        .where(eq(predictions.entryId, entry.id));

      const grades = card.bouts.map((bout) => {
        const pick = made.find((one) => one.boutId === bout.id)!;

        return gradePrediction(pick, results.get(bout.id) ?? null);
      });

      expect(grades).toEqual(["wrong", "correct"]);
      expect(await statusOf(entry.id)).toBe("lost");
    });
  });

  describe("a result an admin cannot enter", () => {
    it("refuses a Bout nobody opened, which took no Predictions", async () => {
      const card = await cardInTheGame({
        scheduledStart: new Date(Date.now() + 120 * 60_000),
        open: false,
      });

      const refused = await enterResult(
        card.bouts[0]!.id,
        { winner: "red", method: "decision", round: null },
        card.admin.cookie,
      );

      expect(refused.status).toBe(409);
      expect((await refused.json()).message).toBe(RESULT_MESSAGES.boutNotOpened);
    });

    it("refuses a round on a Decision, which is the Bout going the distance", async () => {
      const card = await upcomingCard(1);

      await lockBout(card.bouts[0]!.id, card.admin.cookie);

      const refused = await enterResult(
        card.bouts[0]!.id,
        { winner: "red", method: "decision", round: 2 },
        card.admin.cookie,
      );

      expect(refused.status).toBe(422);
      expect((await refused.json()).message).toBe(RESULT_MESSAGES.aDecisionHasNoRound);
    });

    it("refuses a finish with no round, because it happened in one", async () => {
      const card = await upcomingCard(1);

      await lockBout(card.bouts[0]!.id, card.admin.cookie);

      const refused = await enterResult(
        card.bouts[0]!.id,
        { winner: "red", method: "ko_tko", round: null },
        card.admin.cookie,
      );

      expect(refused.status).toBe(422);
      expect((await refused.json()).message).toBe(RESULT_MESSAGES.aFinishHasARound);
    });

    it("refuses a round the Bout was never scheduled for", async () => {
      const card = await upcomingCard(1);

      await lockBout(card.bouts[0]!.id, card.admin.cookie);

      const refused = await enterResult(
        card.bouts[0]!.id,
        { winner: "red", method: "ko_tko", round: 4 },
        card.admin.cookie,
      );

      expect(refused.status).toBe(422);
      expect((await refused.json()).message).toBe(RESULT_MESSAGES.roundNotScheduled(3));
    });

    it("refuses a Bout id that is not one", async () => {
      const card = await upcomingCard(1);

      const refused = await enterResult(
        "not-a-bout",
        { winner: "red", method: "decision", round: null },
        card.admin.cookie,
      );

      expect(refused.status).toBe(404);
    });
  });

  describe("what Postgres holds, whatever a route believed", () => {
    it("never reopens a Bout that has settled", async () => {
      const card = await upcomingCard(1);

      await settle(card, 0, { winner: "red" });

      const reopened = await testDatabase()
        .update(bouts)
        .set({ status: "open" })
        .where(eq(bouts.id, card.bouts[0]!.id))
        .then(
          () => "reopened it",
          (refusal: Error) => `${refusal.message} ${refusal.cause}`,
        );

      expect(reopened).toMatch(new RegExp(A_LOCKED_BOUT_IS_NEVER_REOPENED));
    });

    it("refuses a Result beside a Bout that has not settled", async () => {
      const card = await upcomingCard(1);

      await lockBout(card.bouts[0]!.id, card.admin.cookie);

      const written = await testDatabase()
        .insert(boutResults)
        .values({
          boutId: card.bouts[0]!.id,
          winner: "red",
          method: "decision",
          round: null,
          enteredBy: card.admin.id,
        })
        .then(
          () => "wrote it",
          (refusal: Error) => `${refusal.message} ${refusal.cause}`,
        );

      expect(written).toMatch(new RegExp(RESULTS_ARE_ENTERED_ON_SETTLED_BOUTS));
    });

    it("refuses a Result on a Bout that is still taking Predictions", async () => {
      const card = await upcomingCard(1);

      const written = await testDatabase()
        .insert(boutResults)
        .values({
          boutId: card.bouts[0]!.id,
          winner: "red",
          method: "decision",
          round: null,
          enteredBy: card.admin.id,
        })
        .then(
          () => "wrote it",
          (refusal: Error) => `${refusal.message} ${refusal.cause}`,
        );

      expect(written).toMatch(new RegExp(RESULTS_ARE_ENTERED_ON_BOUTS_THAT_LOCKED));
    });

    it("refuses a Result naming a round the Bout never offered", async () => {
      const card = await upcomingCard(1);

      await lockBout(card.bouts[0]!.id, card.admin.cookie);

      const written = await testDatabase()
        .insert(boutResults)
        .values({
          boutId: card.bouts[0]!.id,
          winner: "red",
          method: "ko_tko",
          round: 4,
          enteredBy: card.admin.id,
        })
        .then(
          () => "wrote it",
          (refusal: Error) => `${refusal.message} ${refusal.cause}`,
        );

      expect(written).toMatch(new RegExp(A_RESULTS_ROUND_WAS_OFFERED));
    });
  });

  /**
   * Two Bouts of one Chained Entry settling at once, which is an admin working
   * down a card quickly — or two of them at cageside with a phone each.
   *
   * The failure being guarded is the quietest one in the product. Each
   * settlement reads the Entry's other Bouts to decide whether the chain is
   * finished. If both read before either commits, both find a Bout still to
   * come, both leave the Entry Open, and a fan who won every Prediction is
   * never paid — with nothing written wrong anywhere for anybody to find later.
   *
   * Two settlements fired at one another would not prove this: they would
   * almost always miss, and the case would pass whether or not anything held a
   * lock. So the other settlement is held still instead. A transaction on this
   * process's own connection takes the Entry's row and keeps it, which is
   * exactly the state a settlement in flight leaves it in, and only then does
   * it write the Result the settlement under test has to notice.
   */
  describe("a second Bout of the same Entry settling at the same moment", () => {
    it("waits for it, and then pays the chain it finished", async () => {
      const card = await upcomingCard(2);
      const fan = await fanWithCoins();

      const { entry } = await submit(fan, 20, [
        { boutId: card.bouts[0]!.id },
        { boutId: card.bouts[1]!.id },
      ]);

      for (const bout of card.bouts) await lockBout(bout.id, card.admin.cookie);

      const holding = resolvable();
      const finish = resolvable();

      // Standing in for the settlement of the second Bout: it holds the Entry
      // the way `grade` does, and writes its Result while the first is waiting.
      const elsewhere = testDatabase().transaction(async (tx) => {
        await tx.execute(sql`select id from entries where id = ${entry.id}::uuid for update`);

        holding.resolve();
        await finish.waited;

        await tx.insert(boutResults).values({
          boutId: card.bouts[1]!.id,
          winner: "red",
          method: "decision",
          round: null,
          enteredBy: card.admin.id,
        });

        await tx.update(bouts).set({ status: "settled" }).where(eq(bouts.id, card.bouts[1]!.id));
      });

      await holding.waited;

      const entering = enterResult(
        card.bouts[0]!.id,
        { winner: "red", method: "decision", round: null },
        card.admin.cookie,
      );

      // Long enough that it would have finished several times over if nothing
      // were holding it up. It has not, because it is queued behind the Entry.
      await new Promise((wait) => setTimeout(wait, 500));

      const [waiting] = await testDatabase()
        .select({ status: bouts.status })
        .from(bouts)
        .where(eq(bouts.id, card.bouts[0]!.id));

      // Let the held transaction go whatever this says, so that a failure here
      // is a failure rather than a suite that hangs until a hook times out.
      finish.resolve();
      await elsewhere;

      expect(waiting?.status).toBe("locked");

      expect((await entering).status).toBe(200);

      // And what it read once it had the Entry is what the other settlement
      // committed while it waited: both Bouts in, so the chain is finished.
      expect(await statusOf(entry.id)).toBe("won");
      expect(
        (await ledgerFor(fan.id))
          .filter((row) => row.kind === "entry_reward")
          .map((row) => row.amount),
      ).toEqual([80]);
    });
  });
});
