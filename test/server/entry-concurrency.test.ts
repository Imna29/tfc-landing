import { $fetch } from "@nuxt/test-utils/e2e";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { STARTING_BALANCE } from "../../shared/coins";
import { coinTransactions, entries } from "../../server/db/schema";
import { postJson, signUp } from "../helpers/accounts";
import { cardBout, cardInTheGame } from "../helpers/cards";
import { testDatabase } from "../helpers/database";
import { setupTestServer } from "../helpers/server";
import { confirmEmail, fanId } from "../helpers/users";

/**
 * Two requests about the same fan's Coins, arriving in the same moment.
 *
 * A file of its own because it needs a different server: the rest of the suite
 * runs on `DATABASE_POOL_MAX=1`, the connection budget a serverless function
 * has, and on one connection the driver queues the second request behind the
 * first — which would make these pass whether or not anything in the
 * application had actually taken a lock. The whole point here is that the
 * second request is genuinely in flight while the first is deciding.
 *
 * What they are guarding is the only kind of bug in this feature that cannot
 * be corrected by hand afterwards without somebody noticing: Coins committed
 * twice over, or returned twice over. No constraint could catch either on its
 * own — neither transaction can see the other's uncommitted rows — so it is
 * the `for update` in `balanceToCommitFrom` and the one in `cancelEntry` that
 * have to, and this is what says so.
 */
describe("two requests in the same moment", async () => {
  await setupTestServer({ env: { DATABASE_POOL_MAX: "4" } });

  it("commits the Coins once, and refuses the Entry there are none left for", async () => {
    const card = await cardInTheGame({
      scheduledStart: new Date(Date.now() + 120 * 60_000),
      bouts: [cardBout({ cardOrder: 1 }), cardBout({ cardOrder: 2, mainEvent: true })],
    });

    const signedUp = await signUp();

    await confirmEmail(signedUp.details.email);

    const fan = await fanId(signedUp.details.email);

    // Two Entries, each for everything the fan holds, on different Bouts so
    // that nothing but the Coins can decide between them.
    const [first, second] = await Promise.all(
      card.bouts.map((bout) =>
        postJson(
          "/api/predictions/entries",
          { amount: STARTING_BALANCE, predictions: [{ boutId: bout.id, corner: "red" }] },
          signedUp.cookie,
        ),
      ),
    );

    expect([first!.status, second!.status].sort()).toEqual([201, 422]);

    // One Entry, one commitment, and a Balance at zero rather than below it.
    expect(
      (await testDatabase().select().from(entries).where(eq(entries.userId, fan))).length,
    ).toBe(1);

    const ledger = await testDatabase()
      .select()
      .from(coinTransactions)
      .where(eq(coinTransactions.userId, fan));

    expect(ledger.reduce((total, row) => total + row.amount, 0)).toBe(0);
    expect(await $fetch("/api/coins/balance", { headers: { cookie: signedUp.cookie } })).toEqual({
      season: { name: "Season 1" },
      balance: 0,
    });
  });

  it("cancels an Entry once, and returns its Coins once", async () => {
    const card = await cardInTheGame({
      scheduledStart: new Date(Date.now() + 120 * 60_000),
      bouts: [cardBout({ cardOrder: 1 }), cardBout({ cardOrder: 2, mainEvent: true })],
    });

    const signedUp = await signUp();

    await confirmEmail(signedUp.details.email);

    const fan = await fanId(signedUp.details.email);

    const submitted = await postJson(
      "/api/predictions/entries",
      { amount: 40, predictions: [{ boutId: card.bouts[0]!.id, corner: "red" }] },
      signedUp.cookie,
    );

    expect(submitted.status).toBe(201);

    const { entry } = (await submitted.json()) as { entry: { id: string } };

    // The same Entry cancelled twice at once, which is a fan double-tapping
    // the button on a slow connection.
    const [first, second] = await Promise.all([
      postJson(`/api/predictions/entries/${entry.id}/cancel`, {}, signedUp.cookie),
      postJson(`/api/predictions/entries/${entry.id}/cancel`, {}, signedUp.cookie),
    ]);

    expect([first!.status, second!.status].sort()).toEqual([200, 409]);

    // One refund, and a Balance restored to exactly what it was rather than to
    // more than the fan ever held.
    const ledger = await testDatabase()
      .select()
      .from(coinTransactions)
      .where(eq(coinTransactions.userId, fan));

    expect(ledger.filter((row) => row.kind === "entry_refund")).toHaveLength(1);
    expect(ledger.reduce((total, row) => total + row.amount, 0)).toBe(STARTING_BALANCE);
    expect(await $fetch("/api/coins/balance", { headers: { cookie: signedUp.cookie } })).toEqual({
      season: { name: "Season 1" },
      balance: STARTING_BALANCE,
    });
  });

  it("leaves the Balance saying what the ledger says when a submission and a cancellation cross", async () => {
    // The quieter of the two races, and the one no constraint could catch.
    // `materialiseBalances` recomputes a Balance from the ledger rather than
    // adding to it, so a statement that began before the other transaction
    // committed sums the ledger without its rows — and writes a cached number
    // neither request meant. Nobody is over-credited by that, because the
    // ledger is the Balance (ADR-0003); the header just goes on being wrong.
    // Both transactions taking the Balance row first is what stops it.
    const card = await cardInTheGame({
      scheduledStart: new Date(Date.now() + 120 * 60_000),
      bouts: [cardBout({ cardOrder: 1 }), cardBout({ cardOrder: 2, mainEvent: true })],
    });

    const signedUp = await signUp();

    await confirmEmail(signedUp.details.email);

    const fan = await fanId(signedUp.details.email);

    const first = await postJson(
      "/api/predictions/entries",
      { amount: 20, predictions: [{ boutId: card.bouts[0]!.id, corner: "red" }] },
      signedUp.cookie,
    );

    expect(first.status).toBe(201);

    const { entry } = (await first.json()) as { entry: { id: string } };

    // One Entry cancelled while another is being committed, both for the same
    // fan, in the same moment.
    const [cancelled, submitted] = await Promise.all([
      postJson(`/api/predictions/entries/${entry.id}/cancel`, {}, signedUp.cookie),
      postJson(
        "/api/predictions/entries",
        { amount: 30, predictions: [{ boutId: card.bouts[1]!.id, corner: "blue" }] },
        signedUp.cookie,
      ),
    ]);

    expect([cancelled.status, submitted.status]).toEqual([200, 201]);

    const ledger = await testDatabase()
      .select()
      .from(coinTransactions)
      .where(eq(coinTransactions.userId, fan));

    // 100 granted, 20 committed and returned, 30 committed: 70 either way you
    // count it, and the materialised copy has to agree with the rows.
    const held = ledger.reduce((total, row) => total + row.amount, 0);

    expect(held).toBe(STARTING_BALANCE - 30);
    expect(await $fetch("/api/coins/balance", { headers: { cookie: signedUp.cookie } })).toEqual({
      season: { name: "Season 1" },
      balance: held,
    });
  });
});
