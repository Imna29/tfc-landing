---
status: accepted
---

# The Function runs in the region its database is in

Vercel puts a Function in `iad1` — Washington DC — unless it is told otherwise,
and says so nowhere a developer looks. TFC's Postgres is in Europe and so are
TFC's fans, so every [[playtfc]] page was rendered across the Atlantic and back.
`nuxt.config.ts` now names a region, and `deployment.ts` is the one line that
names it.

What that cost was measured rather than guessed, by decomposing a deployed
response. A request that reaches no Function at all — the [[marketing]] site,
edge-cached under [[adr-0008]] — answered in 0.25s. A Function answering with no
query in it answered in 0.35s, which is the Frankfurt edge and `iad1` talking to
each other. `/api/health` is that same request with exactly one query in it, and
it answered in 0.44s: **one round trip to Postgres cost ~90ms**, and the whole of
that number is distance.

A page of this game is not one round trip. Rendering `/predictions` for a signed-
in fan runs eleven statements — the [[sweep]] at the top of both
`/api/predictions/card` and `/api/predictions/entries`, the [[event]] and its
[[bout]]s, the [[season]] and the [[entry]]s held on it, and the session and
`users` rows read once for `/api/accounts/me` and again for
`/api/predictions/entries` — and each statement costs two round trips rather than
one, because `prepare: false` in `server/db/client.ts` re-Parses every statement
before it can Bind it. Twenty sequential round trips at ~90ms is most of two
seconds, and the page measured **2.44s** deployed against **0.03s** on a laptop.

That gap is the reason this is worth a record. Every one of those round trips is
free on a developer's machine, where Postgres is a container on the same host, so
the whole fault is invisible in every local run and in every test in this
repository — `pnpm test` would go on passing at any distance. And the pages it
hits are exactly the pages [[adr-0008]] exempts from the edge cache: the
marketing site never showed a symptom, because it never reaches the Function at
all. "Fast locally, slow deployed, and only on the game" is what one wrong
default looks like from the outside.

**The region tracks the database, not the fans.** Fans reach an edge either way,
and what a page costs is decided behind that edge by the twenty round trips. A
Function beside its database pays about a millisecond for each of them. Moving
the database is therefore a change to `deployment.ts` in the same commit, and
`.github/workflows/deploy.yml` measures the distance on every run so the two
cannot drift apart quietly: `/api/health` minus a route that runs no query is one
round trip with the runner's own distance cancelled out, and a deploy is refused
above 25ms.

The three inefficiencies the decomposition turned up are left alone deliberately.
`prepare: false` is [[adr-0010]]'s neighbour and is there so a transaction-mode
pooler cannot reject a session-level prepared statement; reading the session
twice is what `useRequestFetch` costs for the correctness `useFan` documents; and
the sweep running on both routes is [[adr-0009]] having nowhere to schedule it.
Each doubles or trebles a number that is about to be measured in milliseconds,
and none of them is what made a page take two seconds. Distance was. If a page
of the game is ever slow again with the Function in the right place, these three
are where to look, and the round-trip count is the thing to measure.

**All three were picked up in [[adr-0023]], so the paragraph above is history
rather than description**, and so is the sentence further up that says each
statement costs two round trips because of `prepare: false`. What still holds is
everything about the region, the distance and what it cost. A signed-in
`/predictions` render now makes seven statements and about seven round trips,
and the round-trip count is still the thing to measure —
`test/server/round-trips.test.ts` is what measures it.
