import { describe, expect, it, vi } from "vitest";
import { revalidatePaths } from "../../server/utils/revalidate";
import { webhookSecretMatches } from "../../server/utils/webhook-secret";

const BYPASS_TOKEN = "a-bypass-token";
const ORIGIN = "https://tfcgeo.com";

/** A stand-in for `fetch`, typed as one so the recorded calls are too. */
function respondWith(status = 200) {
  return vi.fn<typeof globalThis.fetch>(async () => new Response(null, { status }));
}

describe("purging a path", () => {
  it("asks the deployment for the page, at the origin it was given", async () => {
    const fetch = respondWith();

    await revalidatePaths(["/fighters/giorgi"], {
      origin: ORIGIN,
      bypassToken: BYPASS_TOKEN,
      fetch,
    });

    expect(fetch).toHaveBeenCalledOnce();
    expect(String(fetch.mock.calls[0]?.[0])).toBe(`${ORIGIN}/fighters/giorgi`);
  });

  /**
   * The whole mechanism is this header. Without it the request is answered from
   * the very cache entry it was meant to replace, and the purge silently does
   * nothing at all — which looks exactly like success.
   */
  it("carries the bypass token Vercel checks", async () => {
    const fetch = respondWith();

    await revalidatePaths(["/"], { origin: ORIGIN, bypassToken: BYPASS_TOKEN, fetch });

    expect(new Headers(fetch.mock.calls[0]?.[1]?.headers).get("x-prerender-revalidate")).toBe(
      BYPASS_TOKEN,
    );
  });

  it("does not ask for a body it throws away", async () => {
    const fetch = respondWith();

    await revalidatePaths(["/"], { origin: ORIGIN, bypassToken: BYPASS_TOKEN, fetch });

    expect(fetch.mock.calls[0]?.[1]?.method).toBe("HEAD");
  });

  it("counts a redirect as done, because the deployment answered", async () => {
    const [outcome] = await revalidatePaths(["/"], {
      origin: ORIGIN,
      bypassToken: BYPASS_TOKEN,
      fetch: respondWith(308),
    });

    expect(outcome?.ok).toBe(true);
  });

  it("counts an error status as not done", async () => {
    const [outcome] = await revalidatePaths(["/"], {
      origin: ORIGIN,
      bypassToken: BYPASS_TOKEN,
      fetch: respondWith(500),
    });

    expect(outcome).toMatchObject({ path: "/", ok: false, status: 500 });
  });
});

describe("purging every path", () => {
  /**
   * The reason one path is reported rather than thrown: a publish that
   * refreshed every page but one is a far better outcome than one that stopped
   * at the first failure and left the rest stale.
   */
  it("keeps going after a path fails, and says which one did", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (url) =>
      String(url).endsWith("/contact") ? Promise.reject(new Error("boom")) : new Response(null),
    );

    const outcomes = await revalidatePaths(["/", "/contact", "/about"], {
      origin: ORIGIN,
      bypassToken: BYPASS_TOKEN,
      fetch,
    });

    expect(outcomes.filter((outcome) => outcome.ok).map((outcome) => outcome.path)).toEqual([
      "/",
      "/about",
    ]);
    expect(outcomes.find((outcome) => !outcome.ok)).toMatchObject({
      path: "/contact",
      status: null,
      error: "boom",
    });
  });

  it("reports outcomes in the order the paths were given", async () => {
    const paths = ["/", "/a", "/b", "/c", "/d"];
    const fetch = vi.fn<typeof globalThis.fetch>(async (url) => {
      // Finish in a different order from the one asked for.
      await new Promise((resolve) => setTimeout(resolve, 20 - String(url).length));

      return new Response(null);
    });

    const outcomes = await revalidatePaths(paths, {
      origin: ORIGIN,
      bypassToken: BYPASS_TOKEN,
      fetch,
    });

    expect(outcomes.map((outcome) => outcome.path)).toEqual(paths);
  });

  /**
   * The purge has to finish inside one function invocation with Prismic waiting
   * on it. Rendering the whole site at once is how that runs out of time.
   */
  it("never has more than `concurrency` renders in flight", async () => {
    let inFlight = 0;
    let peak = 0;
    const fetch = vi.fn<typeof globalThis.fetch>(async () => {
      peak = Math.max(peak, ++inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight--;

      return new Response(null);
    });

    await revalidatePaths(
      Array.from({ length: 20 }, (_, index) => `/page-${index}`),
      {
        origin: ORIGIN,
        bypassToken: BYPASS_TOKEN,
        concurrency: 3,
        fetch,
      },
    );

    expect(fetch).toHaveBeenCalledTimes(20);
    expect(peak).toBe(3);
  });

  it("does nothing, rather than hanging, when there is nothing to purge", async () => {
    const fetch = respondWith();

    await expect(
      revalidatePaths([], { origin: ORIGIN, bypassToken: BYPASS_TOKEN, fetch }),
    ).resolves.toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
});

/**
 * The endpoint re-renders every page on the site, so this comparison is the
 * only thing between a stranger and an unlimited amount of our compute.
 */
describe("the webhook secret", () => {
  it("accepts the configured secret", () => {
    expect(webhookSecretMatches("s3cret", "s3cret")).toBe(true);
  });

  it.each([
    ["a different secret", "nope"],
    ["a prefix of it", "s3cre"],
    ["the secret with more on the end", "s3cretand"],
    ["nothing", ""],
  ])("rejects %s", (_description, provided) => {
    expect(webhookSecretMatches(provided, "s3cret")).toBe(false);
  });

  // Prismic sends `null` when no secret is configured on its side, and a body
  // that was never JSON gives no field at all.
  it.each([[null], [undefined], [123], [{}]])("rejects %s, which is not a secret", (provided) => {
    expect(webhookSecretMatches(provided, "s3cret")).toBe(false);
  });

  // Otherwise a deployment that forgot the variable would accept every caller
  // that also sent nothing.
  it("rejects everything when no secret is configured", () => {
    expect(webhookSecretMatches("", "")).toBe(false);
    expect(webhookSecretMatches("anything", "")).toBe(false);
  });
});
