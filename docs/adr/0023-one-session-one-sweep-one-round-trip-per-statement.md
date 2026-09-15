---
status: accepted
---

# One session, one sweep, and one round trip per statement

[[adr-0022]] moved the Function to the region its database is in and left three
inefficiencies alone on purpose, because none of them was why a page took two
seconds — distance was. With the Function beside its database each round trip
costs about a millisecond instead of ninety, and these three are what a
[[playtfc]] page costs now. This is the record of picking them up.

All three numbers here were measured rather than counted, with a TCP proxy in
front of Postgres that holds every question for a fixed moment:
`test/helpers/latency.ts`. The count of round trips is the slope of what a
request costs against how far away Postgres is, and the count of statements is
read off the wire beside it. Counting `await`s in the handlers would have got
two of the three wrong.

A signed-in `/predictions` render made **ten statements and just over twenty
round trips**. It now makes **seven statements and about seven round trips**.

Ten rather than the eleven [[adr-0022]] names, because that eleven was counted
off the code and this ten is read off the wire, on a card of two Bouts with one
[[entry]] committed. The round trips are what either record's arithmetic was
about, and those measured as the twenty both of them name.

Two decisions rather than one, because the ticket that produced them found both
and neither depends on the other: what the deployment connects through, and
what a request may work out once. Either could be taken back without the other.

## Production connects to Postgres directly, so statements are prepared

`prepare: false` stood in `server/db/client.ts` so that a transaction-mode
pooler could not reject a session-level prepared statement, at a time when
nothing had decided what the deployment would connect through. It is decided:
**production connects direct, on 5432**. That is one session for as long as the
process holds the connection, which is what a prepared statement needs, so the
setting is gone.

Removing it changed nothing on its own, which is the part worth writing down.
Drizzle passes `prepare: false` of its own on every query that was not given a
name with `.prepare("…")`, and `postgres` takes the connection's setting and the
query's together — so the connection's setting decided nothing, and a render
still paid two round trips for each of its seven statements. What makes the
decision real is `prepareEveryStatement` in `server/db/client.ts`, four lines
that ask the driver's own `unsafe` to prepare regardless. Seven statements then
cost seven round trips rather than fourteen.

**Moving to a pooled connection string means putting `prepare: false` back, in
the same commit as the change to the environment secret.** A transaction-mode
pooler hands a request whichever backend is free, and a statement prepared
against one is not there on the next. Statements inside a transaction are left
unprepared and still cost two: `postgres` builds a transaction its own handle
and that one is not patched. Those are the writes — an Entry submitted, a Bout
settled — rather than the reads a page is made of.

## A request works each thing out once, and nothing outlives the request

Rendering a page is not one request. `/predictions` renders by calling
`/api/accounts/me` and `/api/predictions/entries`, each a request of its own
made inside the render's and carrying the render's cookie. So the session was
read twice — a `sessions` row and a `users` row each time — and the [[sweep]]
ran twice, because both `/api/predictions/card` and `/api/predictions/entries`
are among the requests that have to run it ([[adr-0009]] leaves nowhere to
schedule it). Neither second answer could have differed from the first.

`server/utils/perRequest.ts` is the handle a request carries its own answers on,
and `server/plugins/perRequest.ts` opens exactly one scope per request — at the
outermost one, so that the internal calls join it rather than starting scopes of
their own. It wraps Nitro's own handler, which is the shape Nitro uses on itself
for `experimental.asyncContext`; a middleware could not do it, because a
middleware runs and returns and the rest of the request happens after it.

Two rules hold it up:

- **The cookie is part of the question.** An answer about who is signed in is an
  answer about whoever the cookie names. Internal calls carry the render's
  cookie, which is what makes sharing right; a call made with a different cookie
  or none is a different question and is asked. Without that, a render whose
  first internal call went out unsigned would answer "nobody is signed in" for
  the rest of the page.
- **Within a request, never across.** The role is read from the `users` row on
  every request so that revoking an admin takes effect on the next request
  rather than the next sign-in ([[adr-0011]]), and a scope that outlived a
  request would quietly turn that into the second. It is also the whole of the
  safety argument: an answer about one [[fan]] cannot reach another, because the
  only thing that can reach it is the request that asked.

Both routes still call the sweep exactly as they did, and every route still asks
for the session exactly as it did. What changed is how many of those asks reach
Postgres.

## What this is held to

`test/server/round-trips.test.ts` renders a signed-in `/predictions` through the
proxy and asserts two things: that the page asks Postgres no more than eight
times, and that a statement costs about one round trip rather than two. It also
asserts the saving directly — the three routes a render calls, measured on their
own, sum to three statements more than the render does, and those three are the
session read a second time and the sweep run a second time.

It is a budget rather than a benchmark. This is the one class of regression the
rest of the suite cannot see, for [[adr-0022]]'s reason: every round trip is
free on a developer's machine, so a page that starts asking twice as often again
would go on passing everything else.
