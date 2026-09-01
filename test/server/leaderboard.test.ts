import { $fetch, fetch } from "@nuxt/test-utils/e2e";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { balanceCache } from "../../server/db/schema";
import { STARTING_BALANCE } from "../../shared/coins";
import { LEADERBOARD_MESSAGES, LEADERBOARD_PLACES } from "../../shared/standings";
import { postJson } from "../helpers/accounts";
import { rebuildBalanceCache } from "../../server/utils/coins";
import {
  adminWithASeason,
  closeOpenSeason,
  openedSeasonId,
  type CardAdmin,
} from "../helpers/cards";
import { testDatabase } from "../helpers/database";
import {
  cancel,
  fanWithCoins,
  leaderboardFor,
  settle,
  settleAsNoResult,
  submit,
  upcomingCard,
} from "../helpers/playing";
import { setupTestServer } from "../helpers/server";
import { createUser } from "../helpers/users";

/**
 * The leaderboard: the top ten of the Season, and the fan reading it.
 *
 * The public scoreboard, and the one page where fans see each other — so the
 * two things it must never get wrong are what it shows of somebody else (a
 * username, and nothing that could identify them: ADR-0007) and where it says
 * the fan reading it stands. A leaderboard a fan can never appear on stops
 * being motivating after one event, which is what the pinned row is for.
 *
 * The ordering is `server/utils/standings.ts`, the same statement the profile
 * reads one fan's Rank out of, so the number here and the number there cannot
 * come to disagree. What this suite adds is the page of them.
 */

/** Sets what a fan holds, in the materialised Balance the standings read. */
function holding(userId: string, balance: number) {
  return testDatabase()
    .update(balanceCache)
    .set({ balance })
    .where(eq(balanceCache.userId, userId));
}

/**
 * A Season with a fan holding each of these Balances, and the admin who
 * opened it.
 *
 * The fans are created before the Season is, because opening one grants to
 * every account that exists by then — which is what puts each of them in the
 * materialised Balance to be moved. Moving them there rather than by playing
 * is the point of the arrangement: a case about the shape of a page of
 * standings is not a case about how anybody's Coins got where they are, and
 * driving twelve fans through twelve settlements to fill one screen would say
 * nothing this suite is not saying elsewhere.
 */
async function seasonOf(balances: number[]): Promise<{ admin: CardAdmin; usernames: string[] }> {
  const fans = [];

  for (const _ of balances) fans.push(await createUser());

  const admin = await adminWithASeason();

  for (const [at, fan] of fans.entries()) await holding(fan.id, balances[at]!);

  // The admin holds the Season's starting Coins like every other fan. Parked
  // at the bottom of the standings so that the rows a case is about are the
  // ones at the top of them.
  await holding(admin.id, 0);

  return { admin, usernames: fans.map((fan) => fan.username) };
}

/** Twelve Balances, best first, so that there is a top ten to be outside of. */
const A_FULL_SEASON = [300, 290, 280, 270, 260, 250, 240, 230, 220, 210, 200, 190];

describe("the Season leaderboard", async () => {
  await setupTestServer();

  describe("the top of the Season", () => {
    it("lists the ten fans holding the most Coins, best first", async () => {
      const { usernames } = await seasonOf(A_FULL_SEASON);
      const board = await leaderboardFor();

      expect(board.top).toHaveLength(LEADERBOARD_PLACES);
      expect(board.top.map((place) => place.username)).toEqual(
        usernames.slice(0, LEADERBOARD_PLACES),
      );
      expect(board.top.map((place) => place.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      expect(board.top.map((place) => place.balance)).toEqual(
        A_FULL_SEASON.slice(0, LEADERBOARD_PLACES),
      );
    });

    it("counts everybody ranked, not only the ten it shows", async () => {
      await seasonOf(A_FULL_SEASON);

      // Twelve fans and the admin who opened the Season: a Rank is "12th of
      // 13", and the page cannot say the second half from the ten rows on it.
      expect((await leaderboardFor()).fans).toBe(A_FULL_SEASON.length + 1);
    });

    it("says the Season it is the standings of", async () => {
      await seasonOf([100]);

      expect((await leaderboardFor()).season).toEqual({ name: "Season 1" });
    });

    it("says how many Entries each fan has played", async () => {
      const card = await upcomingCard(2);
      const fan = await fanWithCoins();

      await submit(fan, 10, [{ boutId: card.bouts[0]!.id }]);
      await submit(fan, 15, [{ boutId: card.bouts[1]!.id }]);

      const board = await leaderboardFor();

      expect(board.top).toContainEqual(
        expect.objectContaining({ username: fan.details.username, entriesPlayed: 2 }),
      );
    });

    it("does not count an Entry the fan took back as one they played", async () => {
      // `CONTEXT.md` on Cancellation: its Coins are back in the Balance, so a
      // ranking by Balance excludes it by arithmetic — and a column counting
      // Entries played has to exclude it by asking.
      const card = await upcomingCard(2);
      const fan = await fanWithCoins();

      await submit(fan, 10, [{ boutId: card.bouts[0]!.id }]);
      const taken = await submit(fan, 15, [{ boutId: card.bouts[1]!.id }]);

      expect((await cancel(taken.entry.id, fan.cookie)).status).toBe(200);

      expect((await leaderboardFor()).top).toContainEqual(
        expect.objectContaining({ username: fan.details.username, entriesPlayed: 1 }),
      );
    });

    it("breaks a tie by who reached the total first", async () => {
      // Both hold the hundred every fan starts on and neither has played, so
      // the only thing between them is when they got there: the admin was
      // granted when the Season opened, and the fan when they signed up into
      // it. A ranking that fell back on whatever Postgres returned first would
      // reorder these two between one page load and the next.
      const admin = await adminWithASeason();
      const fan = await fanWithCoins();

      expect((await leaderboardFor()).top.map((place) => [place.username, place.rank])).toEqual([
        [admin.username, 1],
        [fan.details.username, 2],
      ]);
    });

    it("keeps a tie in that order when Coins move it into one", async () => {
      // Both fans commit 20 and win it back at ×2, so both end the card on
      // 120 — and the only thing between them is which Bout settled first.
      const card = await upcomingCard(2);
      const behind = await fanWithCoins();
      const ahead = await fanWithCoins();

      await submit(behind, 20, [{ boutId: card.bouts[1]!.id, corner: "red" }]);
      await submit(ahead, 20, [{ boutId: card.bouts[0]!.id, corner: "red" }]);

      await settle(card, 0, { winner: "red" });
      await settle(card, 1, { winner: "red" });

      const board = await leaderboardFor();

      expect(board.top.slice(0, 2)).toEqual([
        expect.objectContaining({ rank: 1, username: ahead.details.username, balance: 120 }),
        expect.objectContaining({ rank: 2, username: behind.details.username, balance: 120 }),
      ]);
    });

    it("stands in the same order after the materialised Balance is rebuilt", async () => {
      // The order two tied fans are in is the moment each reached their total,
      // and that moment has to survive a repair that is supposed to change
      // nothing. It is read from `balance_cache`, so it is only as derived as
      // that table is: a rebuild that restamped it would hand back the same
      // Balances in a new order, and every tied fan would swap places for a
      // reason no fan could see. ADR-0003 is the claim this keeps true.
      const card = await upcomingCard(2);
      const first = await fanWithCoins();
      const second = await fanWithCoins();

      await submit(first, 20, [{ boutId: card.bouts[0]!.id, corner: "red" }]);
      await submit(second, 20, [{ boutId: card.bouts[1]!.id, corner: "red" }]);

      await settle(card, 0, { winner: "red" });
      await settle(card, 1, { winner: "red" });

      const before = await leaderboardFor();

      await rebuildBalanceCache(testDatabase(), await openedSeasonId());

      expect(await leaderboardFor()).toEqual(before);
    });

    it("counts an Entry the game refunded as one the fan played", async () => {
      // A Refund is the game's decision, not the fan's: nothing in the Entry
      // turned out to be gradable (ADR-0005). They played it, and the column
      // says so — only a Cancellation is an Entry that was never played.
      const card = await upcomingCard(1);
      const fan = await fanWithCoins();

      await submit(fan, 10, [{ boutId: card.bouts[0]!.id }]);
      await settleAsNoResult(card, 0, "no_contest");

      expect((await leaderboardFor()).top).toContainEqual(
        expect.objectContaining({ username: fan.details.username, entriesPlayed: 1 }),
      );
    });

    it("is the standings of the Season being played, and of no other", async () => {
      const card = await upcomingCard(1);
      const fan = await fanWithCoins();

      await submit(fan, 20, [{ boutId: card.bouts[0]!.id, corner: "red" }]);
      await settle(card, 0, { winner: "red" });

      expect((await leaderboardFor()).top).toContainEqual(
        expect.objectContaining({ username: fan.details.username, balance: 120, entriesPlayed: 1 }),
      );

      await closeOpenSeason();

      const opened = await postJson("/api/admin/seasons", { name: "Season 2" }, card.admin.cookie);

      expect(opened.ok).toBe(true);

      // A new Season is a level field: the same hundred Coins for everybody,
      // and an Entry played in the Season before is not one played in this.
      const board = await leaderboardFor();

      expect(board.season).toEqual({ name: "Season 2" });
      expect(board.top).toContainEqual(
        expect.objectContaining({
          username: fan.details.username,
          balance: STARTING_BALANCE,
          entriesPlayed: 0,
        }),
      );
    });

    it("has nothing to rank between Seasons", async () => {
      await seasonOf([100]);
      await closeOpenSeason();

      expect(await leaderboardFor()).toEqual({ season: null, top: [], you: null, fans: 0 });
    });

    it("is read from the materialised Balance rather than from the ledger", async () => {
      const admin = await adminWithASeason();
      const fan = await fanWithCoins();

      // Nothing in the Coin ledger says 7. A leaderboard that aggregated the
      // Coin Transactions per request would answer 100 here — and would answer
      // it by adding up every row of every fan in the Season, which is the
      // aggregate `balance_cache` exists to avoid (ADR-0003, ADR-0009).
      await holding(fan.id, 7);

      expect((await leaderboardFor()).top).toEqual([
        expect.objectContaining({ rank: 1, username: admin.username, balance: STARTING_BALANCE }),
        expect.objectContaining({ rank: 2, username: fan.details.username, balance: 7 }),
      ]);
    });
  });

  describe("the fan reading it", () => {
    it("pins their own row below the top ten, with their true rank", async () => {
      await seasonOf(A_FULL_SEASON);

      // Every arranged fan holds more than the hundred this one starts on, so
      // they are 13th of 14 — a rank the top ten cannot answer for them, and
      // the reason the row is pinned there at all.
      const fan = await fanWithCoins();
      const board = await leaderboardFor(fan.cookie);

      expect(board.you).toEqual({
        rank: A_FULL_SEASON.length + 1,
        username: fan.details.username,
        balance: STARTING_BALANCE,
        entriesPlayed: 0,
        you: true,
      });
      expect(board.fans).toBe(A_FULL_SEASON.length + 2);
      expect(board.top.some((place) => place.you)).toBe(false);
    });

    it("marks their row in the top ten rather than listing them twice", async () => {
      await seasonOf([80, 40]);

      const fan = await fanWithCoins();
      const board = await leaderboardFor(fan.cookie);

      expect(board.you).toBeNull();
      expect(board.top.filter((place) => place.you)).toEqual([
        expect.objectContaining({ rank: 1, username: fan.details.username }),
      ]);
    });

    it("has no row of their own for a fan the Season has granted nothing", async () => {
      await seasonOf([80]);

      const stranded = await fanWithCoins();

      // The window the README's "Repairing a fan with no Coins" is about: an
      // account that exists holding no grant, so there is nothing of theirs in
      // the standings to be found. They are told so rather than shown a zero.
      await testDatabase().delete(balanceCache).where(eq(balanceCache.userId, stranded.id));

      const board = await leaderboardFor(stranded.cookie);

      expect(board.you).toBeNull();
      expect(board.top.some((place) => place.you)).toBe(false);
    });

    it("shows a visitor with no account the top ten", async () => {
      const { usernames } = await seasonOf([300, 200]);
      const board = await leaderboardFor();

      expect(board.you).toBeNull();
      expect(board.top.map((place) => place.username)).toEqual([...usernames, expect.any(String)]);
    });

    it("never says another fan's real name", async () => {
      const { usernames } = await seasonOf([300, 200]);

      // `createUser` names every fan Nino Beridze. The columns exist so TFC
      // can match a Prize to a person and never leave the database (ADR-0007),
      // and this is the page they would leave on.
      expect(JSON.stringify(await leaderboardFor())).not.toMatch(/Nino|Beridze/);

      const page = await $fetch<string>("/leaderboard");

      expect(page).toContain(usernames[0]);
      expect(page).not.toMatch(/Nino|Beridze/);
    });
  });

  describe("the page", () => {
    it("is served to a visitor with no account", async () => {
      await seasonOf([300]);

      const page = await fetch("/leaderboard");

      expect(page.status).toBe(200);
      expect(await page.text()).toContain(LEADERBOARD_MESSAGES.signedOut);
    });

    it("renders the signed-in fan's own row with the page", async () => {
      await seasonOf(A_FULL_SEASON);

      const fan = await fanWithCoins();
      const page = await $fetch<string>("/leaderboard", { headers: { cookie: fan.cookie } });

      // Server-rendered rather than filled in by the browser: this page is
      // exempt from the edge cache precisely so that it can carry one fan's
      // own row (ADR-0008), and a row that arrived afterwards would be paying
      // that cost for nothing.
      expect(page).toContain(fan.details.username);
      expect(page).toContain(LEADERBOARD_MESSAGES.yourRow);
    });
  });
});
