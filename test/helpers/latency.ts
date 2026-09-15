import { connect, createServer, type Socket } from "node:net";

/**
 * Postgres with a chosen distance in front of it, counting what is asked
 * through it.
 *
 * ADR-0022 is the reason this exists. Every round trip to Postgres is free on
 * a developer's machine and cost ~90ms deployed, so the one number that
 * decides what a PlayTFC page costs — how many times it asks — is the one
 * number no local run can see. This puts the distance back: a TCP proxy that
 * forwards both directions and holds each question back by a fixed amount.
 *
 * **Round trips, not statements, which is the point.** The delay goes on the
 * app-to-Postgres direction, because that is the direction a question travels
 * in and the app cannot ask again until the last answer arrived. So a
 * statement the driver has to Parse before it can Bind is two writes and costs
 * twice, exactly as it does across an ocean, and questions the driver coalesces
 * into one write cost once. Counting `await`s in the handlers sees neither.
 *
 * Writes rather than replies, which is the approximation in it: it reads a
 * round trip each time the app has something to say, so a driver that wrote
 * twice without needing an answer in between would be charged for two. It
 * cannot therefore under-count, which is what a budget needs of it.
 *
 * It counts the statements too, off the wire, because the gap between the two
 * numbers *is* the driver: seven statements arriving as fourteen round trips
 * is a driver that cannot prepare anything (ADR-0023).
 *
 * For the test database and nothing else. It reads the bytes going past, so it
 * only counts what it can read — a connection negotiating TLS would still be
 * proxied and delayed correctly, and every statement through it would go
 * uncounted.
 */
export interface DelayedPostgres {
  /** The connection string to hand the app, in place of the real one. */
  url: string;
  /** How far away Postgres is from here on, in milliseconds. */
  delay(milliseconds: number): void;
  /** How many statements have been asked through here since it opened. */
  statements(): number;
  close(): Promise<void>;
}

/**
 * The frontend messages that are a statement being run: `Bind` under the
 * extended protocol, and `Query` under the simple one.
 *
 * Counted rather than `Parse`, because a prepared statement is Parsed once and
 * Bound on every run — counting Parse would say a page that asks the same
 * question eight times asks nothing at all.
 */
const BIND = "B".charCodeAt(0);
const SIMPLE_QUERY = "Q".charCodeAt(0);

/**
 * Starts a proxy in front of this database and answers with where it is
 * listening.
 *
 * Starts at no delay, so that whatever a test has to arrange first costs what
 * it always did.
 */
export async function postgresBehindDelay(databaseUrl: string): Promise<DelayedPostgres> {
  const upstream = new URL(databaseUrl);
  const live = new Set<Socket>();

  let delay = 0;
  let statements = 0;

  const proxy = createServer((app) => {
    const postgres = connect({
      host: upstream.hostname,
      port: Number(upstream.port || 5432),
    });

    live.add(app).add(postgres);

    const count = countingStatements(() => (statements += 1));

    // One chain per connection, so that holding a question back delays what
    // follows it rather than letting it overtake: a driver that wrote Bind
    // before Parse arrived would not be talking to Postgres any more.
    let asking = Promise.resolve();

    app.on("data", (question: Buffer) => {
      count(question);

      asking = asking.then(async () => {
        // Read now rather than closed over, so a test can change the distance
        // without opening a new connection — which is the whole measurement:
        // the same server, the same connection, two distances.
        if (delay > 0) await new Promise((over) => setTimeout(over, delay));

        postgres.write(question);
      });
    });

    postgres.on("data", (answer: Buffer) => app.write(answer));

    const hangUp = () => {
      app.destroy();
      postgres.destroy();
      live.delete(app);
      live.delete(postgres);
    };

    app.on("close", hangUp);
    postgres.on("close", hangUp);
    app.on("error", hangUp);
    postgres.on("error", hangUp);
  });

  await new Promise<void>((listening) => proxy.listen(0, "127.0.0.1", listening));

  const address = proxy.address();

  if (typeof address !== "object" || !address) throw new Error("The proxy is not listening.");

  const url = new URL(databaseUrl);

  url.hostname = "127.0.0.1";
  url.port = String(address.port);

  return {
    url: url.toString(),
    delay: (milliseconds) => {
      delay = milliseconds;
    },
    statements: () => statements,
    close: () =>
      new Promise((closed) => {
        for (const socket of live) socket.destroy();

        proxy.close(() => closed());
      }),
  };
}

/**
 * Reads one connection's frontend messages out of the bytes going past, and
 * says when one of them is a statement being run.
 *
 * Every message after the startup packet is a type byte and a length, so this
 * only has to keep whatever tail of a message a write ended in the middle of.
 * The startup packet has no type byte, which is what `greeted` is for: it is
 * the one message whose first byte would otherwise be read as a type.
 */
function countingStatements(one: () => void): (chunk: Buffer) => void {
  let rest: Buffer = Buffer.alloc(0);
  let greeted = false;

  return (chunk) => {
    rest = rest.length === 0 ? chunk : Buffer.concat([rest, chunk]);

    for (;;) {
      const header = greeted ? 5 : 4;

      if (rest.length < header) return;

      const length = rest.readUInt32BE(greeted ? 1 : 0);
      const message = greeted ? length + 1 : length;

      if (rest.length < message) return;

      if (greeted) {
        const type = rest[0];

        if (type === BIND || type === SIMPLE_QUERY) one();
      }

      greeted = true;
      rest = rest.subarray(message);
    }
  };
}

/**
 * What one request asks Postgres: how many statements, and how many round
 * trips those cost.
 *
 * The count of round trips is read off the slope of what the request costs
 * against how far away Postgres is, rather than counted, because counting
 * `await`s misses what the driver adds underneath them — which was most of the
 * twenty this page started from. Twenty milliseconds of added distance turning
 * a 30ms render into a 430ms one is twenty round trips, whatever the source
 * looks like.
 *
 * The floor of several runs rather than the mean: a garbage collection, a busy
 * machine and a cold code path all only ever add, so the fastest run is the
 * honest reading of what the request costs. `.github/workflows/deploy.yml`
 * measures the deployed distance the same way and for the same reason.
 */
export async function askedOf(
  postgres: DelayedPostgres,
  make: () => Promise<unknown>,
  { distance = 20, runs = 5 } = {},
): Promise<{ statements: number; roundTrips: number }> {
  const floor = async (milliseconds: number) => {
    postgres.delay(milliseconds);

    // Warm first: the first render of a page compiles it, and that is a cost
    // paid once rather than a round trip.
    await make();

    let best = Number.POSITIVE_INFINITY;

    for (let run = 0; run < runs; run += 1) {
      const started = performance.now();

      await make();

      best = Math.min(best, performance.now() - started);
    }

    return best;
  };

  const near = await floor(0);

  const before = postgres.statements();

  await make();

  const statements = postgres.statements() - before;

  const far = await floor(distance);

  postgres.delay(0);

  return { statements, roundTrips: (far - near) / distance };
}
