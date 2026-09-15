import { createClient, filter, type WebhookBody } from "@prismicio/client";

/**
 * Purges the edge cache when Prismic publishes, instead of waiting out the
 * ten-minute `isr: 600` in `route-rules.ts` — which stays as the backstop if
 * this is misconfigured. Point a Prismic webhook at it.
 *
 * Under `/api`, which `route-rules.ts` exempts from every cache.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  const body = await readBody<Partial<WebhookBody>>(event);

  // Refuse rather than run unauthenticated.
  if (!config.prismicWebhookSecret) {
    throw createError({
      statusCode: 503,
      statusMessage: "NUXT_PRISMIC_WEBHOOK_SECRET is not set",
    });
  }

  if (!webhookSecretMatches(body?.secret, config.prismicWebhookSecret)) {
    throw createError({ statusCode: 401, statusMessage: "Bad webhook secret" });
  }

  // Prismic's "Trigger it now" button: nothing published, but a 200 confirms
  // the URL and the secret.
  if (body?.type === "test-trigger") {
    return { ok: true, type: "test-trigger", revalidated: 0, failed: [] };
  }

  if (!config.revalidateBypassToken) {
    throw createError({
      statusCode: 503,
      statusMessage: "NUXT_REVALIDATE_BYPASS_TOKEN is not set",
    });
  }

  const client = createClient(config.prismicRepository);
  const documents = await client.dangerouslyGetAll({
    filters: [filter.any("document.type", COLLECTION_TYPES)],
    lang: "*",
  });

  // An unpublished document is not in that query, so its page waits out the ten
  // minutes. Knowing its path would mean keeping our own id-to-path record.
  const paths = pathsToRevalidate(documents);
  const outcomes = await revalidatePaths(paths, {
    origin: config.revalidateOrigin || getRequestURL(event).origin,
    bypassToken: config.revalidateBypassToken,
  });

  const failed = outcomes.filter((outcome) => !outcome.ok);

  if (failed.length > 0) {
    console.error(
      `[prismic] revalidated ${outcomes.length - failed.length}/${outcomes.length} paths;` +
        ` failed: ${failed.map((outcome) => `${outcome.path} (${outcome.error ?? outcome.status})`).join(", ")}`,
    );
  }

  // 200 even on partial failure: a non-2xx makes Prismic retry the whole purge.
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
