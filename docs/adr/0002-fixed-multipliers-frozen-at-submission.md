---
status: accepted
---

# Multipliers are fixed by an admin and copied onto the Prediction at submission

An admin sets a Multiplier per Outcome before a Bout opens, and the value in force at
submission is copied onto the Prediction and never recalculated. The alternative was a
pool-based model — compute rewards at settlement from how the committed Coins actually
split across Outcomes — which is self-balancing and needs no human pricer, but leaves the
user not knowing what they stand to win at the moment they commit, and makes Chained
Entries very hard to explain or compute.

Since chaining is a headline feature and the emotional payload of the product is "commit 20
to win 240", legibility beat self-balancing.

## Consequences

- A mispriced Outcome is exploitable and nothing self-corrects it. Hence the ×100 combined
  Multiplier cap and the ten-Prediction limit: they bound the damage of a pricing mistake
  rather than preventing it.
- Someone at TFC must price every card before it opens. That is an ongoing operational
  commitment, not a one-off setup task.
- A Prediction stores its Multiplier as a value, never a reference to the Outcome's current
  Multiplier.
