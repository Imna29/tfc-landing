---
status: accepted
---

# URL matching is case-sensitive, so the cache boundary can hold

[[adr-0008]] splits the app in two: marketing pages are edge-cached, and anything that reads a
session must never be. `route-rules.ts` draws that line by path — `/profile` and the other
authenticated sections are exempted off a blanket `"/**": { isr: 600 }`.

The line had a hole in it, because the two things that match paths disagree about what a path
is. **Vue Router matches case-insensitively by default; Nitro's route rules are case-sensitive.**
So `/PROFILE` rendered the signed-in fan's page — their email address, their account — while
missing the rule that exempts `/profile`, falling through to the marketing catch-all, and being
stored at the edge for ten minutes and served to whoever asked next. Nothing anywhere errors:
this is exactly the silent failure ADR-0008 was written about, reachable by typing a URL in
capitals.

Every authenticated section was open this way — `/PROFILE`, `/ACCOUNT/SIGN-IN`, `/ADMIN`,
`/LEADERBOARD` when it lands. It could not be closed by adding spellings to the exemption list,
because the spellings are unbounded.

So route matching is made case-sensitive (`router.options.sensitive`, `nuxt.config.ts`). One
spelling per URL, which is what makes "the paths that are served" and "the paths that are
exempted" the same set, and keeps them the same set for every section a later ticket adds.

## Consequences

- A URL typed in the wrong case is no longer the page it was aiming at. Nothing in the app links
  that way, and every uid the content team authors is lower-case, but a hand-typed `/PRIZES` now
  answers 404 rather than rendering prizes. That is the cost, and it is worth it: the
  alternative was a page that renders and is then served to the wrong person.
- `app/pages/[uid].vue` had to start answering 404 for a uid with no document behind it. It
  takes any single segment, so every wrong-case URL lands there; rendering an empty `SliceZone`
  with a 200, as it did, would have turned each one into a soft 404 — indistinguishable, to a
  reader or a crawler, from a page whose content nobody had written yet.
- `test/server/cache-boundary.test.ts` asserts this against a running server, with a real
  session, because a rule this quiet is only as good as the test that fails when it is removed.
- The admin area does not need a spelling rule of its own. It had one briefly; it was deleted
  when this decision replaced it, because two mechanisms enforcing one invariant is one more
  than can be kept honest ([[adr-0011]]).
