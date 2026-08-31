/**
 * The cache boundary (ADR-0008).
 *
 * The marketing site is anonymous HTML and stays edge-cached. Anything that
 * reads a session must never be, because the CDN cache key ignores cookies:
 * the first visitor's personalised page would be stored and served to everyone
 * behind them, with no error anywhere to notice it by.
 *
 * Adding an authenticated route under a path still covered by the marketing
 * rule is therefore a data leak, not a performance regression.
 * `test/unit/route-rules.test.ts` resolves these rules both the way Nitro does
 * and the way Vercel does, and `test/server/cache-boundary.test.ts` proves a
 * running server behaves that way.
 *
 * The marketing side stays a blanket rule with the sensitive sections exempted
 * off it, rather than an allow-list of cacheable paths, because Prismic pages
 * are served by a catch-all route: a page can appear at any path the content
 * team invents, so the set of cacheable paths cannot be written down. ADR-0008
 * anticipates this shape — "any new authenticated route must be added to the
 * exemption list" — and it is the side of the trade-off that needs watching,
 * because forgetting to exempt a route fails open.
 *
 * These rules also assume there is only one spelling of each path to exempt.
 * Vue Router does not assume that on its own — `/PROFILE` matched `/profile`
 * and missed its exemption — so `nuxt.config.ts` makes route matching
 * case-sensitive. See ADR-0012.
 */
import type { NuxtConfig } from "nuxt/schema";

// `noUncheckedIndexedAccess` adds `undefined` when indexing a record by string.
type RouteRule = NonNullable<NonNullable<NuxtConfig["routeRules"]>[string]>;

/**
 * Not cached by anything, on any host.
 *
 * `isr` is only read by the Vercel and Netlify presets; every other target
 * ignores it entirely. `cache` is Nitro's own route cache and applies
 * everywhere. Hosting is still undecided (see
 * `docs/research/nuxt4-auth-postgres-stack.md`), so a route that must not be
 * cached says so both ways.
 */
const uncached = { isr: false, cache: false } as const;

/**
 * A section index and everything under it.
 *
 * Two rules rather than one, because the two matchers that read them disagree.
 * Nitro's own router treats `/x/**` as covering a bare `/x`, but the Vercel
 * preset compiles that rule to the regex `/x/(?:.*)`, which does not — so a
 * request for `/x` would miss the exemption, fall through to the marketing
 * catch-all, and be edge-cached for ten minutes. Writing both is what closes
 * that gap; this helper exists so that one of them cannot be forgotten.
 *
 * Verified by building with `NITRO_PRESET=vercel` and reading the emitted
 * `.vercel/output/config.json`.
 */
function section<Path extends string>(
  path: Path,
  rule: RouteRule,
): Record<Path | `${Path}/**`, RouteRule> {
  // Computed keys widen to `string` on their own, which would erase every
  // section from the type of `routeRules` and leave `satisfies` below checking
  // almost nothing.
  return { [path]: rule, [`${path}/**`]: rule } as Record<Path | `${Path}/**`, RouteRule>;
}

export const routeRules = {
  // ── Public marketing site: anonymous, identical for everyone ──
  "/**": { isr: 600 },

  // ── The API: sessions, Entries, Balances, settlement ──
  ...section("/api", uncached),

  // ── Sections that read a session, server-rendered per request ──
  // Signing in and signing up are personalised before a fan even has an
  // account: the page sets a session cookie, and an edge-cached copy of it
  // would be the same page for everyone who followed.
  ...section("/account", { ...uncached, ssr: true }),
  ...section("/profile", { ...uncached, ssr: true }),
  ...section("/admin", { ...uncached, ssr: true }),

  // The leaderboard is public, but it pins the signed-in user's own row below
  // the top ten, so the page as a whole is personalised (ADR-0008).
  ...section("/leaderboard", { ...uncached, ssr: true }),

  // ── Exempt for staleness rather than for privacy ──
  // The card a fan reads is the same HTML for every visitor, signed in or
  // out, which is exactly the shape of page the marketing rule would happily
  // store. It is exempt anyway: a copy ten minutes old is a Bout shown open
  // that locked eight minutes ago, and a Multiplier shown that has since been
  // corrected. This is the easier of the two reasons to forget, which is why
  // it is written here rather than only in the page.
  //
  // Building and submitting an Entry is under here too, and that half does
  // read a session — so this rule holds for both reasons.
  ...section("/predictions", { ...uncached, ssr: true }),

  // ── Prismic slice simulator: a development tool, never cached ──
  ...section("/slice-simulator", { ...uncached, ssr: true }),
} satisfies NuxtConfig["routeRules"];
