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
 * Two Entries submitted in the same moment.
 *
 * A file of its own because it needs a different server: the rest of the suite
 * runs on `DATABASE_POOL_MAX=1`, the connection budget a serverless function
 * has, and on one connection the driver queues the second request behind the
 * first — which would make this pass whether or not anything in the
 * application had actually taken a lock. The whole point here is that the
 * second request is genuinely in flight while the first is deciding.
 *
 * What it is guarding is the only bug in this feature that cannot be
 * corrected by hand afterwards without somebody noticing: a fan committing
 * Coins twice over. No constraint on the ledger can catch it — neither
 * transaction can see the other's uncommitted row — so it is the `for update`
 * in `balanceToCommitFrom` that has to, and this is what says so.
 */
describe("two Entries submitted in the same moment", async () => {
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
});
