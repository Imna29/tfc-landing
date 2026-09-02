import { describe, expect, it } from "vitest";
import { STARTING_BALANCE } from "../../shared/coins";
import { setupTestServer } from "../helpers/server";
import { $fetch } from "@nuxt/test-utils/e2e";
import { sql } from "drizzle-orm";
import { RESULT_MESSAGES } from "../../shared/results";
import { coinTransactions } from "../../server/db/schema";
import {
  A_REVERSAL_UNDOES_THE_ROW_IT_NAMES,
  BOUT_RESULT_CORRECTIONS_ARE_APPEND_ONLY,
  CORRECTED_RESULTS_ARE_RECORDED,
  ONE_REVERSAL_PER_ROW,
} from "../../server/utils/corrections";
import { ENTRIES_ARE_REFUNDED_IN_FULL } from "../../server/utils/cancellation";
import { WON_ENTRIES_ARE_REWARDED_ONCE } from "../../server/utils/results";
import { postJson } from "../helpers/accounts";
import { cardToPrice, correctResult, lockBout, openedSeasonId } from "../helpers/cards";
import { testDatabase } from "../helpers/database";
import {
  balance,
  correct,
  correctToNoResult,
  fanWithCoins,
  ledgerFor,
  methodOn,
  roundOn,
  settle,
  settleAsNoResult,
  statusOf,
  submit,
  upcomingCard,
  winnerOn,
} from "../helpers/playing";

/**
 * Correcting a result that was entered wrong, after Entries have settled
 * against it.
 *
 * This is the scenario ADR-0003 built the whole ledger for. A Result is typed
 * in by somebody watching a fight, and when it is typed in wrong there are
 * already Rewards in Balances that fans have seen and spent. The fix is
 * reversing Coin Transactions and grading again, so that the mistake and its
 * correction are both in the ledger — the alternative being a Balance quietly
 * rewritten, which is indefensible the first time a fan disputes theirs in
 * public.
 *
 * So the cases here are about what the ledger says afterwards as much as about
 * where the Entries end up: a Reward reversed and re-paid, an Entry revived
 * from a fail-fast loss, and a Balance that still matches the rows it is
 * derived from.
 */
describe("correcting a result", async () => {
  await setupTestServer();

  describe("an Entry the correction flips", () => {
    it("pays the fan whose Prediction turns out to have landed", async () => {
      const card = await upcomingCard(1);
      const fan = await fanWithCoins();

      const { entry } = await submit(fan, 20, [winnerOn(card.bouts[0]!.id, "red")]);

      // Entered the wrong way round: the admin read the card upside down, and
      // every Entry on the Bout has already settled against it.
      await settle(card, 0, { winner: "blue" });

      expect(await statusOf(entry.id)).toBe("lost");

      const { correction } = await correct(card, 0, { winner: "red" });

      expect(correction).toMatchObject({ graded: 1, won: 1, lost: 0, paid: 40, reversed: 0 });
      expect(await statusOf(entry.id)).toBe("won");

      const ledger = await ledgerFor(fan.id);

      expect(ledger.map((row) => [row.kind, row.amount])).toEqual([
        ["season_grant", STARTING_BALANCE],
        ["entry_commitment", -20],
        ["entry_reward", 40],
      ]);

      expect(await balance(fan.cookie)).toMatchObject({ balance: STARTING_BALANCE - 20 + 40 });
    });

    it("takes the Reward back off the fan whose Prediction turns out to have missed", async () => {
      const card = await upcomingCard(1);
      const fan = await fanWithCoins();

      const { entry } = await submit(fan, 20, [winnerOn(card.bouts[0]!.id, "red")]);

      await settle(card, 0, { winner: "red" });

      expect(await statusOf(entry.id)).toBe("won");
      expect(await balance(fan.cookie)).toMatchObject({ balance: STARTING_BALANCE - 20 + 40 });

      const { correction } = await correct(card, 0, { winner: "blue" });

      expect(correction).toMatchObject({ graded: 1, won: 0, lost: 1, paid: 0, reversed: 40 });
      expect(await statusOf(entry.id)).toBe("lost");

      // The Reward is still there, with the row that took it back beside it.
      // That is the whole of ADR-0003: what happened is not unwritten, so a
      // fan who saw 120 Coins and now sees 80 can be shown why.
      const ledger = await ledgerFor(fan.id);

      expect(ledger.map((row) => [row.kind, row.amount])).toEqual([
        ["season_grant", STARTING_BALANCE],
        ["entry_commitment", -20],
        ["entry_reward", 40],
        ["entry_reversal", -40],
      ]);

      expect(ledger.at(-1)?.reverses).toBe(ledger.at(-2)?.id);
      expect(await balance(fan.cookie)).toMatchObject({ balance: STARTING_BALANCE - 20 });
    });

    it("moves nothing at all for the fans the corrected answer does not change", async () => {
      const card = await upcomingCard(1);
      const won = await fanWithCoins();
      const lost = await fanWithCoins();

      // Both fans answered the winner Question, one either way. The Bout was
      // recorded as ending by Decision and actually ended by KO/TKO, which is
      // a correction to a Question neither of them asked (ADR-0014): it is
      // re-graded and neither Entry moves.
      const right = await submit(won, 20, [winnerOn(card.bouts[0]!.id, "red")]);
      const wrong = await submit(lost, 20, [winnerOn(card.bouts[0]!.id, "blue")]);

      await settle(card, 0, { winner: "red", method: "decision" });

      const { correction } = await correct(card, 0, {
        winner: "red",
        method: "ko_tko",
        round: 2,
      });

      expect(correction).toMatchObject({ graded: 2, won: 1, lost: 1, reversed: 0, paid: 0 });
      expect(await statusOf(right.entry.id)).toBe("won");
      expect(await statusOf(wrong.entry.id)).toBe("lost");

      // Nothing was written about either of them: no reversal, no second
      // Reward, and the row the winner was paid with is the row they are
      // still holding.
      expect((await ledgerFor(won.id)).map((row) => row.kind)).toEqual([
        "season_grant",
        "entry_commitment",
        "entry_reward",
      ]);

      expect(await balance(won.cookie)).toMatchObject({
        balance: STARTING_BALANCE - 20 + 40,
      });
      expect(await balance(lost.cookie)).toMatchObject({ balance: STARTING_BALANCE - 20 });
    });

    it("takes back a method Prediction the corrected winner turns out to have missed", async () => {
      // The corner check reaching the path that moves Coins the other way
      // (ADR-0015). Nothing about *how* the Bout ended changes here — it was
      // a Submission before the correction and a Submission after it — and the
      // Entry flips from Won to Lost because the fighter who did the
      // submitting turns out to have been the other one.
      const card = await upcomingCard(1);
      const fan = await fanWithCoins();

      const { entry } = await submit(fan, 20, [methodOn(card.bouts[0]!.id, "red", "submission")]);

      await settle(card, 0, { winner: "red", method: "submission", round: 2 });

      expect(await statusOf(entry.id)).toBe("won");

      const { correction } = await correct(card, 0, {
        winner: "blue",
        method: "submission",
        round: 2,
      });

      // The method Outcome paid ×2.50, so 50 Coins go back the way they came.
      expect(correction).toMatchObject({ graded: 1, won: 0, lost: 1, paid: 0, reversed: 50 });
      expect(await statusOf(entry.id)).toBe("lost");
      expect(await balance(fan.cookie)).toMatchObject({ balance: STARTING_BALANCE - 20 });
    });

    it("pays a round Prediction the corrected winner turns out to have landed", async () => {
      // And the same correction the other way round, on the Question a fan is
      // most likely to name the wrong fighter in: the round was right all
      // along, and the fighter it named was only wrong because the Result was.
      const card = await upcomingCard(1);
      const fan = await fanWithCoins();

      const { entry } = await submit(fan, 20, [roundOn(card.bouts[0]!.id, "blue", 2)]);

      await settle(card, 0, { winner: "red", method: "ko_tko", round: 2 });

      expect(await statusOf(entry.id)).toBe("lost");

      const { correction } = await correct(card, 0, {
        winner: "blue",
        method: "ko_tko",
        round: 2,
      });

      // The round Outcome pays ×3, so 20 Coins return 60.
      expect(correction).toMatchObject({ graded: 1, won: 1, lost: 0, paid: 60, reversed: 0 });
      expect(await statusOf(entry.id)).toBe("won");
      expect(await balance(fan.cookie)).toMatchObject({ balance: STARTING_BALANCE - 20 + 60 });
    });
  });

  describe("an Entry a fail-fast loss ended early", () => {
    it("is open again when the Bout that ended it did not", async () => {
      const card = await upcomingCard(2);
      const fan = await fanWithCoins();

      const { entry } = await submit(fan, 20, [
        winnerOn(card.bouts[0]!.id, "blue"),
        winnerOn(card.bouts[1]!.id, "red"),
      ]);

      await settle(card, 0, { winner: "red" });

      // Lost with a Bout still to come, which is the fail-fast rule: one
      // missed Prediction ends a chain without waiting for the rest of it.
      expect(await statusOf(entry.id)).toBe("lost");

      const { correction } = await correct(card, 0, { winner: "blue" });

      // Back where it was before anybody got the result wrong: alive, with one
      // Bout of it still to be fought. Nothing is paid — a Reward is the whole
      // chain at its combined Multiplier, and the chain is not finished.
      expect(correction).toMatchObject({ graded: 1, won: 0, lost: 0, stillOpen: 1, paid: 0 });
      expect(await statusOf(entry.id)).toBe("open");
      expect((await ledgerFor(fan.id)).map((row) => row.kind)).toEqual([
        "season_grant",
        "entry_commitment",
      ]);

      // And it pays when its last Bout settles, like any other open chain:
      // ×2 twice is ×4, so 20 Coins return 80.
      const { settlement } = await settle(card, 1, { winner: "red" });

      expect(settlement).toMatchObject({ won: 1, paid: 80 });
      expect(await statusOf(entry.id)).toBe("won");
    });
  });

  describe("a Chained Entry the correction reaches", () => {
    it("leaves the whole trail in the ledger, and a Balance that matches it", async () => {
      const card = await upcomingCard(3);
      const fan = await fanWithCoins();

      const { entry } = await submit(fan, 10, [
        winnerOn(card.bouts[0]!.id, "red"),
        winnerOn(card.bouts[1]!.id, "red"),
        winnerOn(card.bouts[2]!.id, "red"),
      ]);

      for (const place of card.bouts.keys()) await settle(card, place, { winner: "red" });

      // Three winner picks at ×2 is ×8, so 10 Coins returned 80.
      expect(await statusOf(entry.id)).toBe("won");
      expect(await balance(fan.cookie)).toMatchObject({ balance: STARTING_BALANCE - 10 + 80 });

      // The middle Bout of the chain was entered the wrong way round.
      const wrong = await correct(card, 1, { winner: "blue" });

      expect(wrong.correction).toMatchObject({ graded: 1, lost: 1, reversed: 80, paid: 0 });
      expect(await statusOf(entry.id)).toBe("lost");

      // And that correction was itself wrong, which is the case the audit
      // trail has to survive: the fan has now been paid, un-paid and paid
      // again, and every one of those is a row somebody can be shown.
      const righted = await correct(card, 1, { winner: "red" });

      expect(righted.correction).toMatchObject({ graded: 1, won: 1, reversed: 0, paid: 80 });
      expect(await statusOf(entry.id)).toBe("won");

      const ledger = await ledgerFor(fan.id);

      expect(ledger.map((row) => [row.kind, row.amount])).toEqual([
        ["season_grant", STARTING_BALANCE],
        ["entry_commitment", -10],
        ["entry_reward", 80],
        ["entry_reversal", -80],
        ["entry_reward", 80],
      ]);

      // Every reversal names the row it took back, and no row is taken back
      // twice: the second Reward stands, and it is a different row from the
      // first.
      expect(ledger.at(-2)?.reverses).toBe(ledger.at(-3)?.id);
      expect(ledger.at(-1)?.reverses).toBeNull();
      expect(ledger.at(-1)?.id).not.toBe(ledger.at(-3)?.id);

      // The materialised Balance is the ledger added up, which is what
      // ADR-0003 promises of it after every movement — this one included.
      const owed = ledger.reduce((coins, row) => coins + row.amount, 0);

      expect(owed).toBe(STARTING_BALANCE - 10 + 80);
      expect(await balance(fan.cookie)).toMatchObject({ balance: owed });
    });

    it("records what the Result said before, and who changed it", async () => {
      const card = await upcomingCard(1);

      await settle(card, 0, { winner: "red", method: "ko_tko", round: 2 });
      await correct(card, 0, { winner: "blue", method: "decision" });
      await correctToNoResult(card, 0, "no_contest");

      const [bout] = (await cardToPrice(card.eventId, card.admin.cookie)).bouts;

      // What the Bout is recorded as having produced now, and everything it
      // has been recorded as before that, oldest first.
      expect(bout?.ending).toEqual({ noResult: "no_contest" });
      expect(bout?.corrections.map((correction) => correction.ending)).toEqual([
        { result: { winner: "red", method: "ko_tko", round: 2 } },
        { result: { winner: "blue", method: "decision", round: null } },
      ]);

      // Each of them says who did it and when, which is what makes the log an
      // answer rather than a note that something changed.
      for (const correction of bout?.corrections ?? []) {
        expect(correction.by).toBe(card.admin.username);
        expect(Date.parse(correction.at)).toBeGreaterThan(Date.now() - 60_000);
      }
    });

    it("shows an admin what the Bout used to be recorded as, down the card", async () => {
      // The log where the question is actually asked: on the card, after the
      // event, with a fan's complaint in hand — the same place the Lock log is
      // read, and for the same reason.
      const card = await upcomingCard(1);

      await settle(card, 0, { winner: "red", method: "ko_tko", round: 2 });
      await correct(card, 0, { winner: "blue", method: "decision" });

      const page = await $fetch<string>(`/admin/events/${card.eventId}`, {
        headers: { cookie: card.admin.cookie },
      });

      expect(page).toContain("Result: Levan Beridze by Decision");
      expect(page).toContain("Was Giorgi Tsiklauri by KO/TKO in round 2");
      expect(page).toContain(card.admin.username);

      // And the form on a settled Bout is the one that corrects it, rather
      // than the one that would settle it a second time.
      expect(page).toContain("Correct the result");
      expect(page).toContain("Correct and re-grade");
      expect(page).not.toContain("Enter result and settle");
    });
  });

  describe("a Bout corrected to or from a No Result", () => {
    it("returns the Amount when the Bout turns out to have decided nothing", async () => {
      const card = await upcomingCard(1);
      const fan = await fanWithCoins();

      const { entry } = await submit(fan, 20, [winnerOn(card.bouts[0]!.id, "red")]);

      await settle(card, 0, { winner: "blue" });

      expect(await statusOf(entry.id)).toBe("lost");

      // The Bout was waved off rather than lost, which is nobody's Prediction
      // being wrong: every answer on it counts as ×1.0, and an Entry with
      // nothing else in it has its Amount back in full (ADR-0005).
      const { correction } = await correctToNoResult(card, 0, "no_contest");

      expect(correction).toMatchObject({ graded: 1, refunded: 1, returned: 20, reversed: 0 });
      expect(await statusOf(entry.id)).toBe("refunded");
      expect((await ledgerFor(fan.id)).map((row) => [row.kind, row.amount])).toEqual([
        ["season_grant", STARTING_BALANCE],
        ["entry_commitment", -20],
        ["entry_refund", 20],
      ]);
      expect(await balance(fan.cookie)).toMatchObject({ balance: STARTING_BALANCE });
    });

    it("takes the Amount back when the Bout turns out to have decided something", async () => {
      const card = await upcomingCard(1);
      const fan = await fanWithCoins();

      const { entry } = await submit(fan, 20, [winnerOn(card.bouts[0]!.id, "red")]);

      await settleAsNoResult(card, 0, "draw");

      expect(await statusOf(entry.id)).toBe("refunded");
      expect(await balance(fan.cookie)).toMatchObject({ balance: STARTING_BALANCE });

      const { correction } = await correct(card, 0, { winner: "red" });

      // The Amount that came back goes out again and the Prediction is graded
      // on its merits, which is a Reward rather than a refund.
      expect(correction).toMatchObject({ graded: 1, won: 1, reversed: 20, paid: 40 });
      expect(await statusOf(entry.id)).toBe("won");
      expect((await ledgerFor(fan.id)).map((row) => [row.kind, row.amount])).toEqual([
        ["season_grant", STARTING_BALANCE],
        ["entry_commitment", -20],
        ["entry_refund", 20],
        ["entry_reversal", -20],
        ["entry_reward", 40],
      ]);
      expect(await balance(fan.cookie)).toMatchObject({ balance: STARTING_BALANCE - 20 + 40 });
    });

    it("re-prices a chain that still wins, at what the surviving answers pay", async () => {
      const card = await upcomingCard(2);
      const fan = await fanWithCoins();

      const { entry } = await submit(fan, 20, [
        winnerOn(card.bouts[0]!.id, "red"),
        winnerOn(card.bouts[1]!.id, "red"),
      ]);

      await settle(card, 0, { winner: "red" });
      await settle(card, 1, { winner: "red" });

      // ×2 twice is ×4, so 20 Coins returned 80.
      expect(await balance(fan.cookie)).toMatchObject({ balance: STARTING_BALANCE - 20 + 80 });

      // The second Bout was actually a draw. The chain still wins — a No
      // Result is not a loss — but it wins at ×2 rather than ×4, so the whole
      // Reward is reversed and the smaller one paid.
      const { correction } = await correctToNoResult(card, 1, "draw");

      expect(correction).toMatchObject({ graded: 1, won: 1, refunded: 0, reversed: 80, paid: 40 });
      expect(await statusOf(entry.id)).toBe("won");
      expect((await ledgerFor(fan.id)).map((row) => [row.kind, row.amount])).toEqual([
        ["season_grant", STARTING_BALANCE],
        ["entry_commitment", -20],
        ["entry_reward", 80],
        ["entry_reversal", -80],
        ["entry_reward", 40],
      ]);
      expect(await balance(fan.cookie)).toMatchObject({ balance: STARTING_BALANCE - 20 + 40 });
    });
  });

  describe("a fan who has already spent the Reward", () => {
    it("is taken below zero rather than left holding Coins nobody won", async () => {
      const card = await upcomingCard(2);
      const fan = await fanWithCoins();

      const spent = await submit(fan, STARTING_BALANCE, [winnerOn(card.bouts[0]!.id, "red")]);

      await settle(card, 0, { winner: "red" });

      // Everything they had, doubled, and then committed to the next fight on
      // the card before anybody noticed the result was wrong.
      expect(await balance(fan.cookie)).toMatchObject({ balance: STARTING_BALANCE * 2 });

      const riding = await submit(fan, STARTING_BALANCE * 2, [winnerOn(card.bouts[1]!.id, "red")]);

      expect(await balance(fan.cookie)).toMatchObject({ balance: 0 });

      const { correction } = await correct(card, 0, { winner: "blue" });

      // The Reward goes back where it came from, and the fan is left owing.
      // `entry_commitments_are_within_the_balance` holds only commitments to
      // the Balance, deliberately, so that a reversal is never the row
      // refused: the alternative is leaving Coins in circulation that were
      // never won.
      expect(correction).toMatchObject({ lost: 1, reversed: STARTING_BALANCE * 2 });
      expect(await statusOf(spent.entry.id)).toBe("lost");
      expect(await balance(fan.cookie)).toMatchObject({ balance: -STARTING_BALANCE * 2 });

      // The Entry those Coins are riding on is untouched. It was submitted
      // against a Balance the fan really held at the time, and it is still
      // being played.
      expect(await statusOf(riding.entry.id)).toBe("open");
      expect((await ledgerFor(fan.id)).map((row) => [row.kind, row.amount])).toEqual([
        ["season_grant", STARTING_BALANCE],
        ["entry_commitment", -STARTING_BALANCE],
        ["entry_reward", STARTING_BALANCE * 2],
        ["entry_commitment", -STARTING_BALANCE * 2],
        ["entry_reversal", -STARTING_BALANCE * 2],
      ]);
    });
  });

  describe("an Entry the fan took back", () => {
    it("is left where the fan left it, whatever the Bout turns out to have done", async () => {
      const card = await upcomingCard(2);
      const quitter = await fanWithCoins();
      const player = await fanWithCoins();

      const taken = await submit(quitter, 20, [
        winnerOn(card.bouts[0]!.id, "red"),
        winnerOn(card.bouts[1]!.id, "red"),
      ]);
      const played = await submit(player, 20, [winnerOn(card.bouts[0]!.id, "red")]);

      const cancelled = await postJson(
        `/api/predictions/entries/${taken.entry.id}/cancel`,
        {},
        quitter.cookie,
      );

      expect(cancelled.status).toBe(200);

      await settle(card, 0, { winner: "red" });
      const { correction } = await correct(card, 0, { winner: "blue" });

      // The cancelled Entry is not among the Entries graded, was never graded
      // against the first result either, and keeps the refund it was taken
      // back with. A Cancellation is the fan's own decision about a card that
      // had not started, and no result corrects one.
      expect(correction).toMatchObject({ graded: 1, lost: 1 });
      expect(await statusOf(taken.entry.id)).toBe("cancelled");
      expect(await statusOf(played.entry.id)).toBe("lost");
      expect((await ledgerFor(quitter.id)).map((row) => row.kind)).toEqual([
        "season_grant",
        "entry_commitment",
        "entry_refund",
      ]);
      expect(await balance(quitter.cookie)).toMatchObject({ balance: STARTING_BALANCE });
    });
  });

  describe("a correction an admin cannot make", () => {
    it("refuses a Bout nothing has been entered about", async () => {
      const card = await upcomingCard(1);

      await lockBout(card.bouts[0]!.id, card.admin.cookie);

      const corrected = await correctResult(
        card.bouts[0]!.id,
        { winner: "red", method: "decision", round: null },
        card.admin.cookie,
      );

      expect(corrected.status).toBe(409);
      await expect(corrected.json()).resolves.toMatchObject({
        message: RESULT_MESSAGES.notSettled,
      });
    });

    it("refuses the result the Bout already has, which corrects nothing", async () => {
      const card = await upcomingCard(1);

      await settle(card, 0, { winner: "red", method: "ko_tko", round: 2 });

      const corrected = await correctResult(
        card.bouts[0]!.id,
        { winner: "red", method: "ko_tko", round: 2 },
        card.admin.cookie,
      );

      expect(corrected.status).toBe(422);
      await expect(corrected.json()).resolves.toMatchObject({
        message: RESULT_MESSAGES.alreadyTheResult,
      });

      // And nothing was written about it: no correction in the log, and no
      // Result replaced by itself.
      const [bout] = (await cardToPrice(card.eventId, card.admin.cookie)).bouts;

      expect(bout?.corrections).toEqual([]);
    });

    it("refuses a correction that could not be what happened", async () => {
      const card = await upcomingCard(1);

      await settle(card, 0, { winner: "red" });

      const corrected = await correctResult(
        card.bouts[0]!.id,
        { winner: "red", method: "decision", round: 2 },
        card.admin.cookie,
      );

      expect(corrected.status).toBe(422);
      await expect(corrected.json()).resolves.toMatchObject({
        message: RESULT_MESSAGES.aDecisionHasNoRound,
      });
    });

    it("refuses a Bout id that is not one", async () => {
      const card = await upcomingCard(1);

      const corrected = await correctResult(
        "not-a-bout",
        { winner: "red", method: "decision", round: null },
        card.admin.cookie,
      );

      expect(corrected.status).toBe(404);
    });
  });

  /**
   * The rules underneath, asked of Postgres directly.
   *
   * Everything above goes through the route, which asks first and answers an
   * admin in sentences. These are what hold when something has got past it: a
   * second correction route nobody has written yet, a hand-typed `update` at
   * three in the morning, or two admins pressing the same button in the same
   * second. A correction is the one operation in the product that takes Coins
   * *off* people, so the rules that hold it are worth asserting on their own.
   */
  describe("what Postgres holds, whatever a route believed", () => {
    /** A fan with a Reward standing, which is what a correction reverses. */
    async function fanWhoWon(card: Awaited<ReturnType<typeof upcomingCard>>) {
      const fan = await fanWithCoins();
      const { entry } = await submit(fan, 20, [winnerOn(card.bouts[0]!.id, "red")]);

      await settle(card, 0, { winner: "red" });

      const [reward] = (await ledgerFor(fan.id)).filter((row) => row.kind === "entry_reward");

      return { ...fan, entryId: entry.id, reward: reward! };
    }

    /** What Postgres said to a statement written by hand, refusal and all. */
    function answered(statement: Promise<unknown>): Promise<string> {
      return statement.then(
        () => "wrote it",
        (refusal: Error) => `${refusal.message} ${refusal.cause}`,
      );
    }

    /** A Coin Transaction written by hand, and how Postgres answered it. */
    function write(row: typeof coinTransactions.$inferInsert) {
      return answered(testDatabase().insert(coinTransactions).values(row));
    }

    it("refuses a reversal that is not worth the movement it names", async () => {
      const card = await upcomingCard(1);
      const fan = await fanWhoWon(card);

      // A reversal of 80 against a Reward of 40 takes 40 Coins that were never
      // paid — Coins destroyed with no error anywhere, which is the whole of
      // what ADR-0003 is written against.
      const written = await write({
        seasonId: await openedSeasonId(),
        userId: fan.id,
        kind: "entry_reversal",
        amount: -80,
        reason: "Taking back more than was ever paid",
        cause: "entry",
        causeId: fan.entryId,
        reverses: fan.reward.id,
      });

      expect(written).toMatch(new RegExp(A_REVERSAL_UNDOES_THE_ROW_IT_NAMES));
    });

    it("refuses a reversal that takes the Coins from somebody else", async () => {
      const card = await upcomingCard(1);
      const fan = await fanWhoWon(card);
      const bystander = await fanWithCoins();

      const written = await write({
        seasonId: await openedSeasonId(),
        userId: bystander.id,
        kind: "entry_reversal",
        amount: -40,
        reason: "Reversing one fan's Reward out of another fan's Balance",
        cause: "entry",
        causeId: fan.entryId,
        reverses: fan.reward.id,
      });

      expect(written).toMatch(new RegExp(A_REVERSAL_UNDOES_THE_ROW_IT_NAMES));
    });

    it("refuses reversing a reversal, which would quietly restore a Reward", async () => {
      const card = await upcomingCard(1);
      const fan = await fanWhoWon(card);

      await correct(card, 0, { winner: "blue" });

      const [reversal] = (await ledgerFor(fan.id)).filter((row) => row.kind === "entry_reversal");

      // A Reward is re-paid by paying a new one, which the ledger then says
      // happened. A reversal of a reversal would put the Coins back with
      // nothing anywhere reading as a Reward.
      const written = await write({
        seasonId: await openedSeasonId(),
        userId: fan.id,
        kind: "entry_reversal",
        amount: 40,
        reason: "Undoing the undoing",
        cause: "entry",
        causeId: fan.entryId,
        reverses: reversal!.id,
      });

      expect(written).toMatch(new RegExp(A_REVERSAL_UNDOES_THE_ROW_IT_NAMES));
    });

    it("never takes the same movement back twice", async () => {
      const card = await upcomingCard(1);
      const fan = await fanWhoWon(card);

      await correct(card, 0, { winner: "blue" });

      // The Reward has been reversed once and the fan is back where they
      // started. A second reversal of the same row would take the 40 Coins a
      // second time, and nothing counting Rewards would look any different.
      const written = await write({
        seasonId: await openedSeasonId(),
        userId: fan.id,
        kind: "entry_reversal",
        amount: -40,
        reason: "Taking the same Reward back again",
        cause: "entry",
        causeId: fan.entryId,
        reverses: fan.reward.id,
      });

      expect(written).toMatch(new RegExp(ONE_REVERSAL_PER_ROW));
    });

    it("refuses an Entry moved off Won with the Reward still standing", async () => {
      const card = await upcomingCard(1);
      const fan = await fanWhoWon(card);

      // A correction that graded the Entry again and forgot the Coins. It is
      // the quietest way this feature could go wrong: nothing looks broken,
      // and a fan who lost is holding a Reward for it.
      const written = await answered(
        testDatabase().execute(
          sql`update entries set status = 'lost' where id = ${fan.entryId}::uuid`,
        ),
      );

      expect(written).toContain(WON_ENTRIES_ARE_REWARDED_ONCE);
    });

    it("refuses an Entry moved off Refunded with its Amount still returned", async () => {
      const card = await upcomingCard(1);
      const fan = await fanWithCoins();
      const { entry } = await submit(fan, 20, [winnerOn(card.bouts[0]!.id, "red")]);

      await settleAsNoResult(card, 0, "draw");

      // The mirror of the case above, and the half of this rule #16 changed.
      // `an_entry_is_cancelled_once_out_of_open` used to refuse every move off
      // Refunded outright; a correction has to be able to make one, so what
      // holds it now is the Coins — an Entry graded against a corrected result
      // may leave Refunded, but not while it is still holding the Amount it
      // was given back.
      const written = await answered(
        testDatabase().execute(
          sql`update entries set status = 'lost' where id = ${entry.id}::uuid`,
        ),
      );

      expect(written).toContain(ENTRIES_ARE_REFUNDED_IN_FULL);
    });

    it("refuses a refund reversed out from under an Entry that is still Refunded", async () => {
      const card = await upcomingCard(1);
      const fan = await fanWithCoins();

      await submit(fan, 20, [winnerOn(card.bouts[0]!.id, "red")]);
      await settleAsNoResult(card, 0, "draw");

      const [refund] = (await ledgerFor(fan.id)).filter((row) => row.kind === "entry_refund");

      // And the other way round: the Coins taken back while the Entry still
      // says they were returned. A correction moves both or neither.
      const written = await write({
        seasonId: await openedSeasonId(),
        userId: fan.id,
        kind: "entry_reversal",
        amount: -20,
        reason: "Taking the Amount back and leaving the Entry saying it came back",
        cause: "entry",
        causeId: refund!.causeId,
        reverses: refund!.id,
      });

      expect(written).toContain(ENTRIES_ARE_REFUNDED_IN_FULL);
    });

    it("refuses a Result changed with nothing recording what it said before", async () => {
      const card = await upcomingCard(1);

      await settle(card, 0, { winner: "red" });

      const written = await answered(
        testDatabase().execute(
          sql`update bout_results set winner = 'blue' where bout_id = ${card.bouts[0]!.id}::uuid`,
        ),
      );

      expect(written).toContain(CORRECTED_RESULTS_ARE_RECORDED);
    });

    it("never rewrites the log of what a Bout used to be recorded as", async () => {
      const card = await upcomingCard(1);

      await settle(card, 0, { winner: "red" });
      await correct(card, 0, { winner: "blue" });

      const rewritten = await answered(
        testDatabase().execute(sql`update bout_result_corrections set winner = 'blue'`),
      );
      const removed = await answered(
        testDatabase().execute(sql`delete from bout_result_corrections`),
      );

      expect(rewritten).toContain(BOUT_RESULT_CORRECTIONS_ARE_APPEND_ONLY);
      expect(removed).toContain(BOUT_RESULT_CORRECTIONS_ARE_APPEND_ONLY);
    });
  });
});
