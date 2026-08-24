---
status: accepted
---

# Authenticated routes are exempt from ISR, explicitly

`nuxt.config.ts` shipped with `routeRules: { '/**': { isr: 600 } }` — every route edge-cached
for ten minutes. That is correct for a Prismic brochure site and catastrophic the moment a
page renders a Balance: the first visitor's personalised page is cached and served to
everyone who follows.

So the blanket rule is replaced with explicit per-section rules. Marketing routes keep ISR.
Everything that reads a session — the prediction pages, profile, admin, and all of `/api/**`
— is uncached and server-rendered.

## Consequences

- Any new authenticated route must be added to the exemption list. A route added under a
  path still covered by an ISR pattern will leak one user's data to others, silently, with
  no error anywhere.
- The leaderboard is public but contains the signed-in user's own pinned row, so it counts
  as authenticated and cannot be edge-cached as a whole.
