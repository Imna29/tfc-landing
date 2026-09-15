---
status: superseded by ADR-0014
---

# An Entry holds at most one Prediction per Bout

**Superseded by [[adr-0014]], which restates the rule in the title and replaces everything
under it.** The rule itself still holds — an Entry may contain only one Prediction per Bout,
and chaining happens *across* Bouts — and ADR-0014 carries it together with the correlation
argument that makes it necessary. Read that record, not this one.

What this record decided beyond the title is no longer true. A Prediction was a single
**compound** answer for one Bout — a required winner plus an optional method and an optional
round, whose Multipliers multiplied into one number — so adding a method and a round deepened
a Prediction rather than lengthening the chain, and an admin priced those two Questions
*conditionally on the winner the fan picked*.

That conditional pricing was never real: method and round Outcomes carry no corner, so there
has only ever been one Submission price per Bout rather than one per fighter. ADR-0014 gives
each Question a standalone Multiplier, stops the three multiplying together, and lets a fan
answer any one of them on its own. It also inverts this record's surviving consequence — a
round Prediction no longer needs a finish named beside it, and a round Prediction on a Bout
that went to a Decision is graded wrong rather than refused at submission.

The alternative rejected here, pricing every full combination by hand (2 winners × 3 methods
× up to 5 rounds is 30+ numbers per Bout, which nobody will maintain before every card), is
moot under ADR-0014: there are no combinations to price, only answers.
