---
status: accepted
---

# Admin is a role on the user, enforced over a prefix, and granted only in SQL

There is no separate admin application. The capabilities that run the game — pricing a card,
opening and locking Bouts, entering results, running Seasons — are pages and endpoints of the
same app, at `/admin` and under `/api/admin`, deliberately plain and without a design pass.
Only the live lock console gets one, because it is the only screen used cageside on a phone
([[adr-0006]]).

Three decisions hold that area shut.

**The role is a column, not part of the identity layer.** `users.role` is `fan` or `admin`,
defaulting to `fan`, and `better-auth` is not told it exists. That is what makes it
ungrantable: its `additionalFields` are client-writable at sign-up unless declared otherwise,
so a role it knew about would make `{"role":"admin"}` in a sign-up body a question worth
asking. It cannot read or write a column it has never heard of.

**The guard is the prefix, not the route.** A Nitro middleware refuses everything under those
two prefixes before any handler runs. The alternative — every admin handler remembering to
check — fails open exactly once: a missing role check on a single route is enough to let a fan
price their own Multipliers, and nothing in a test suite or a review reliably notices a check
that is absent. Handlers still call `requireAdmin`, but for the admin's name, which lock and
result records have to carry, not to be let in.

**The role is read from the row on every request**, never carried on the session, so taking it
away takes effect on the next request rather than whenever that browser next signs in.

## Consequences

- Granting the role is a hand-run `update` against the database, documented in the README.
  There is no route, form or script that does it, and adding one would undo the first decision
  above. A `users_role_known` check constraint refuses every spelling but `fan` and `admin`, so
  a typo in that `update` fails loudly instead of leaving an account that looks granted.
- The guard matches on the path, so it inherits the routers' looseness: Vue Router matches
  case-insensitively, and `%61dmin` is another spelling of the same request.
  `server/utils/adminArea.ts` normalises both, and has unit tests of its own, because a path the
  guard fails to recognise is a path served with no role check at all.
- The two prefixes are exempted from the edge cache in `route-rules.ts` ([[adr-0008]]), `/admin`
  by name and `/api/admin` through the `/api` section. Both lists have to stay in step, so
  `test/unit/route-rules.test.ts` asserts that every prefix this guard covers is in fact exempt.
  What makes that assertion mean anything is [[adr-0012]]: one spelling per URL, so the set of
  paths served and the set exempted are the same set.
- An admin is a fan with a role — same account, same Balance, same ability to play. Nothing
  stops an admin submitting Entries on a card they priced; that is a conflict of interest
  handled by who is given the role, not by the schema.
