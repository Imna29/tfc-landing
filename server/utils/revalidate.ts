/**
 * Purging a path from Vercel's edge cache.
 *
 * `/**` is `isr: 600`, so a page sits at the edge for ten minutes and is then
 * refreshed behind the next request. A request carrying the deployment's bypass
 * token skips the cache and stores a fresh render instead. The token comes from
 * `nitro.vercel.config.bypassToken`. Other hosts ignore the header.
 */

const REVALIDATE_HEADER = "x-prerender-revalidate";

/**
 * Each request is a full render, and the whole purge has to fit in one
 * invocation with Prismic waiting on it.
 */
const DEFAULT_CONCURRENCY = 8;

export interface RevalidateOptions {
  origin: string;
  bypassToken: string;
  concurrency?: number;
  /** Injected by the tests. */
  fetch?: typeof globalThis.fetch;
}

export interface RevalidateOutcome {
  path: string;
  ok: boolean;
  status: number | null;
  error: string | null;
}

/** Reports failure rather than throwing, so one bad path cannot strand the rest. */
async function revalidatePath(
  path: string,
  { origin, bypassToken, fetch: fetchImpl }: Required<Omit<RevalidateOptions, "concurrency">>,
): Promise<RevalidateOutcome> {
  try {
    const response = await fetchImpl(new URL(path, origin), {
      method: "HEAD",
      headers: { [REVALIDATE_HEADER]: bypassToken },
      // Following one would purge a path that was not asked for.
      redirect: "manual",
    });

    return { path, ok: response.status < 400, status: response.status, error: null };
  } catch (error) {
    return {
      path,
      ok: false,
      status: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Outcomes come back in the order the paths were given. */
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
