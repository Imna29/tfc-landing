import type { Fan } from "#shared/fan";

/**
 * Whoever is signed in on this request, or `null` if nobody is.
 *
 * Asks the server rather than reading a client-side session, and does it with
 * `useRequestFetch` so the cookie that arrived with the page reaches the API
 * during server rendering. Every route that shows this is exempt from the edge
 * cache (ADR-0008), so a rendered answer is only ever the answer for the fan
 * who asked.
 *
 * The answer is never reused across a navigation. Signing in, signing out,
 * resetting a password and confirming an address all change it, and every one
 * of them is a navigation: asking again on arrival is the one rule that covers
 * them all, rather than a refresh remembered at each.
 *
 * Making that rule true takes the explicit refresh below, and not the
 * `getCachedData` beneath it. `useAsyncData` shares one entry per key across
 * pages, and a page arriving at a key whose entry already holds a *successful*
 * answer is handed it without the handler running and without `getCachedData`
 * being asked — the entry is only consulted about its cache when it is being
 * built or executed, and neither happens on that path. The sign-in page asks
 * under this key too, so a fan who signed in reached their profile holding the
 * `null` sign-in had already resolved, and went on being told to sign in until
 * they reloaded.
 *
 * `dedupe: "defer"` because the other arrival is a page reaching a key with no
 * answer yet, which does start its own request: deferring joins that one
 * instead of cancelling it and asking a second time.
 */
export async function useFan() {
  const request = useRequestFetch();
  const nuxtApp = useNuxtApp();

  const fan = useAsyncData<Fan | null>(
    "fan",
    async () => {
      try {
        return await request<Fan>("/api/accounts/me");
      } catch (error) {
        // Signed out is an answer, not a failure. Anything else is a failure and
        // should look like one rather than like an empty profile.
        if ((error as { statusCode?: number }).statusCode === 401) return null;
        throw error;
      }
    },
    {
      // Not the freshness rule — the refresh below is that. This refuses the
      // *other* cache `useAsyncData` will read from: Nuxt's default hands back
      // `nuxtApp.static.data[key]`, the extracted payload of a prerendered
      // route, which is one visitor's answer replayed to whoever asks next.
      // Empty today because nothing here is prerendered, and a session is not
      // a thing to find out about that the hard way. Hydration is the one
      // moment a cache holds this fan's own answer, because it is what this
      // same request just rendered.
      getCachedData: (key, app) => (app.isHydrating ? app.payload.data[key] : undefined),
    },
  );

  // Server rendering has just run the handler, and hydration is holding what it
  // returned. Everything else is an arrival.
  if (import.meta.client && !nuxtApp.isHydrating) {
    await fan.refresh({ dedupe: "defer" });
  }

  return fan;
}
