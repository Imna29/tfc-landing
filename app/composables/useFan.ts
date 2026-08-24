import type { Fan } from "#shared/fan";

/**
 * Whoever is signed in on this request, or `null` if nobody is.
 *
 * Asks the server rather than reading a client-side session, and does it with
 * `useRequestFetch` so the cookie that arrived with the page reaches the API
 * during server rendering. Every route that shows this is exempt from the edge
 * cache (ADR-0008), so a rendered answer is only ever the answer for the fan
 * who asked.
 */
export function useFan() {
  const request = useRequestFetch();

  return useAsyncData<Fan | null>("fan", async () => {
    try {
      return await request<Fan>("/api/accounts/me");
    } catch (error) {
      // Signed out is an answer, not a failure. Anything else is a failure and
      // should look like one rather than like an empty profile.
      if ((error as { statusCode?: number }).statusCode === 401) return null;
      throw error;
    }
  });
}
