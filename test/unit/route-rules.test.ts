import defu from "defu";
import { createRouter, toRouteMatcher } from "radix3";
import { describe, expect, it } from "vitest";
import { routeRules } from "../../route-rules";

/**
 * Resolves a path the way Nitro itself does at runtime — every matching rule
 * merged, most specific first — so these assertions describe what the server
 * will actually do, not what the config looks like.
 *
 * See `getRouteRulesForPath` in `nitropack/dist/runtime/internal/route-rules.mjs`:
 * `defu({}, ...matcher.matchAll(path).reverse())`. Key order in the config is
 * irrelevant; specificity alone decides.
 */
const matcher = toRouteMatcher(createRouter({ routes: routeRules }));

function rulesFor(path: string) {
  return defu({}, ...matcher.matchAll(path).reverse()) as {
    isr?: number | boolean;
    cache?: false | { maxAge?: number };
    ssr?: boolean;
  };
}

describe("marketing routes", () => {
  it.each(["/", "/about", "/contact", "/fighters/some-fighter", "/some-prismic-page"])(
    "%s keeps the ten-minute edge cache",
    (path) => {
      expect(rulesFor(path).isr).toBe(600);
    },
  );
});

describe("routes that read a session", () => {
  const sessionPaths = [
    "/api",
    "/api/health",
    "/api/entries",
    "/predictions",
    "/predictions/tfc-12",
    "/profile",
    "/profile/entries",
    "/admin",
    "/admin/events/tfc-12",
    "/leaderboard",
  ];

  it.each(sessionPaths)("%s is exempt from the edge cache", (path) => {
    expect(rulesFor(path).isr).toBe(false);
  });

  it.each(sessionPaths)("%s is exempt from Nitro's own route cache", (path) => {
    expect(rulesFor(path).cache).toBe(false);
  });

  it.each(["/predictions", "/profile", "/admin", "/leaderboard"])(
    "%s is server-rendered",
    (path) => {
      expect(rulesFor(path).ssr).toBe(true);
    },
  );
});

/**
 * Compiles a route-rule key the way the Vercel preset does, mirroring
 * `normalizeRouteSrc` in `nitropack/dist/presets/vercel/utils.mjs`: each path
 * segment is copied through, and `**` becomes `(?:.*)`.
 *
 * This is the reason the rules above name each section twice. Nitro's router
 * and Vercel's route table disagree about whether `/x/**` covers a bare `/x`,
 * and only one of them runs at the edge.
 */
function vercelPattern(route: string) {
  return route
    .split("/")
    .map((segment) => {
      if (segment === "**") return "(?:.*)";
      if (segment === "*") return "[^/]*";
      return segment;
    })
    .join("/");
}

/**
 * Whether Vercel would route a path away from the cached catch-all.
 *
 * The preset emits one route per uncached rule ahead of the ISR catch-all and
 * takes the first match, so a path is exempt only if some uncached rule's
 * pattern matches it. Anything else is served by the ISR function and stored
 * at the edge for as long as its `expiration` says.
 */
function vercelExemptsFromEdgeCache(path: string) {
  return Object.entries(routeRules)
    .filter(([, rule]) => rule.isr === false)
    .some(([route]) => new RegExp(`^${vercelPattern(route)}$`).test(path));
}

describe("section index paths", () => {
  const sectionIndexes = ["/api", "/predictions", "/profile", "/admin", "/leaderboard"];

  it.each(sectionIndexes)("%s is exempt in Nitro's router", (path) => {
    expect(rulesFor(path).isr).toBe(false);
  });

  // The one that matters: Nitro's router treats `/x/**` as covering `/x`, and
  // Vercel's route table does not. A rule written only as `/x/**` passes the
  // test above and still leaks at the edge.
  it.each(sectionIndexes)("%s is exempt in Vercel's route table", (path) => {
    expect(vercelExemptsFromEdgeCache(path)).toBe(true);
  });

  it.each(["/predictions/tfc-12", "/profile/entries", "/admin/events/tfc-12"])(
    "%s is exempt in Vercel's route table",
    (path) => {
      expect(vercelExemptsFromEdgeCache(path)).toBe(true);
    },
  );

  it.each(["/", "/some-prismic-page", "/fighters/some-fighter"])(
    "%s still goes to the cached catch-all",
    (path) => {
      expect(vercelExemptsFromEdgeCache(path)).toBe(false);
    },
  );
});

describe("the slice simulator", () => {
  // `{ ssr: true }` alone did not opt out of the inherited `isr: 600`, so the
  // Prismic slice simulator was being served from a ten-minute CDN cache.
  it.each(["/slice-simulator", "/slice-simulator/anything"])("%s is not cached", (path) => {
    expect(rulesFor(path).isr).toBe(false);
    expect(rulesFor(path).ssr).toBe(true);
  });
});
