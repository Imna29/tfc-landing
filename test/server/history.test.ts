import { $fetch, fetch } from "@nuxt/test-utils/e2e";
import { describe, expect, it } from "vitest";
import { STARTING_BALANCE, coinsLabel } from "../../shared/coins";
import { ENTRY_STATUS_LABELS } from "../../shared/entries";
import { HISTORY_MESSAGES } from "../../shared/history";
import { PREDICTION_GRADE_LABELS } from "../../shared/results";
import { STANDING_MESSAGES } from "../../shared/standings";
import { postJson } from "../helpers/accounts";
import { closeOpenSeason, type CardAdmin } from "../helpers/cards";
import {
  fanWithCoins,
  historyFor,
  methodOn,
  settle,
  settleAsNoResult,
  standingFor,
  submit,
  upcomingCard,
  winnerOn,
} from "../helpers/playing";
import { setupTestServer } from "../helpers/server";
import { MY_PREDICTIONS } from "../../app/utils/navigation";

/**
 * Where a fan stands, and everything they have ever predicted.
 *
 * The payoff for every other file in this suite — a fan comes to find out
 * whether they were right — and almost nothing behind it is stored. The
 * combined Multiplier, the Reward and each Prediction's own grade are worked
 * out from the Predictions and the Results every time they are read
 * (ADR-0013), so the cases below drive real Entries through real settlements
 * and then ask what the pages say about them.
 *
 * Two pages, and the split between them is the point. `/profile` is the
 * account: the Balance, the Rank and the way out. My Predictions is every
 * Entry, in the section the card is in, laid out as what is still riding and
 * what is done with.
 *
 * Two cases are worth reading first. A chain that is already Lost still grades
 * the Bouts it has left, which is #14's promise kept where a fan can actually
 * see it. And one fan's history is one fan's: there is no route that takes a
 * fan to read a history for, and the case below is the one that would notice
 * if there ever were.
 */

/**
 * A second Season, opened behind the one that is being played.
 *
 * The Season being played has to have finished its card first — closing is
 * refused while a Bout is still open or waiting on a Result — which is the
 * arrangement a real rollover happens from.
 */
async function nextSeason(admin: CardAdmin, name: string): Promise<void> {
  await closeOpenSeason(admin.cookie);

  const opened = await postJson("/api/admin/seasons", { name }, admin.cookie);

  if (!opened.ok) throw new Error(`Opening ${name} was refused: ${await opened.text()}`);
}

describe("a fan's own record", async () => {
  await setupTestServer();

  describe("where a fan stands", () => {
    it("says the Balance, the Season being played and where it puts them", async () => {
      const card = await upcomingCard(1);
      const fan = await fanWithCoins();

      await submit(fan, 20, [winnerOn(card.bouts[0]!.id, "red")]);
      await settle(card, 0, { winner: "red" });

      // The winner Outcome pays ×2, so the Entry returns 40 on the 20 it took.
      expect(await standingFor(fan.cookie)).toEqual({
        season: { name: "Season 1" },
        balance: STARTING_BALANCE - 20 + 40,
        rank: 1,
        fans: 2,
      });
    });

    it("ranks by Balance, most Coins first", async () => {
      const card = await upcomingCard(1);
      const winner = await fanWithCoins();
      const loser = await fanWithCoins();

      await submit(winner, 20, [winnerOn(card.bouts[0]!.id, "red")]);
      await submit(loser, 20, [winnerOn(card.bouts[0]!.id, "blue")]);
      await settle(card, 0, { winner: "red" });

      // 120, 100 and 80: the fan who was right, the admin who has not played,
      // and the fan who was wrong.
      expect(await standingFor(winner.cookie)).toMatchObject({ rank: 1, fans: 3, balance: 120 });
      expect(await standingFor(card.admin.cookie)).toMatchObject({ rank: 2, balance: 100 });
      expect(await standingFor(loser.cookie)).toMatchObject({ rank: 3, balance: 80 });
    });

    it("breaks a tie by who reached the total first", async () => {
      // Both hold the hundred every fan starts on and neither has played, so
      // the only thing between them is when they got there: the admin was
      // granted when the Season opened, and the fan when they signed up into
      // it. A ranking that fell back on whatever Postgres returned first would
      // reorder these two between one page load and the next.
      const card = await upcomingCard(1);
      const fan = await fanWithCoins();

      expect(await standingFor(card.admin.cookie)).toMatchObject({ rank: 1, balance: 100 });
      expect(await standingFor(fan.cookie)).toMatchObject({ rank: 2, balance: 100 });
    });

    it("has nothing to rank when no Season is being played", async () => {
      const card = await upcomingCard(1);

      // The card has to be finished before its Season can close. Nobody
      // committed anything to this Bout, so settling it moves no Coins and the
      // admin still holds the hundred they started on.
      await settle(card, 0, { winner: "red" });
      await closeOpenSeason(card.admin.cookie);

      expect(await standingFor(card.admin.cookie)).toEqual({
        season: null,
        balance: null,
        rank: null,
        fans: 0,
      });
    });

    it("is nobody's business but the fan asking", async () => {
      expect((await fetch("/api/coins/standing")).status).toBe(401);
    });
  });

  describe("the Entries a fan has committed", () => {
    it("lists every Entry they have submitted, newest first", async () => {
      const card = await upcomingCard(2);
      const fan = await fanWithCoins();

      const first = await submit(fan, 10, [winnerOn(card.bouts[0]!.id, "red")]);
      const second = await submit(fan, 15, [winnerOn(card.bouts[1]!.id, "red")]);

      const { entries } = await historyFor(fan.cookie);

      expect(entries.map((entry) => entry.id)).toEqual([second.entry.id, first.entry.id]);
      expect(entries.map((entry) => entry.amount)).toEqual([15, 10]);
      expect(entries.map((entry) => entry.status)).toEqual(["open", "open"]);
    });

    it("carries the answer as the fan gave it, what it was priced at, and the card it was on", async () => {
      const card = await upcomingCard(1);
      const fan = await fanWithCoins();

      await submit(fan, 10, [winnerOn(card.bouts[0]!.id, "red")]);

      const [entry] = (await historyFor(fan.cookie)).entries;

      // One answer, in the same three columns the Outcome it was copied from
      // carries it in: the Question, the answer to it, and nothing else set.
      expect(entry?.predictions).toEqual([
        expect.objectContaining({
          boutId: card.bouts[0]!.id,
          cardOrder: 1,
          eventTitle: "TFC 12",
          corners: { red: "Giorgi Tsiklauri", blue: "Levan Beridze" },
          question: "winner",
          corner: "red",
          method: null,
          // ADR-0002: what that answer paid on the day, frozen onto it.
          multiplier: 2,
          ending: null,
        }),
      ]);
    });

    it("carries a method naming the fighter it is about", async () => {
      // #33 stood the Question up and ADR-0015 gave its answers a fighter: the
      // Prediction reads back as "Beridze by Submission", corner and all, and
      // is graded against a Bout Beridze submitted.
      const card = await upcomingCard(1);
      const fan = await fanWithCoins();

      await submit(fan, 10, [methodOn(card.bouts[0]!.id, "blue", "submission")]);
      await settle(card, 0, { winner: "blue", method: "submission" });

      const [entry] = (await historyFor(fan.cookie)).entries;

      expect(entry?.predictions).toEqual([
        expect.objectContaining({
          question: "method",
          corner: "blue",
          method: "submission",
          multiplier: 2.5,
          // The two names the Bout was fought under, which is what turns the
          // answer back into the words the fan picked.
          corners: { red: "Giorgi Tsiklauri", blue: "Levan Beridze" },
          ending: { result: { winner: "blue", method: "submission" } },
        }),
      ]);
      expect(entry?.status).toBe("won");
    });

    it("says how each Bout ended, which is what grades the answers", async () => {
      const card = await upcomingCard(3);
      const fan = await fanWithCoins();

      await submit(fan, 10, [
        winnerOn(card.bouts[0]!.id, "red"),
        winnerOn(card.bouts[1]!.id, "red"),
        winnerOn(card.bouts[2]!.id, "red"),
      ]);

      await settle(card, 0, { winner: "red" });
      await settleAsNoResult(card, 1, "withdrawal");

      const [entry] = (await historyFor(fan.cookie)).entries;

      expect(entry?.predictions.map((one) => one.ending)).toEqual([
        { result: { winner: "red", method: "decision" } },
        { noResult: "withdrawal" },
        null,
      ]);
    });

    it("grades the Bouts still to come in a chain that is already Lost", async () => {
      const card = await upcomingCard(3);
      const fan = await fanWithCoins();

      await submit(fan, 10, [
        winnerOn(card.bouts[0]!.id, "blue"),
        winnerOn(card.bouts[1]!.id, "red"),
        winnerOn(card.bouts[2]!.id, "red"),
      ]);

      // The first Bout ends the Entry; the second is fought afterwards and is
      // still graded, so a fan can see they were one Bout away.
      await settle(card, 0, { winner: "red" });
      await settle(card, 1, { winner: "red" });

      const [entry] = (await historyFor(fan.cookie)).entries;

      expect(entry?.status).toBe("lost");
      expect(entry?.predictions.map((one) => one.ending !== null)).toEqual([true, true, false]);
    });

    it("never lists another fan's Entries", async () => {
      const card = await upcomingCard(1);
      const fan = await fanWithCoins();
      const somebodyElse = await fanWithCoins();

      await submit(somebodyElse, 30, [winnerOn(card.bouts[0]!.id, "red")]);
      await submit(fan, 10, [winnerOn(card.bouts[0]!.id, "red")]);

      const { entries } = await historyFor(fan.cookie);

      expect(entries.map((entry) => entry.amount)).toEqual([10]);
    });

    it("is nobody's business but the fan asking", async () => {
      expect((await fetch("/api/predictions/history")).status).toBe(401);
    });
  });

  describe("finding an Entry in a history kept forever", () => {
    /** A fan with one Entry in each of two Seasons, newest last. */
    async function twoSeasonsPlayed() {
      const first = await upcomingCard(1);
      const fan = await fanWithCoins();

      await submit(fan, 10, [winnerOn(first.bouts[0]!.id, "red")]);

      // Season 1 finishes its card before it rolls over, which is what closing
      // one requires: their Entry wins, and stays in the history as a Season
      // that is over.
      await settle(first, 0, { winner: "red" });
      await nextSeason(first.admin, "Season 2");

      const second = await upcomingCard(1, {
        admin: first.admin,
        card: { prismicId: "event-tfc-13", title: "TFC 13" },
      });

      await submit(fan, 25, [winnerOn(second.bouts[0]!.id, "red")]);

      return { fan, first, second };
    }

    it("keeps every Season the fan has played, newest first", async () => {
      const { fan } = await twoSeasonsPlayed();

      expect((await historyFor(fan.cookie)).seasons.map((season) => season.name)).toEqual([
        "Season 2",
        "Season 1",
      ]);
    });

    it("opens on every Season, newest Entry first", async () => {
      const { fan } = await twoSeasonsPlayed();
      const history = await historyFor(fan.cookie);

      // Narrowing is the fan's move, not the page's opening position: a
      // history that opened on one Season would answer "find my wins" with
      // some of them, and hide the rest behind a control they had to find.
      expect(history.filter).toEqual({ seasonId: null, status: null });
      expect(history.entries.map((entry) => entry.amount)).toEqual([25, 10]);
    });

    it("lists an older Season on its own", async () => {
      const { fan } = await twoSeasonsPlayed();
      const older = (await historyFor(fan.cookie)).seasons[1]!;

      const history = await historyFor(fan.cookie, { season: older.id });

      expect(history.entries.map((entry) => entry.amount)).toEqual([10]);
      expect(history.entries.map((entry) => entry.season.name)).toEqual(["Season 1"]);
    });

    it("finds a win in a Season that is over", async () => {
      // The reason the page opens on every Season: a status filter that only
      // ever searched the current one would answer this with nothing.
      const { fan } = await twoSeasonsPlayed();

      const won = await historyFor(fan.cookie, { status: "won" });

      expect(won.entries.map((entry) => entry.amount)).toEqual([10]);
      expect(won.entries.map((entry) => entry.season.name)).toEqual(["Season 1"]);
    });

    it("filters by status", async () => {
      const card = await upcomingCard(2);
      const fan = await fanWithCoins();

      const kept = await submit(fan, 10, [winnerOn(card.bouts[0]!.id, "red")]);

      await submit(fan, 15, [winnerOn(card.bouts[1]!.id, "blue")]);
      await settle(card, 0, { winner: "red" });
      await settle(card, 1, { winner: "red" });

      const won = await historyFor(fan.cookie, { status: "won" });

      expect(won.filter.status).toBe("won");
      expect(won.entries.map((entry) => entry.id)).toEqual([kept.entry.id]);
      expect((await historyFor(fan.cookie, { status: "lost" })).entries).toHaveLength(1);
      expect((await historyFor(fan.cookie, { status: "refunded" })).entries).toEqual([]);
    });

    it("shows the whole history rather than refusing a filter that is not one", async () => {
      const card = await upcomingCard(1);
      const fan = await fanWithCoins();

      await submit(fan, 10, [winnerOn(card.bouts[0]!.id, "red")]);

      const history = await historyFor(fan.cookie, { status: "winning", season: "not-an-id" });

      expect(history.filter).toEqual({ seasonId: null, status: null });
      expect(history.entries).toHaveLength(1);
    });

    it("has nothing to show a fan who has never committed an Entry", async () => {
      await upcomingCard(1);

      const fan = await fanWithCoins();
      const history = await historyFor(fan.cookie);

      expect(history).toEqual({
        seasons: [],
        filter: { seasonId: null, status: null },
        entries: [],
      });
    });
  });

  /**
   * Where a fan reads all of this, which is two pages rather than one.
   *
   * `/profile` is the account: the Balance, the Rank and the way out. My
   * Predictions is every Entry they have ever committed, in the section the
   * card is in — a fan checking whether their chain survived Bout 3 is playing
   * the game rather than administering an account. The profile links there and
   * draws none of it, so one Entry cannot be shown two ways on two pages.
   */
  describe("the pages a fan reads it on", () => {
    it("says where they stand on the profile, and sends them on for the rest", async () => {
      const card = await upcomingCard(2);
      const fan = await fanWithCoins();

      await submit(fan, 20, [
        winnerOn(card.bouts[0]!.id, "red"),
        winnerOn(card.bouts[1]!.id, "red"),
      ]);

      await settle(card, 0, { winner: "red" });
      await settle(card, 1, { winner: "red" });

      const page = await $fetch<string>("/profile", { headers: { cookie: fan.cookie } });

      // 20 Coins at ×2 twice over is 80 returned, on a Balance of 160.
      expect(page).toContain(STANDING_MESSAGES.balance(160));
      expect(page).toContain(STANDING_MESSAGES.ranked(1, 2));

      // And the Entries themselves are somewhere else now, named rather than
      // drawn: a second listing here is a second thing to keep in step.
      expect(page).toContain(MY_PREDICTIONS);
      expect(page).not.toContain(HISTORY_MESSAGES.paid(80));
    });

    it("shows what their Entries came to", async () => {
      const card = await upcomingCard(2);
      const fan = await fanWithCoins();

      await submit(fan, 20, [
        winnerOn(card.bouts[0]!.id, "red"),
        winnerOn(card.bouts[1]!.id, "red"),
      ]);

      await settle(card, 0, { winner: "red" });
      await settle(card, 1, { winner: "red" });

      const page = await $fetch<string>(MY_PREDICTIONS, { headers: { cookie: fan.cookie } });

      expect(page).toContain(HISTORY_MESSAGES.paid(80));
      expect(page).toContain(ENTRY_STATUS_LABELS.won);
      expect(page).toContain("TFC 12");
    });

    it("puts what is still riding above what is done with", async () => {
      // The whole of what the page adds: a fan opening it mid-card is looking
      // for the chain that can still go either way, and one listing newest
      // first buries it under whatever settled last week.
      const card = await upcomingCard(2);
      const fan = await fanWithCoins();

      await submit(fan, 11, [winnerOn(card.bouts[0]!.id, "red")]);
      await submit(fan, 22, [winnerOn(card.bouts[1]!.id, "red")]);
      await settle(card, 0, { winner: "red" });

      const page = await $fetch<string>(MY_PREDICTIONS, { headers: { cookie: fan.cookie } });

      expect(page).toContain(HISTORY_MESSAGES.stillOpen);
      expect(page).toContain(HISTORY_MESSAGES.finished);
      // The Entry on the Bout still to be fought is above the one its Bout
      // decided, whichever was submitted first.
      expect(page.indexOf(coinsLabel(22))).toBeLessThan(page.indexOf(coinsLabel(11)));
    });

    it("tells a fan with a record and nothing riding that nothing is open", async () => {
      // Not the same sentence as a fan who has never committed one at all:
      // this fan has Entries, and none of them are waiting on anything.
      const card = await upcomingCard(1);
      const fan = await fanWithCoins();

      await submit(fan, 20, [winnerOn(card.bouts[0]!.id, "red")]);
      await settle(card, 0, { winner: "red" });

      const page = await $fetch<string>(MY_PREDICTIONS, { headers: { cookie: fan.cookie } });

      expect(page).toContain(HISTORY_MESSAGES.noneOpen);
      expect(page).not.toContain(HISTORY_MESSAGES.noneYet);
    });

    it("names the fighter in every Prediction it shows", async () => {
      // The third of the three places a Prediction was rendered with no
      // fighter in it (ADR-0015), and the one a fan comes back to weeks later.
      const card = await upcomingCard(2);
      const fan = await fanWithCoins();

      await submit(fan, 20, [
        methodOn(card.bouts[0]!.id, "blue", "ko_tko"),
        methodOn(card.bouts[1]!.id, "red", "submission"),
      ]);

      await settle(card, 0, { winner: "blue", method: "ko_tko" });

      const page = await $fetch<string>(MY_PREDICTIONS, { headers: { cookie: fan.cookie } });

      expect(page).toContain("Levan Beridze by KO/TKO");
      expect(page).toContain("Giorgi Tsiklauri by Submission");
    });

    it("shows each Prediction of a dead chain in its own state", async () => {
      const card = await upcomingCard(2);
      const fan = await fanWithCoins();

      await submit(fan, 20, [
        winnerOn(card.bouts[0]!.id, "blue"),
        winnerOn(card.bouts[1]!.id, "red"),
      ]);

      await settle(card, 0, { winner: "red" });

      const page = await $fetch<string>(MY_PREDICTIONS, { headers: { cookie: fan.cookie } });

      expect(page).toContain(PREDICTION_GRADE_LABELS.wrong);
      expect(page).toContain(PREDICTION_GRADE_LABELS.unresolved);
      // 20 Coins at ×2 twice over: the chain it was going for, named beside
      // the Reward it did not return.
      expect(page).toContain(HISTORY_MESSAGES.lost(80));
    });

    it("renders the filter it was asked for, and the listing under it", async () => {
      const card = await upcomingCard(2);
      const fan = await fanWithCoins();

      await submit(fan, 11, [winnerOn(card.bouts[0]!.id, "red")]);
      await submit(fan, 22, [winnerOn(card.bouts[1]!.id, "blue")]);
      await settle(card, 0, { winner: "red" });
      await settle(card, 1, { winner: "red" });

      const page = await $fetch<string>(`${MY_PREDICTIONS}?status=lost`, {
        headers: { cookie: fan.cookie },
      });

      // In the HTML rather than set by the browser afterwards: a control that
      // said "Every status" over a listing of Lost Entries until the page
      // hydrated — and forever without JavaScript — is a page contradicting
      // itself about what a fan is looking at.
      expect(page).toMatch(/<option value="lost"[^>]*\bselected\b/);
      expect(page).toContain(coinsLabel(22));
      expect(page).not.toContain(coinsLabel(11));
    });

    it("leaves the open half out rather than blaming a fan for their own filter", async () => {
      // "Nothing of yours is still open" under a listing of Lost Entries would
      // be the page answering a question the fan did not ask.
      const card = await upcomingCard(2);
      const fan = await fanWithCoins();

      await submit(fan, 11, [winnerOn(card.bouts[0]!.id, "blue")]);
      await submit(fan, 22, [winnerOn(card.bouts[1]!.id, "red")]);
      await settle(card, 0, { winner: "red" });

      const page = await $fetch<string>(`${MY_PREDICTIONS}?status=lost`, {
        headers: { cookie: fan.cookie },
      });

      expect(page).not.toContain(HISTORY_MESSAGES.noneOpen);
    });

    it("leaves it out for a fan who narrowed to a Season they have finished", async () => {
      // The same rule as the status filter, and the case that catches it: this
      // fan holds an open Entry — in the *other* Season — so "nothing of yours
      // is still open" would be false about them as well as about the filter.
      const first = await upcomingCard(1);
      const fan = await fanWithCoins();

      await submit(fan, 11, [winnerOn(first.bouts[0]!.id, "red")]);
      await settle(first, 0, { winner: "red" });
      await nextSeason(first.admin, "Season 2");

      const second = await upcomingCard(1, {
        admin: first.admin,
        card: { prismicId: "event-tfc-13", title: "TFC 13" },
      });

      await submit(fan, 22, [winnerOn(second.bouts[0]!.id, "red")]);

      const seasonOne = (await historyFor(fan.cookie)).seasons.find(
        (season) => season.name === "Season 1",
      );

      const page = await $fetch<string>(`${MY_PREDICTIONS}?season=${seasonOne?.id}`, {
        headers: { cookie: fan.cookie },
      });

      expect(page).toContain(coinsLabel(11));
      expect(page).not.toContain(HISTORY_MESSAGES.noneOpen);
    });

    it("says so to a fan who has not committed an Entry yet", async () => {
      const fan = await fanWithCoins();
      const page = await $fetch<string>(MY_PREDICTIONS, { headers: { cookie: fan.cookie } });

      expect(page).toContain(HISTORY_MESSAGES.noneYet);
    });

    it("asks a signed-out visitor to sign in rather than showing them a history", async () => {
      const page = await $fetch<string>(MY_PREDICTIONS);

      expect(page).toContain("Sign in");
      expect(page).not.toContain(HISTORY_MESSAGES.kept);
    });

    it("brings a visitor who signs in back to the page they asked for", async () => {
      // Rather than dropping them on a profile they did not ask about. The
      // whole page is behind a session, so this link is the only way onto it.
      const page = await $fetch<string>(MY_PREDICTIONS);

      expect(page).toContain(`next=${encodeURIComponent(MY_PREDICTIONS)}`);
    });
  });
});
