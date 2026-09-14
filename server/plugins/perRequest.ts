import { inOneRequest } from "../utils/perRequest";

/**
 * Opens one scope per request, around everything that request goes on to do.
 *
 * Wrapping the app's own handler rather than adding a middleware, because a
 * middleware cannot wrap: it runs, returns, and the rest of the request
 * happens after it. What is needed here is the request *inside* the scope, so
 * that `AsyncLocalStorage` carries it to everything the handler calls —
 * including the internal `$fetch`es a page render makes, which is the whole
 * point (ADR-0023, and `server/utils/perRequest.ts`).
 *
 * Nitro assigns over this same handler for its own `experimental.asyncContext`
 * and `toNodeListener` reads it on each request, so the shape is the one Nitro
 * uses on itself rather than a trick. A plugin runs after the app is built,
 * which is what makes this the outermost thing a request meets.
 *
 * `inOneRequest` opens a scope only when there is not one already, so the
 * internal requests that pass through here again join the render's scope
 * instead of starting scopes of their own.
 */
export default defineNitroPlugin((nitro) => {
  const handle = nitro.h3App.handler;

  nitro.h3App.handler = (event) => inOneRequest(() => handle(event));
});
