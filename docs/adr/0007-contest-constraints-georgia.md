---
status: superseded by ADR-0018
---

# Prizes are a manually fulfilled contest under Georgian rules, not a product feature

**Superseded by [[adr-0018]], which removes Prizes from TFC Predictions entirely.** Read that
record, not this one. Nothing in this record describes what the application does now.

One paragraph of it still holds, and ADR-0018 restates it: **Coins are never purchasable,
transferable or redeemable, and have no real-money value. The moment any of those becomes
true, this is a different product in a different legal category.** That was the load-bearing
sentence here and it survives the decision that replaced everything around it.

Everything else this record decided has stopped being true. There are no Prizes, awarded by
hand or otherwise, so there is no contest for constraints to be the terms of. The four
published constraints are dealt with one at a time in ADR-0018: the 18+ gate and the
confirmed-email requirement are retired, one-account-per-person is re-founded on a unique
phone number instead of on email verification, and the prize terms are moot.

Its consequences have gone with it. `date_of_birth` is no longer stored, and neither are the
real names that were held so a Prize could reach a person — ADR-0018's migration drops all
three columns. What remains live is the last one, in weaker form: the legal pages still
describe a brochure site rather than a service holding personal data, and still need review.

`docs/research/prize-games-georgia-legal.md` is the research this record was written from. It
is kept, and is where a later ticket that reopens any of this should start.
