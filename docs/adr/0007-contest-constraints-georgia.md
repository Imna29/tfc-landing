---
status: accepted
---

# Prizes are a manually fulfilled contest under Georgian rules, not a product feature

TFC operates from Georgia (the country). Prizes for top Season finishers are described on a
Prismic-authored rules page and awarded **by hand, offline, by TFC staff**. The application
itself has no notion of a prize: no claiming, no shipping details, no prize state machine.

The published constraints are: 18+ only, one account per person, a verified email address
required before a first Entry, and prizes that are non-transferable and never exchangeable
for cash. Coins are never purchasable, transferable or redeemable — the moment any of those
becomes true, this is a different product in a different legal category.

## Consequences

- `date_of_birth` is stored (never a derived age, which rots) because it is the only
  evidence of the 18+ gate. See [[adr-0003]] for the same audit-trail reasoning applied to
  Coins.
- "One account per person" is enforced only by email verification. It is a published rule
  and a speed bump, not a technical guarantee, and a determined user can defeat it.
- The rules page, `/terms-of-service` and `/privacy-policy` all need review by counsel in
  Georgia before the first prize is awarded. The existing legal pages describe a brochure
  site, not a service holding dates of birth and running a contest.
