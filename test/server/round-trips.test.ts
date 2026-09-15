import { $fetch } from "@nuxt/test-utils/e2e";
import { afterAll, describe, expect, inject, it } from "vitest";
import { askedOf, postgresBehindDelay } from "../helpers/latency";
import { fanWithCoins, submit, upcomingCard, winnerOn } from "../helpers/playing";
import { setupTestServer } from "../helpers/server";

/**
 * How many times a PlayTFC page asks Postgres anything, and what those asks
 * cost.
 *
 * The one thing about this app no other test here can see. ADR-0022: a round
 * trip to Postgres is free on a developer's machine and cost ~90ms deployed,
 * so a page that asked twenty times answered in 0.03s locally and in 2.44s for
 * a fan — and `pnpm test` went on passing at any distance. Moving the Function
 * beside its database made each trip cost about a millisecond; it did not make
 * the page ask fewer times, and the next database that moves will put the
 * distance straight back.
 *
 * So this file puts the distance back on purpose, with a proxy in front of
 * Postgres that holds every question for a fixed moment, and reads the count
 * off the slope of what the page costs against how far away Postgres is. See
 * `test/helpers/latency.ts` for why that is measured rather than counted: two
 * of the three things #50 fixed were invisible to anything that counts
 * `await`s.
 *
 * **These are budgets, not the readings.** A signed-in render measures seven
 * statements and about seven round trips; the numbers asserted have room above
 * that, because this is a backstop against a page that starts asking twice as
 * often again, not a performance benchmark. `.github/workflows/deploy.yml`
 * holds the deployed distance the same way, and for the same reason.
 */
describe("what a signed-in PlayTFC page costs", async () => {
  const postgres = await postgresBehindDelay(inject("databaseUrl"));

  await setupTestServer({ env: { DATABASE_URL: postgres.url } });

  afterAll(() => postgres.close());

  /**
   * The page as a fan who is playing meets it: a card with Bouts open, and an
   * Entry of their own already committed on it for the panel to list.
   */
  async function aFanMidCard() {
    const card = await upcomingCard(2);
    const fan = await fanWithCoins();

    await submit(fan, 10, [winnerOn(card.bouts[0]!.id, "red")]);

    return fan;
  }

  it("asks Postgres once per statement, and asks it eight times at most", async () => {
    const fan = await aFanMidCard();

    const { statements, roundTrips } = await askedOf(postgres, () =>
      $fetch<string>("/predictions", { headers: { cookie: fan.cookie } }),
    );

    // The card, the Bouts on it and what they are priced at; the session and
    // the fan behind it; the Season being played and the Entries held on it;
    // and one sweep for the whole render.
    expect(statements).toBeLessThanOrEqual(8);

    // The criterion #50 was closed on, held against the measurement rather
    // than against the count: eight is the number, and it reads about seven.
    expect(roundTrips).toBeLessThanOrEqual(8);

    // And the gap between the two is what the driver adds. It used to be the
    // count doubled, because nothing was ever prepared — see
    // `prepareEveryStatement` in `server/db/client.ts`.
    expect(roundTrips).toBeLessThan(statements + 1);
  });

  it("does not ask twice about the fan, or sweep the card twice, for one render", async () => {
    // Every route the render calls, asked on its own. Rendering the page runs
    // all three, so a page that shared nothing would cost their sum — and the
    // difference is exactly the session read twice and the sweep run twice.
    const { cookie } = await aFanMidCard();

    // Four measurements rather than one, so each is made shorter: this case is
    // about statements, which are counted rather than timed, and the distance
    // only has to be enough to keep the reading honest.
    const onItsOwn = { distance: 10, runs: 3 };

    const theCard = await askedOf(postgres, () => $fetch("/api/predictions/card"), onItsOwn);
    const theFan = await askedOf(
      postgres,
      () => $fetch("/api/accounts/me", { headers: { cookie } }),
      onItsOwn,
    );
    const theEntries = await askedOf(
      postgres,
      () => $fetch("/api/predictions/entries", { headers: { cookie } }),
      onItsOwn,
    );

    const render = await askedOf(
      postgres,
      () => $fetch<string>("/predictions", { headers: { cookie } }),
      onItsOwn,
    );

    const apart = theCard.statements + theFan.statements + theEntries.statements;

    // Three statements saved: the session `/api/accounts/me` already read, and
    // the sweep `/api/predictions/card` already ran.
    expect(render.statements).toBe(apart - 3);
  });
});
