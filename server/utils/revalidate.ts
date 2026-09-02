/**
 * Purging a path from Vercel's edge cache.
 *
 * Every marketing path is served by an ISR function (`/**: { isr: 600 }` in
 * `route-rules.ts`), so its HTML sits at the edge for ten minutes after it is
 * built and is then refreshed *behind* the next request — the visitor who
 * arrives at minute eleven still gets the old page, and only the one after
 * that gets the new one. Each region caches separately, so a publish can look
 * like it landed in one place and not another. That, and not Prismic, is why
 * an edit does not show up.
 *
 * Vercel's way out is on-demand revalidation: a request carrying the
 * deployment's bypass token skips the cache, re-renders, and stores the result,
 * so the next visitor is served fresh HTML. The token comes from
 * `nitro.vercel.config.bypassToken` in `nuxt.config.ts`, which the Vercel
 * preset writes into the `.prerender-config.json` of every ISR route at build
 * time — so rotating it takes a redeploy, not just an environment variable
 * change.
 *
 * Nothing here is Vercel-only in a way that breaks elsewhere: on any other host
 * the requests are ordinary ones and the header is ignored.
 */

/** Vercel checks this against the deployment's `bypassToken`. */
const REVALIDATE_HEADER = "x-prerender-revalidate";

/**
 * How many paths are re-rendered at once.
 *
 * Each request runs a full server render, and the whole purge has to finish
 * inside one function invocation — Prismic is waiting on the response and
 * there is no `waitUntil` on this runtime to hand the work to. Eight is enough
 * to keep a site of this size well inside the limit without asking the
 * deployment to render the whole thing simultaneously.
 */
const DEFAULT_CONCURRENCY = 8;

export interface RevalidateOptions {
  /** Where to send the requests, e.g. `https://tfcgeo.com`. */
  origin: string;
  /** The deployment's `bypassToken`. */
  bypassToken: string;
  concurrency?: number;
  /** Injected by the tests; production uses the global. */
  fetch?: typeof globalThis.fetch;
}

export interface RevalidateOutcome {
  path: string;
  ok: boolean;
  /** `null` when the request never got a response. */
  status: number | null;
  error: string | null;
}

/**
 * Purges one path, reporting failure rather than throwing.
 *
 * One unreachable path must not abandon the rest: a publish that refreshed
 * every page but one is a much better outcome than a publish that stopped at
 * the first error, and the caller needs the whole list to say which happened.
 */
async function revalidatePath(
  path: string,
  { origin, bypassToken, fetch: fetchImpl }: Required<Omit<RevalidateOptions, "concurrency">>,
): Promise<RevalidateOutcome> {
  try {
    const response = await fetchImpl(new URL(path, origin), {
      // The response body is thrown away; the point is the re-render it
      // provokes and the cache entry that replaces.
      method: "HEAD",
      headers: { [REVALIDATE_HEADER]: bypassToken },
      // A redirect is the deployment answering, which is all that is being
      // asked. Following it would purge a path that was not requested.
      redirect: "manual",
    });

    return {
      path,
      ok: response.status < 400,
      status: response.status,
      error: null,
    };
  } catch (error) {
    return {
      path,
      ok: false,
      status: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Purges every path, at most `concurrency` at a time.
 *
 * Outcomes come back in the order the paths were given, whatever order they
 * finished in, so a caller can read the report against the list it passed.
 */
export async function revalidatePaths(
  paths: readonly string[],
  options: RevalidateOptions,
): Promise<RevalidateOutcome[]> {
  const {
    origin,
    bypassToken,
    concurrency = DEFAULT_CONCURRENCY,
    fetch: fetchImpl = globalThis.fetch,
  } = options;

  const outcomes: RevalidateOutcome[] = Array.from({ length: paths.length });
  let next = 0;

  async function worker() {
    for (let index = next++; index < paths.length; index = next++) {
      const path = paths[index];
      if (path === undefined) {
        return;
      }

      outcomes[index] = await revalidatePath(path, { origin, bypassToken, fetch: fetchImpl });
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(Math.max(concurrency, 1), paths.length) }, worker),
  );

  return outcomes;
}
