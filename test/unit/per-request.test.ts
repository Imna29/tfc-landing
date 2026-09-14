import { describe, expect, it } from "vitest";
import { askedOncePerRequest, inOneRequest } from "../../server/utils/perRequest";

/**
 * The scope a request carries its own answers in.
 *
 * What it exists for is the shape of a PlayTFC page: rendering `/predictions`
 * calls `/api/accounts/me` and `/api/predictions/entries`, each of which is a
 * request of its own inside the render's request, and each of which used to
 * read the session again and sweep the card again. Neither second answer could
 * have differed from the first, and both cost round trips to Postgres
 * (ADR-0023).
 *
 * So the rules are about nesting and about isolation: a request opens one
 * scope, everything it calls is inside it, and a question asked twice inside
 * one is asked of Postgres once. Two requests share nothing, whatever they
 * overlap in time.
 */
describe("what one request works out once", () => {
  /** A question that counts how often it was actually asked. */
  function counted() {
    const asked = { times: 0 };
    const ask = askedOncePerRequest(async (of: string) => `${of} ${++asked.times}`);

    return { asked, ask };
  }

  it("asks once however many times it is asked, inside one request", async () => {
    const { asked, ask } = counted();

    const answers = await inOneRequest(async () => [await ask("who"), await ask("who")]);

    expect(answers).toEqual(["who 1", "who 1"]);
    expect(asked.times).toBe(1);
  });

  it("hands a request inside a request the answer the outer one already has", async () => {
    const { asked, ask } = counted();

    // The render, and the two internal calls it makes: `inOneRequest` wraps
    // every request alike, so the inner two find the scope already open.
    await inOneRequest(async () => {
      await ask("who");
      await inOneRequest(() => ask("who"));
      await inOneRequest(() => ask("who"));
    });

    expect(asked.times).toBe(1);
  });

  it("keeps two requests' answers apart, even overlapping", async () => {
    const { asked, ask } = counted();

    const both = await Promise.all([
      inOneRequest(() => ask("who")),
      inOneRequest(() => ask("who")),
    ]);

    expect(new Set(both)).toEqual(new Set(["who 1", "who 2"]));
    expect(asked.times).toBe(2);
  });

  it("does not answer the next request from the last one's scope", async () => {
    const { ask } = counted();

    await inOneRequest(() => ask("who"));

    expect(await inOneRequest(() => ask("who"))).toBe("who 2");
  });

  it("asks every time when nothing opened a scope", async () => {
    const { ask } = counted();

    expect([await ask("who"), await ask("who")]).toEqual(["who 1", "who 2"]);
  });

  it("asks once when both askers arrive before either answer does", async () => {
    const asked = { times: 0 };
    const ask = askedOncePerRequest(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return ++asked.times;
    });

    const both = await inOneRequest(() => Promise.all([ask(undefined), ask(undefined)]));

    expect(both).toEqual([1, 1]);
    expect(asked.times).toBe(1);
  });

  it("treats a question with no subject as one question whoever asks", async () => {
    // The sweep: the Locks that have fallen due are the same Locks whether the
    // card route or the Entries route is the one that asked, and they arrive
    // with a moment of their own a millisecond apart.
    const { asked, ask } = counted();

    await inOneRequest(async () => {
      await ask("the card route");
      await ask("the Entries route");
    });

    expect(asked.times).toBe(1);
  });

  it("asks again for a question about something else", async () => {
    // The session: an internal call carrying a different cookie, or none, is a
    // different question, and answering it from the render's would sign the
    // wrong fan in.
    const asked = { times: 0 };
    const ask = askedOncePerRequest(
      async (cookie: string) => `${cookie} ${++asked.times}`,
      (cookie) => cookie,
    );

    const answers = await inOneRequest(async () => [
      await ask("red's cookie"),
      await ask("blue's cookie"),
      await ask("red's cookie"),
    ]);

    expect(answers).toEqual(["red's cookie 1", "blue's cookie 2", "red's cookie 1"]);
    expect(asked.times).toBe(2);
  });

  it("gives two questions minted apart their own answers", async () => {
    // Two modules cannot collide by choosing the same wording, because neither
    // holds a name to choose: each keeps its own answers.
    const first = askedOncePerRequest(async () => "a fan");
    const second = askedOncePerRequest(async () => "a card");

    const answers = await inOneRequest(async () => [
      await first(undefined),
      await second(undefined),
    ]);

    expect(answers).toEqual(["a fan", "a card"]);
  });
});
