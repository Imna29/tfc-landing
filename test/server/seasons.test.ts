import { $fetch, fetch } from "@nuxt/test-utils/e2e";
import { and, eq, sql, type SQL } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { coinTransactions, finalStandings, seasons } from "../../server/db/schema";
import { rebuildBalanceCache } from "../../server/utils/coins";
import { STARTING_BALANCE } from "../../shared/coins";
import { CLOSE_MESSAGES } from "../../shared/seasons";
import {
  FINAL_STANDINGS_MESSAGES,
  LEADERBOARD_PLACES,
  PAST_SEASONS_MESSAGES,
} from "../../shared/standings";
import { postJson, signUp } from "../helpers/accounts";
import {
  adminWithASeason,
  cardInTheGame,
  closeOpenSeason,
  closeSeasonRequest,
  openedSeasonId,
  type CardAdmin,
} from "../helpers/cards";
import { testDatabase } from "../helpers/database";
import {
  balance,
  correct,
  endedSeasons,
  fanWithCoins,
  finalStandingsFor,
  historyFor,
  leaderboardFor,
  settle,
  standingFor,
  submit,
  upcomingCard,
  winnerOn,
} from "../helpers/playing";
import { setupTestServer } from "../helpers/server";

/**
 * Closing a Season, and rolling into the next one on a level field.
 *
 * The other end of `test/server/coins.test.ts`. That file is where Coins come
 * from; this is where a Season's answer stops changing. Closing one **freezes
 * its final standings permanently** — the record TFC awards Prizes from
 * (ADR-0007) — and opening the next puts every fan back on the same hundred
 * Coins, which is what makes "no mid-Season top-ups" survivable rather than
 * terminal for a fan who reached zero.
 *
 * Two properties are worth reading first, because everything else here serves
 * them. **The frozen standings are not the materialised Balance**: the cases
 * below move that Balance after the Season has closed — by rebuilding it, and
 * by correcting a result years too late — and the record does not follow it.
 * And **the reset is to the economy, not to the record**: every Entry a fan
 * ever committed is still on their profile afterwards, under the Season they
 * committed it in.
 *
 * Driven through the API, which is the seam. The exceptions are the two rules
 * Postgres holds rather than any route — a closed Season is never reopened, and
 * the frozen standings are never rewritten — and a test that only asked the API
 * would prove the routes behave rather than that the rules hold.
 */

/** A card of one Bout, fought and settled, so its Season can close. */
async function aFinishedCard(admin?: CardAdmin) {
  const card = await upcomingCard(1, admin ? { admin } : {});

  await settle(card, 0, { winner: "red" });

  return card;
}

/**
 * What Postgres said when it refused a statement, or what it did instead.
 *
 * Drizzle's own error names the query it failed on; what the trigger said is
 * the cause underneath it. The same reading `test/server/coins.test.ts` takes
 * of the Coin ledger's append-only trigger, and it matters here for the same
 * reason: matching on the message alone would pass on the text of the `update`
 * being quoted back.
 */
async function refusalFrom(statement: SQL): Promise<string> {
  return testDatabase()
    .execute(statement)
    .then(
      () => "Postgres allowed it",
      (error: Error) => `${error.message} ${error.cause}`,
    );
}

/** Opens the next Season the way the admin form does. */
async function openSeason(cookie: string, name: string): Promise<void> {
  const opened = await postJson("/api/admin/seasons", { name }, cookie);

  if (!opened.ok) throw new Error(`Opening ${name} was refused: ${await opened.text()}`);
}

describe("closing a Season, and the one after it", async () => {
  await setupTestServer();

  describe("an admin closing the Season", () => {
    it("closes it and says how many fans its standings hold", async () => {
      const admin = await adminWithASeason();

      // The admin holds the Season's Coins like anybody else, so two accounts
      // is two rows in the standings it freezes.
      await fanWithCoins();

      const closed = await closeSeasonRequest(await openedSeasonId(), admin.cookie);

      expect(closed.status).toBe(200);
      expect(await closed.json()).toMatchObject({
        season: { name: "Season 1", status: "closed" },
        fansRanked: 2,
      });
    });

    it("dates the close and records the admin who made it", async () => {
      const admin = await adminWithASeason();

      await closeOpenSeason(admin.cookie);

      // Read from Postgres rather than from the answer: `closed_by` is
      // deliberately not on the `Season` any route hands out — it is written so
      // that a disputed Prize can be traced back to whoever froze the standings
      // it was decided on, which is a question somebody asks the database.
      const [closed] = await testDatabase().select().from(seasons);

      expect(closed?.status).toBe("closed");
      expect(closed?.closedBy).toBe(admin.id);
      expect(closed?.closedAt).toBeInstanceOf(Date);
    });

    it("is closed once, and the second press is told so", async () => {
      const admin = await adminWithASeason();
      const seasonId = await openedSeasonId();

      expect((await closeSeasonRequest(seasonId, admin.cookie)).status).toBe(200);

      const again = await closeSeasonRequest(seasonId, admin.cookie);

      expect(again.status).toBe(409);
      expect((await again.json()).message).toBe(CLOSE_MESSAGES.notOpen);
    });

    it("answers a Season id nothing is called with the sentence, not a cast", async () => {
      const admin = await adminWithASeason();

      // Two spellings of "no such Season": one that could be an id and one that
      // could not. Both are answered rather than raising a 500 halfway down a
      // query on an invalid `uuid`.
      const missing = await closeSeasonRequest(
        "0f6d0f5a-2c0e-4b0a-9d51-6a0a3f0f9c11",
        admin.cookie,
      );
      const malformed = await closeSeasonRequest("not-an-id", admin.cookie);

      expect(missing.status).toBe(404);
      expect((await missing.json()).message).toBe(CLOSE_MESSAGES.notFound);
      expect(malformed.status).toBe(404);
    });

    it("is never reopened, whatever asks", async () => {
      const admin = await adminWithASeason();

      await closeOpenSeason(admin.cookie);

      // There is no route that tries, so this is the hand-typed `update` the
      // trigger exists for. ADR-0006 makes a Lock final for the same reason a
      // Season is: the standings behind a Prize cannot be made to say something
      // else afterwards.
      const reopened = await refusalFrom(
        sql`update seasons set status = 'open', closed_at = null, closed_by = null`,
      );

      expect(reopened).toMatch(/has closed and its final standings are frozen/i);
      expect((await testDatabase().select().from(seasons))[0]?.status).toBe("closed");
    });
  });

  describe("the Bouts a Season cannot close over", () => {
    it("refuses while a Bout is still taking Predictions, and names it", async () => {
      const card = await upcomingCard(1);
      const refused = await closeSeasonRequest(await openedSeasonId(), card.admin.cookie);

      expect(refused.status).toBe(409);

      const { message } = await refused.json();

      // The sentence has to be actionable: which card, where on it, and who is
      // fighting. An admin reading "some Bouts are outstanding" has to go and
      // find them.
      expect(message).toContain("TFC 12 Bout 1");
      expect(message).toContain("Giorgi Tsiklauri vs Levan Beridze");
      expect(message).toContain("(open)");
      expect(message).toBe(
        CLOSE_MESSAGES.outstanding([
          {
            event: "TFC 12",
            cardOrder: 1,
            red: "Giorgi Tsiklauri",
            blue: "Levan Beridze",
            status: "open",
          },
        ]),
      );
    });

    it("refuses while a Bout has locked with no Result yet", async () => {
      // The one that matters most. Fans hold Coins on this Bout and nothing has
      // decided them, so a Balance frozen now is a Balance about to move.
      const card = await upcomingCard(1);
      const fan = await fanWithCoins();

      await submit(fan, 20, [winnerOn(card.bouts[0]!.id, "red")]);
      await postJson(`/api/admin/bouts/${card.bouts[0]!.id}/lock`, {}, card.admin.cookie);

      const refused = await closeSeasonRequest(await openedSeasonId(), card.admin.cookie);

      expect(refused.status).toBe(409);
      expect((await refused.json()).message).toContain("(locked)");
    });

    it("names a Bout the card has already closed on its own as locked", async () => {
      // The card started an hour ago with its first Bout still open, so its
      // scheduled Lock has fallen due and nobody has written it down yet
      // (`CONTEXT.md` on the sweep). Closing applies it first, so the refusal
      // names the state the Bout is actually in rather than the one its row
      // still said.
      const card = await cardInTheGame({ scheduledStart: new Date(Date.now() - 60 * 60_000) });

      const refused = await closeSeasonRequest(await openedSeasonId(), card.admin.cookie);

      expect(refused.status).toBe(409);
      expect((await refused.json()).message).toContain("(locked)");
    });

    it("names every outstanding Bout, in the order they are fought", async () => {
      const card = await upcomingCard(3);

      await settle(card, 1, { winner: "red" });

      const refused = await closeSeasonRequest(await openedSeasonId(), card.admin.cookie);
      const { message } = await refused.json();

      expect(message).toContain("2 Bouts are still waiting");
      expect(message.indexOf("Bout 1")).toBeLessThan(message.indexOf("Bout 3"));
      expect(message).not.toContain("Bout 2");
    });

    it("closes over a Bout nobody ever opened", async () => {
      // A Bout still closed took no Predictions and holds nobody's Coins, and
      // it can never settle: entering a result on one is refused outright. A
      // Season that blocked on it would stay open forever, with no route
      // anywhere that could clear it.
      const admin = await adminWithASeason();

      await cardInTheGame({ admin, open: false });

      const closed = await closeSeasonRequest(await openedSeasonId(), admin.cookie);

      expect(closed.status).toBe(200);
    });

    it("leaves the Season open and nothing frozen when it refuses", async () => {
      // The other half of "the freeze and the status are one write". The
      // success path is asserted everywhere below; this is the one that would
      // notice a Season marked closed with no standings behind it, or standings
      // frozen for a Season still being played.
      const card = await upcomingCard(1);
      const seasonId = await openedSeasonId();

      expect((await closeSeasonRequest(seasonId, card.admin.cookie)).status).toBe(409);

      const [season] = await testDatabase().select().from(seasons);

      expect(season).toMatchObject({ status: "open", closedAt: null, closedBy: null });
      expect(await testDatabase().select().from(finalStandings)).toEqual([]);

      // And the Season is still the one being played, rather than one the
      // refusal left in a state nothing else can read.
      expect((await leaderboardFor()).season).toEqual({ name: "Season 1" });
    });

    it("closes once the last Bout has a Result", async () => {
      const card = await upcomingCard(2);
      const fan = await fanWithCoins();

      await submit(fan, 20, [winnerOn(card.bouts[0]!.id, "red")]);
      await settle(card, 0, { winner: "red" });

      expect((await closeSeasonRequest(await openedSeasonId(), card.admin.cookie)).status).toBe(
        409,
      );

      await settle(card, 1, { winner: "red" });

      expect((await closeSeasonRequest(await openedSeasonId(), card.admin.cookie)).status).toBe(
        200,
      );
    });
  });

  describe("what the Season finished as", () => {
    it("freezes the standings exactly as the leaderboard last read them", async () => {
      const card = await upcomingCard(1);
      const ahead = await fanWithCoins();
      const behind = await fanWithCoins();

      await submit(ahead, 50, [winnerOn(card.bouts[0]!.id, "red")]);
      await submit(behind, 10, [winnerOn(card.bouts[0]!.id, "blue")]);
      await settle(card, 0, { winner: "red" });

      const seasonId = await openedSeasonId();
      const lastRead = await leaderboardFor();

      await closeOpenSeason(card.admin.cookie);

      const frozen = await finalStandingsFor(seasonId);

      // The same fans in the same places holding the same Coins. Freezing a
      // Season is meant to keep the page fans were reading, not to derive a
      // second opinion about it.
      expect(frozen.top).toEqual(lastRead.top);
      expect(frozen.fans).toBe(lastRead.fans);
      expect(frozen.season).toMatchObject({ id: seasonId, name: "Season 1" });
    });

    it("keeps the order two tied fans were in", async () => {
      // Both hold the hundred every fan starts on, so the only thing between
      // them is when they got there — the admin when the Season opened, the fan
      // when they signed up into it. A snapshot ordered by Balance alone would
      // freeze whichever row Postgres happened to return first, and hand a
      // Prize out on it.
      const admin = await adminWithASeason();
      const fan = await fanWithCoins();
      const seasonId = await openedSeasonId();

      await closeOpenSeason(admin.cookie);

      expect(
        (await finalStandingsFor(seasonId)).top.map((place) => [place.username, place.rank]),
      ).toEqual([
        [admin.username, 1],
        [fan.details.username, 2],
      ]);
    });

    it("holds every fan in the Season, not only the ten it shows", async () => {
      const admin = await adminWithASeason();

      for (let joining = 0; joining < LEADERBOARD_PLACES + 2; joining += 1) await signUp();

      const seasonId = await openedSeasonId();
      const { fansRanked } = await closeOpenSeason(admin.cookie);
      const frozen = await finalStandingsFor(seasonId);

      expect(fansRanked).toBe(LEADERBOARD_PLACES + 3);
      expect(frozen.top).toHaveLength(LEADERBOARD_PLACES);
      expect(frozen.fans).toBe(LEADERBOARD_PLACES + 3);

      // The record is of everybody, which is what makes it the evidence behind
      // a Prize rather than a screenshot of the top of the page.
      const stored = await testDatabase()
        .select()
        .from(finalStandings)
        .where(eq(finalStandings.seasonId, seasonId));

      expect(stored).toHaveLength(LEADERBOARD_PLACES + 3);
      expect(stored.map((place) => place.rank).sort((a, b) => a - b)).toEqual(
        Array.from({ length: LEADERBOARD_PLACES + 3 }, (_, at) => at + 1),
      );
    });

    it("freezes the Entries each fan played", async () => {
      const card = await upcomingCard(2);
      const fan = await fanWithCoins();

      await submit(fan, 10, [winnerOn(card.bouts[0]!.id, "red")]);
      await submit(fan, 10, [winnerOn(card.bouts[1]!.id, "red")]);
      await settle(card, 0, { winner: "red" });
      await settle(card, 1, { winner: "red" });

      const seasonId = await openedSeasonId();

      await closeOpenSeason(card.admin.cookie);
      await openSeason(card.admin.cookie, "Season 2");

      const frozen = await finalStandingsFor(seasonId, fan.cookie);

      // Two in the Season that is over, none in the one being played — the
      // number is what that fan did, and it stopped changing when the Season
      // did.
      expect(frozen.top).toContainEqual(
        expect.objectContaining({ username: fan.details.username, entriesPlayed: 2 }),
      );
      expect((await leaderboardFor(fan.cookie)).top).toContainEqual(
        expect.objectContaining({ username: fan.details.username, entriesPlayed: 0 }),
      );
    });

    it("stands unchanged when the materialised Balance is rebuilt under it", async () => {
      const card = await aFinishedCard();
      const seasonId = await openedSeasonId();

      await closeOpenSeason(card.admin.cookie);

      const frozen = await finalStandingsFor(seasonId);

      // `balance_cache` is derived data and can be thrown away (ADR-0003). The
      // final standings are not: they are a record of a moment, and a repair to
      // the cache is not one of them.
      await rebuildBalanceCache(testDatabase(), seasonId);

      expect(await finalStandingsFor(seasonId)).toEqual(frozen);
    });

    it("stands unchanged when a result of that Season is corrected afterwards", async () => {
      const card = await upcomingCard(1);
      const fan = await fanWithCoins();

      await submit(fan, 50, [winnerOn(card.bouts[0]!.id, "red")]);
      await settle(card, 0, { winner: "red" });

      const seasonId = await openedSeasonId();

      await closeOpenSeason(card.admin.cookie);

      const frozen = await finalStandingsFor(seasonId, fan.cookie);

      expect(frozen.top).toContainEqual(
        expect.objectContaining({ username: fan.details.username, balance: 150 }),
      );

      // The Reward is reversed in the ledger, which is what ADR-0003 built it
      // for. What the Season finished as does not move: it is the record of a
      // moment that has been and gone, and both readings are kept.
      await correct(card, 0, { winner: "blue" });

      expect(await finalStandingsFor(seasonId, fan.cookie)).toEqual(frozen);
    });

    it("is never rewritten, whatever asks", async () => {
      const card = await aFinishedCard();
      const seasonId = await openedSeasonId();

      await closeOpenSeason(card.admin.cookie);

      // The same shape as the Coin ledger's own append-only trigger, and for a
      // stronger reason: the ledger can be corrected by a reversing row, and
      // there is nothing a record of a moment can be corrected by.
      expect(await refusalFrom(sql`update final_standings set balance = 999`)).toMatch(
        /final standings of a Season are frozen/i,
      );
      expect(await refusalFrom(sql`delete from final_standings`)).toMatch(
        /final standings of a Season are frozen/i,
      );

      expect((await finalStandingsFor(seasonId)).top[0]?.balance).toBe(STARTING_BALANCE);
    });
  });

  describe("reading a Season that is over", () => {
    it("lists every Season that has ended, newest first", async () => {
      const admin = await adminWithASeason();
      const first = await openedSeasonId();

      await closeOpenSeason(admin.cookie);
      await openSeason(admin.cookie, "Season 2");

      const second = await openedSeasonId();

      await closeOpenSeason(admin.cookie);
      await openSeason(admin.cookie, "Season 3");

      const { seasons: ended } = await endedSeasons();

      // The Season being played is not on it: it has no final standings, which
      // is what "final" means.
      expect(ended.map((season) => [season.id, season.name])).toEqual([
        [second, "Season 2"],
        [first, "Season 1"],
      ]);
      expect(Date.parse(ended[0]!.closedAt)).not.toBeNaN();
    });

    it("has nothing to list before the first Season has ended", async () => {
      await adminWithASeason();

      expect(await endedSeasons()).toEqual({ seasons: [] });
    });

    it("pins the reading fan's own row below the top ten, at the place they came", async () => {
      const admin = await adminWithASeason();
      const fans = [];

      for (let joining = 0; joining < LEADERBOARD_PLACES + 1; joining += 1) {
        fans.push(await fanWithCoins());
      }

      const seasonId = await openedSeasonId();

      await closeOpenSeason(admin.cookie);

      // Everybody holds the same hundred, so the last fan to join is the last
      // to have reached it — 12th of 12, which is a place the top ten cannot
      // answer for them.
      const last = fans.at(-1)!;
      const frozen = await finalStandingsFor(seasonId, last.cookie);

      expect(frozen.you).toEqual({
        rank: LEADERBOARD_PLACES + 2,
        username: last.details.username,
        balance: STARTING_BALANCE,
        entriesPlayed: 0,
        you: true,
      });
      expect(frozen.top.some((place) => place.you)).toBe(false);
    });

    it("marks a fan inside the top ten rather than listing them twice", async () => {
      const admin = await adminWithASeason();
      const fan = await fanWithCoins();
      const seasonId = await openedSeasonId();

      await closeOpenSeason(admin.cookie);

      const frozen = await finalStandingsFor(seasonId, fan.cookie);

      expect(frozen.you).toBeNull();
      expect(frozen.top.filter((place) => place.you)).toEqual([
        expect.objectContaining({ rank: 2, username: fan.details.username }),
      ]);
    });

    it("shows a visitor with no account the top of it", async () => {
      const admin = await adminWithASeason();
      const seasonId = await openedSeasonId();

      await closeOpenSeason(admin.cookie);

      const frozen = await finalStandingsFor(seasonId);

      expect(frozen.you).toBeNull();
      expect(frozen.top).toEqual([
        expect.objectContaining({ rank: 1, username: admin.username, you: false }),
      ]);
    });

    it("has no final standings for the Season being played", async () => {
      await adminWithASeason();

      const open = await openedSeasonId();

      const refused = await fetch(`/api/standings/${open}`);

      // Answering the live leaderboard here would put a scoreboard behind a
      // link that promises a record.
      expect(refused.status).toBe(404);
      expect((await refused.json()).message).toBe(PAST_SEASONS_MESSAGES.notFound);
    });

    it("never says a fan's real name", async () => {
      const admin = await adminWithASeason();
      const fan = await fanWithCoins();
      const seasonId = await openedSeasonId();

      await closeOpenSeason(admin.cookie);

      // `signUp` names every fan Nino Beridze. The columns exist so TFC can
      // match a Prize to a person and never leave the database (ADR-0007) —
      // and this is the page a Prize is actually decided on.
      expect(JSON.stringify(await finalStandingsFor(seasonId))).not.toMatch(/Nino|Beridze/);

      const page = await $fetch<string>(`/standings/${seasonId}`);

      expect(page).toContain(fan.details.username);
      expect(page).not.toMatch(/Nino|Beridze/);
    });

    it("renders the page a fan reads it on, with their own row on it", async () => {
      const admin = await adminWithASeason();
      const fan = await fanWithCoins();
      const seasonId = await openedSeasonId();

      await closeOpenSeason(admin.cookie);

      const page = await $fetch<string>(`/standings/${seasonId}`, {
        headers: { cookie: fan.cookie },
      });

      expect(page).toContain("Season 1");
      expect(page).toContain(fan.details.username);
      expect(page).toContain(FINAL_STANDINGS_MESSAGES.what);
    });

    it("is linked from the leaderboard once a Season has ended", async () => {
      const admin = await adminWithASeason();
      const seasonId = await openedSeasonId();

      await closeOpenSeason(admin.cookie);
      await openSeason(admin.cookie, "Season 2");

      expect(await $fetch<string>("/leaderboard")).toContain(`/standings/${seasonId}`);
    });
  });

  describe("rolling into the next Season", () => {
    it("freezes the standings, resets every Balance, and keeps the history", async () => {
      // The whole ticket in one case. A fan plays a Season, wins on it, and the
      // Season rolls over: what they finished as is kept forever, their Coins
      // start again at a hundred, and every Entry they committed is still on
      // their profile under the Season they committed it in.
      const card = await upcomingCard(1);
      const fan = await fanWithCoins();

      const played = await submit(fan, 40, [winnerOn(card.bouts[0]!.id, "red")]);

      await settle(card, 0, { winner: "red" });

      const finished = await openedSeasonId();

      expect(await balance(fan.cookie)).toEqual({
        season: { name: "Season 1" },
        balance: 140,
      });

      await closeOpenSeason(card.admin.cookie);
      await openSeason(card.admin.cookie, "Season 2");

      // Frozen: what they finished Season 1 on, still readable, and no longer
      // what they hold.
      expect((await finalStandingsFor(finished, fan.cookie)).top).toContainEqual(
        expect.objectContaining({
          username: fan.details.username,
          rank: 1,
          balance: 140,
          entriesPlayed: 1,
        }),
      );

      // Reset: the level field the Season rules are about. A fan who reached
      // zero waits for the next Season, and this is that next Season.
      expect(await balance(fan.cookie)).toEqual({
        season: { name: "Season 2" },
        balance: STARTING_BALANCE,
      });
      expect(await standingFor(fan.cookie)).toMatchObject({
        season: { name: "Season 2" },
        balance: STARTING_BALANCE,
      });

      // Kept: the reset is to the economy, not to the record.
      const history = await historyFor(fan.cookie);

      expect(history.seasons.map((season) => season.name)).toEqual(["Season 1"]);
      expect(history.entries.map((entry) => [entry.id, entry.season.name])).toEqual([
        [played.entry.id, "Season 1"],
      ]);
    });

    it("records the reset as a ledger row per fan, in the new Season", async () => {
      const admin = await adminWithASeason();

      await fanWithCoins();

      const finished = await openedSeasonId();

      await closeOpenSeason(admin.cookie);
      await openSeason(admin.cookie, "Season 2");

      const opened = await openedSeasonId();

      // ADR-0003: a Balance is what the ledger adds up to, so a reset that
      // wrote a number into `balance_cache` would be a Balance with no movement
      // behind it. Every fan's hundred is a `season_grant` row like any other,
      // and the Season before it is untouched.
      const grants = await testDatabase()
        .select({ seasonId: coinTransactions.seasonId, amount: coinTransactions.amount })
        .from(coinTransactions)
        .where(eq(coinTransactions.kind, "season_grant"))
        .orderBy(coinTransactions.createdAt);

      expect(grants.filter((grant) => grant.seasonId === finished)).toHaveLength(2);
      expect(grants.filter((grant) => grant.seasonId === opened)).toEqual([
        { seasonId: opened, amount: STARTING_BALANCE },
        { seasonId: opened, amount: STARTING_BALANCE },
      ]);
    });

    it("gives a fan who finished last the same hundred as the one who won", async () => {
      const card = await upcomingCard(1);
      const won = await fanWithCoins();
      const lost = await fanWithCoins();

      await submit(won, 90, [winnerOn(card.bouts[0]!.id, "red")]);
      await submit(lost, 100, [winnerOn(card.bouts[0]!.id, "blue")]);
      await settle(card, 0, { winner: "red" });

      expect(await balance(lost.cookie)).toMatchObject({ balance: 0 });

      await closeOpenSeason(card.admin.cookie);
      await openSeason(card.admin.cookie, "Season 2");

      // The whole reason this ticket exists: a fan who reached zero waits for
      // the next Season rather than being finished with the game.
      expect(await balance(lost.cookie)).toMatchObject({ balance: STARTING_BALANCE });
      expect(await balance(won.cookie)).toMatchObject({ balance: STARTING_BALANCE });
    });

    it("leaves nothing to rank between the two", async () => {
      const admin = await adminWithASeason();
      const fan = await fanWithCoins();

      await closeOpenSeason(admin.cookie);

      // The gap is a real state, not an error: no Season is being played, so
      // there is no Balance to rank anybody by and nobody to be ranked among.
      expect(await leaderboardFor(fan.cookie)).toEqual({
        season: null,
        top: [],
        you: null,
        fans: 0,
      });
      expect(await standingFor(fan.cookie)).toEqual({
        season: null,
        balance: null,
        rank: null,
        fans: 0,
      });
    });

    it("starts a fan who joined between two Seasons on the same hundred", async () => {
      const admin = await adminWithASeason();

      await closeOpenSeason(admin.cookie);

      // Nothing was open when they signed up, so their joining grant had no
      // Season to be written into and they hold nothing at all.
      const late = await fanWithCoins();

      expect(await balance(late.cookie)).toEqual({ season: null, balance: null });

      await openSeason(admin.cookie, "Season 2");

      expect(await balance(late.cookie)).toEqual({
        season: { name: "Season 2" },
        balance: STARTING_BALANCE,
      });
    });

    it("does not count a Season a fan never played among the ones they did", async () => {
      const card = await upcomingCard(1);
      const fan = await fanWithCoins();

      await submit(fan, 10, [winnerOn(card.bouts[0]!.id, "red")]);
      await settle(card, 0, { winner: "red" });
      await closeOpenSeason(card.admin.cookie);
      await openSeason(card.admin.cookie, "Season 2");

      // `CONTEXT.md`: Entry history is grouped by Season, and a Season the fan
      // has never committed an Entry in is not a Season of theirs — it would be
      // an empty page behind a filter.
      expect((await historyFor(fan.cookie)).seasons.map((season) => season.name)).toEqual([
        "Season 1",
      ]);
    });

    it("keeps a Season's Coins out of the next one's standings", async () => {
      const card = await upcomingCard(1);
      const fan = await fanWithCoins();

      await submit(fan, 90, [winnerOn(card.bouts[0]!.id, "red")]);
      await settle(card, 0, { winner: "red" });

      const finished = await openedSeasonId();

      await closeOpenSeason(card.admin.cookie);
      await openSeason(card.admin.cookie, "Season 2");

      const opened = await openedSeasonId();

      const held = await testDatabase()
        .select({ balance: sql<number>`balance` })
        .from(sql`balance_cache`)
        .where(and(sql`season_id = ${opened}::uuid`, sql`user_id = ${fan.id}::uuid`));

      expect(held).toEqual([{ balance: STARTING_BALANCE }]);
      expect((await finalStandingsFor(finished)).top[0]?.balance).toBe(190);
    });
  });
});
