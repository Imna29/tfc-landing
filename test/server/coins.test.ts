import { $fetch, fetch } from "@nuxt/test-utils/e2e";
import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { STARTING_BALANCE } from "../../shared/coins";
import { balanceCache, coinTransactions, seasons } from "../../server/db/schema";
import { rebuildBalanceCache } from "../../server/utils/coins";
import { postJson, signUp, signUpAdmin } from "../helpers/accounts";
import { closeOpenSeason } from "../helpers/cards";
import { testDatabase } from "../helpers/database";
import { setupTestServer } from "../helpers/server";
import { createUser, fanId } from "../helpers/users";

/**
 * Seasons and the Coin ledger: where every Coin in TFC Predictions comes from,
 * and the constraints that make the Season rules' "no mid-Season top-ups"
 * (`CONTEXT.md`) a fact rather than an intention.
 *
 * Driven through the API, because that is the seam the whole feature is tested
 * at. The exceptions are deliberate and are all about the ledger itself: there
 * is no endpoint that lists Coin Transactions yet, and the rules this ticket
 * is really about — one grant per fan, worth exactly the starting Balance,
 * never rewritten — are held by Postgres, so a test that only asked the API
 * would prove the routes behave rather than that the rules hold.
 */
describe("Seasons and the Coin ledger", async () => {
  await setupTestServer();

  /** Opens a Season the way the admin form does. */
  function openSeason(cookie: string, name = "Season 1") {
    return postJson("/api/admin/seasons", { name }, cookie);
  }

  /** What the site header would show this fan. */
  function balance(cookie: string) {
    return $fetch("/api/coins/balance", { headers: { cookie } });
  }

  /** Every Coin Transaction written about a fan, oldest first. */
  async function ledgerFor(email: string) {
    return testDatabase()
      .select()
      .from(coinTransactions)
      .where(eq(coinTransactions.userId, await fanId(email)))
      .orderBy(coinTransactions.createdAt);
  }

  /** The Season that is being played. */
  async function openedSeason() {
    const [season] = await testDatabase().select().from(seasons).where(eq(seasons.status, "open"));

    if (!season) throw new Error("No Season is open.");

    return season;
  }

  describe("opening a Season", () => {
    it("starts every fan who already has an account on the same Coins", async () => {
      const early = await signUp();
      const alsoEarly = await signUp();
      // An admin is a fan with a role, and plays like anyone else (ADR-0011),
      // so they are started too.
      const admin = await signUpAdmin();

      const response = await openSeason(admin.cookie, "Season 1");

      expect(response.status).toBe(201);
      await expect(response.json()).resolves.toMatchObject({
        season: { name: "Season 1", status: "open" },
        fansGranted: 3,
      });

      for (const fan of [early, alsoEarly, admin]) {
        expect(await balance(fan.cookie)).toEqual({
          season: { name: "Season 1" },
          balance: STARTING_BALANCE,
        });
      }
    });

    it("refuses a second Season while one is open", async () => {
      const admin = await signUpAdmin();
      await openSeason(admin.cookie, "Season 1");

      const response = await openSeason(admin.cookie, "Season 2");

      expect(response.status).toBe(409);
      expect((await response.json()).message).toMatch(/already open/i);

      // The refusal is what stops a second hundred Coins being handed out.
      expect((await ledgerFor(admin.details.email)).length).toBe(1);
    });

    it("refuses a name another Season has, however it is capitalised", async () => {
      const admin = await signUpAdmin();
      await openSeason(admin.cookie, "Season 1");

      // A second Season needs the first one closed, which is the route an
      // admin presses. Nothing has been imported into it, so there is no card
      // to finish first.
      await closeOpenSeason(admin.cookie);

      const response = await openSeason(admin.cookie, "SEASON 1");

      expect(response.status).toBe(409);
      expect((await response.json()).message).toMatch(/already has that name/i);
    });

    it("refuses a name too short to tell one Season from another", async () => {
      const admin = await signUpAdmin();

      const response = await openSeason(admin.cookie, "S");

      expect(response.status).toBe(422);
      expect(await testDatabase().select().from(seasons)).toEqual([]);
    });

    it("lists what every Season started, counted from the ledger", async () => {
      const admin = await signUpAdmin();
      await signUp();
      await openSeason(admin.cookie, "Season 1");

      expect(await $fetch("/api/admin/seasons", { headers: { cookie: admin.cookie } })).toEqual({
        seasons: [expect.objectContaining({ name: "Season 1", status: "open", fansGranted: 2 })],
      });
    });
  });

  describe("joining", () => {
    it("gives a fan joining part-way through the same Coins as everyone else", async () => {
      const admin = await signUpAdmin();
      await openSeason(admin.cookie, "Season 1");

      const late = await signUp();

      expect(await balance(late.cookie)).toEqual({
        season: { name: "Season 1" },
        balance: STARTING_BALANCE,
      });
    });

    it("records the Coins as a ledger row, with what caused them", async () => {
      const admin = await signUpAdmin();
      await openSeason(admin.cookie, "Season 1");
      const late = await signUp();

      const season = await openedSeason();

      // Every column ADR-0003 asks a Coin Transaction to carry: what kind of
      // movement, how many Coins and which way, why, and what caused it.
      expect(await ledgerFor(late.details.email)).toEqual([
        expect.objectContaining({
          seasonId: season.id,
          kind: "season_grant",
          amount: STARTING_BALANCE,
          reason: "Joined Season 1",
          cause: "season",
          causeId: season.id,
        }),
      ]);

      // And the fan who was here when it opened is told apart from the one who
      // was not, without a second query.
      expect((await ledgerFor(admin.details.email)).at(0)?.reason).toBe("Season 1 opened");
    });

    it("gives a fan who signs up before any Season nothing to play with yet", async () => {
      const early = await signUp();

      expect(await balance(early.cookie)).toEqual({ season: null, balance: null });
    });

    it("starts them when a Season finally opens", async () => {
      const early = await signUp();
      const admin = await signUpAdmin();

      await openSeason(admin.cookie, "Season 1");

      expect(await balance(early.cookie)).toMatchObject({ balance: STARTING_BALANCE });
    });
  });

  describe("the Balance a fan is shown", () => {
    it("is the fan's own, and needs a session to ask for", async () => {
      const admin = await signUpAdmin();
      await openSeason(admin.cookie, "Season 1");

      expect((await fetch("/api/coins/balance")).status).toBe(401);
    });

    it("is never rendered into a page that can be edge-cached", async () => {
      const admin = await signUpAdmin();
      await openSeason(admin.cookie, "Season 1");

      // The header carrying this Balance is on every marketing page, and those
      // are stored at the edge with a key that ignores cookies (ADR-0008). So
      // the HTML has to be the same for everyone and the browser has to fill
      // the Balance in — which is what `app/components/FanBalance.vue` does,
      // and what this holds it to.
      const page = await $fetch("/contest-rules", { headers: { cookie: admin.cookie } });

      // The header has somewhere for a Balance to go, and no Balance in it.
      // Without the first of those the second would pass on a site that had
      // never heard of Coins.
      expect(page).toContain("data-fan-balance");
      expect(page).not.toContain(`${STARTING_BALANCE} Coins`);
      expect(await balance(admin.cookie)).toMatchObject({ balance: STARTING_BALANCE });
    });
  });

  describe("the ledger", () => {
    it("has no route that grants Coins, to an admin or to anybody else", async () => {
      const admin = await signUpAdmin();
      await openSeason(admin.cookie, "Season 1");

      // Not a proof — an endpoint nobody has written cannot be enumerated —
      // but the shape a Coin printer would arrive in, and a place for the next
      // person tempted to add one to find this test.
      for (const path of ["/api/admin/coins", "/api/coins/grant", "/api/admin/balances"]) {
        expect((await postJson(path, { coins: 1_000_000 }, admin.cookie)).status).toBe(404);
      }

      expect(await balance(admin.cookie)).toMatchObject({ balance: STARTING_BALANCE });
    });

    it("refuses a second grant to the same fan in the same Season", async () => {
      const admin = await signUpAdmin();
      await openSeason(admin.cookie, "Season 1");

      const season = await openedSeason();
      const userId = await fanId(admin.details.email);

      const refusal = await testDatabase()
        .insert(coinTransactions)
        .values({
          seasonId: season.id,
          userId,
          kind: "season_grant",
          amount: STARTING_BALANCE,
          reason: "Season 1 opened",
          cause: "season",
          causeId: season.id,
        })
        .then(
          () => "wrote a second grant",
          (error: Error) => `${error.message} ${error.cause}`,
        );

      expect(refusal).toMatch(/coin_transactions_one_grant_per_fan/);
    });

    it("refuses a grant worth anything but the starting Balance", async () => {
      const admin = await signUpAdmin();
      await openSeason(admin.cookie, "Season 1");

      const season = await openedSeason();
      const stranger = await createUser();

      const refusal = await testDatabase()
        .insert(coinTransactions)
        .values({
          seasonId: season.id,
          userId: stranger.id,
          kind: "season_grant",
          amount: 1_000_000,
          reason: "a favour",
          cause: "season",
          causeId: season.id,
        })
        .then(
          () => "wrote it",
          (error: Error) => `${error.message} ${error.cause}`,
        );

      expect(refusal).toMatch(/coin_transactions_grant_is_the_starting_balance/);
    });

    it("refuses to have a row rewritten, however anybody asks", async () => {
      const admin = await signUpAdmin();
      await openSeason(admin.cookie, "Season 1");

      const rewrite = await testDatabase()
        // Drizzle's own error names the query; what the trigger said is the
        // cause underneath it.
        .execute(sql`update coin_transactions set amount = 1000000`)
        .then(
          () => "rewrote it",
          (error: Error) => `${error.message} ${error.cause}`,
        );

      expect(rewrite).toMatch(/append-only/i);
      expect(await balance(admin.cookie)).toMatchObject({ balance: STARTING_BALANCE });
    });

    it("refuses to have a row taken back out", async () => {
      const admin = await signUpAdmin();
      await openSeason(admin.cookie, "Season 1");

      const removal = await testDatabase()
        .execute(sql`delete from coin_transactions`)
        .then(
          () => "deleted it",
          (error: Error) => `${error.message} ${error.cause}`,
        );

      expect(removal).toMatch(/append-only/i);
      expect((await ledgerFor(admin.details.email)).length).toBe(1);
    });
  });

  describe("a fan who ended up with no Coins", () => {
    it("can be started by hand, the way the README says", async () => {
      const admin = await signUpAdmin();
      await openSeason(admin.cookie, "Season 1");

      // The joining grant is not in the same transaction as the account and
      // cannot be (ADR-0010), so an account can exist holding nothing. This
      // fan is written straight into the table, which is what that failure
      // leaves behind.
      const stranded = await createUser();
      const database = testDatabase();

      // Word for word the `insert` the README tells a human to run, so the
      // documented repair and the tested one cannot drift apart.
      await database.execute(sql`
        insert into coin_transactions (season_id, user_id, kind, amount, reason, cause, cause_id)
        select s.id, u.id, 'season_grant', 100, 'Joined ' || s.name, 'season', s.id
        from seasons s, users u
        where s.status = 'open' and lower(u.email) = lower(${stranded.email})
        on conflict do nothing
      `);
      await database.execute(sql`
        insert into balance_cache (season_id, user_id, balance)
        select season_id, user_id, sum(amount) from coin_transactions
        where season_id = (select id from seasons where status = 'open')
        group by season_id, user_id
        on conflict (season_id, user_id) do update
          set balance = excluded.balance, updated_at = now()
      `);

      const [held] = await database
        .select({ balance: balanceCache.balance })
        .from(balanceCache)
        .where(eq(balanceCache.userId, stranded.id));

      expect(held).toEqual({ balance: STARTING_BALANCE });

      // And running it twice is refused rather than doubled, which is what
      // makes it safe to hand to somebody at three in the morning.
      const again = await database.execute(sql`
          insert into coin_transactions (season_id, user_id, kind, amount, reason, cause, cause_id)
          select s.id, u.id, 'season_grant', 100, 'Joined ' || s.name, 'season', s.id
          from seasons s, users u
          where s.status = 'open' and lower(u.email) = lower(${stranded.email})
          on conflict do nothing
          returning id
        `);

      expect(again.length).toBe(0);
    });
  });

  describe("the materialised Balance", () => {
    it("is what a Balance is read from, rather than the ledger being added up", async () => {
      const admin = await signUpAdmin();
      await openSeason(admin.cookie, "Season 1");

      // A number the ledger does not justify. If the read aggregated the
      // ledger it would answer 100 and this would look like it passed for the
      // right reason — which is the whole difficulty with caching something.
      await testDatabase().update(balanceCache).set({ balance: 7 });

      expect(await balance(admin.cookie)).toMatchObject({ balance: 7 });
    });

    it("can be thrown away and rebuilt from the ledger", async () => {
      const admin = await signUpAdmin();
      await signUp();
      await openSeason(admin.cookie, "Season 1");
      await signUp();

      const database = testDatabase();
      const season = await openedSeason();

      // Corrupt it the two ways a bug would: a number no ledger row justifies,
      // and a Balance for somebody with no rows at all.
      const stranger = await createUser();

      await database.update(balanceCache).set({ balance: 9_999 });
      await database
        .insert(balanceCache)
        .values({ seasonId: season.id, userId: stranger.id, balance: 500 });

      await rebuildBalanceCache(database, season.id);

      // Derived here rather than asked of the code being tested, so that the
      // assertion is what the ledger says and not what the rebuild thinks.
      const fromTheLedger = await database.execute<{ user_id: string; total: number }>(sql`
        select user_id, sum(amount)::int as total
        from coin_transactions where season_id = ${season.id}
        group by user_id order by user_id
      `);
      const cached = await database
        .select({ user_id: balanceCache.userId, total: balanceCache.balance })
        .from(balanceCache)
        .orderBy(balanceCache.userId);

      expect(cached).toEqual([...fromTheLedger]);
      // A hundred rather than one, so a rebuild that counted rows instead of
      // adding their amounts up would fail here rather than agree by accident.
      expect(cached.every((row) => row.total === STARTING_BALANCE)).toBe(true);
      expect(await balance(admin.cookie)).toMatchObject({ balance: STARTING_BALANCE });
    });
  });
});
