import { createClient, filter, type WebhookBody } from "@prismicio/client";

/**
 * The Prismic webhook that makes a publish show up straight away.
 *
 * Without it the site is only as fresh as `route-rules.ts` allows: `/**` is
 * `isr: 600`, so an edit waits out the ten minutes and then one more visitor
 * before anyone sees it, per edge region. Point a Prismic webhook at
 * `POST /api/prismic/revalidate` and a publish purges the pages instead of
 * waiting for them to expire. The ten minutes stay as the backstop for when
 * this endpoint is misconfigured or Prismic never calls it.
 *
 * It lives under `/api`, which `route-rules.ts` exempts from every cache — a
 * cached purge endpoint would answer the second publish out of the store built
 * by the first.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  const body = await readBody<Partial<WebhookBody>>(event);

  // Refuse rather than run unauthenticated. An open endpoint that re-renders
  // every page on demand is worth more to someone else than it is to us, and
  // failing loudly here is how a half-finished setup gets noticed.
  if (!config.prismicWebhookSecret) {
    throw createError({
      statusCode: 503,
      statusMessage: "NUXT_PRISMIC_WEBHOOK_SECRET is not set",
    });
  }

  if (!webhookSecretMatches(body?.secret, config.prismicWebhookSecret)) {
    throw createError({ statusCode: 401, statusMessage: "Bad webhook secret" });
  }

  // Prismic's "Trigger it now" button. Nothing was published, so there is
  // nothing to purge — but a 200 is what tells whoever pressed it that the URL
  // and the secret are right, which is the whole reason the button exists.
  if (body?.type === "test-trigger") {
    return { ok: true, type: "test-trigger", revalidated: 0, failed: [] };
  }

  if (!config.revalidateBypassToken) {
    throw createError({
      statusCode: 503,
      statusMessage: "NUXT_REVALIDATE_BYPASS_TOKEN is not set",
    });
  }

  // Every `api-update` purges everything, including the ones whose `documents`
  // is empty because only a Release or a custom type moved. Deciding which
  // publishes are safe to skip means predicting which pages a document appears
  // on, which is the guess this whole endpoint exists to avoid making — and an
  // unnecessary purge costs a few seconds of render, while a skipped one is
  // the stale page we started with.
  const client = createClient(config.prismicRepository);
  const documents = await client.dangerouslyGetAll({
    filters: [filter.any("document.type", COLLECTION_TYPES)],
    lang: "*",
  });

  // Note what this cannot reach: a document that was *unpublished* is gone from
  // the query above, so its path is not in the list and its page keeps serving
  // the old HTML until the ten minutes run out. Fixing that means keeping our
  // own record of which id was served at which path, which is a second source
  // of truth about Prismic's content — a worse thing to own than a ten-minute
  // wait on the rarest kind of edit.
  const paths = pathsToRevalidate(documents);
  const outcomes = await revalidatePaths(paths, {
    // The host Prismic called us on is the deployment whose cache needs
    // purging. `NUXT_REVALIDATE_ORIGIN` overrides it for the case where the
    // webhook is aimed somewhere other than the domain to refresh.
    origin: config.revalidateOrigin || getRequestURL(event).origin,
    bypassToken: config.revalidateBypassToken,
  });

  const failed = outcomes.filter((outcome) => !outcome.ok);

  // Answer 200 even when some paths failed. A non-2xx makes Prismic retry the
  // publish, which re-renders every page that already succeeded to get at the
  // few that did not; the report and the log line are the better way to find
  // out. A failure to reach Prismic at all throws above, and that one *should*
  // be retried.
  if (failed.length > 0) {
    console.error(
      `[prismic] revalidated ${outcomes.length - failed.length}/${outcomes.length} paths;` +
        ` failed: ${failed.map((outcome) => `${outcome.path} (${outcome.error ?? outcome.status})`).join(", ")}`,
    );
  }

  return {
    ok: failed.length === 0,
    type: body?.type ?? null,
    revalidated: outcomes.length - failed.length,
    failed: failed.map((outcome) => ({
      path: outcome.path,
      status: outcome.status,
      error: outcome.error,
    })),
  };
});
