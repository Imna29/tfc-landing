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
- **The admin area answers to one spelling of each URL and 404s the rest.** Nitro's route rules
  are case-sensitive where Vue Router is not, so `/ADMIN` renders the admin page while missing
  the rule that exempts `/admin` from the edge cache — it falls to the marketing catch-all and
  one admin's page is stored and served to whoever asks next, which is exactly the silent leak
  [[adr-0008]] exists to prevent. Refusing the second spelling is what keeps the exemption list
  and the served paths the same set; `test/unit/route-rules.test.ts` asserts that every guarded
  prefix is in fact exempt. The same gap is open on `/profile` and the other authenticated
  sections, and closing it there is not this decision's to make.
- An admin URL therefore has to be writable without escaping — true of every Prismic uid and
  every uuid a later ticket will put in one.
- An admin is a fan with a role — same account, same Balance, same ability to play. Nothing
  stops an admin submitting Entries on a card they priced; that is a conflict of interest
  handled by who is given the role, not by the schema.
