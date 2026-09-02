---
status: superseded by ADR-0015
---

# Every Question is priced and predicted on its own terms

**Superseded by [[adr-0015]], which keeps the rule in the title and changes what an answer
is about.** Read that record, not this one.

What still holds is most of what this one decided, and [[adr-0015]] carries all of it with
the reasoning that makes it necessary. A Prediction is one answer to one Question carrying
one Multiplier that stands for that answer outright; those Multipliers never multiply within
a Bout, because the three Questions asked about one fight are correlated; combining happens
by chaining across different Bouts, which are independent events; and an Entry holds at most
one Prediction per Bout, held by the `predictions_one_per_bout_in_an_entry` index. Both
alternatives rejected here — settling each answer of an Entry independently, and pricing the
round unconditionally while still multiplying it onto a method — stay rejected, and
[[adr-0015]] carries their reasoning too.

What stopped being true is one claim — that method and round Outcomes carry no corner, and
the argument built on it that per-corner pricing was never expressible because the schema
cannot express what [[adr-0004]] claimed. [[adr-0015]] changes the schema to express it.
Every method and round Outcome names a corner there, so "the Bout ends by KO/TKO, whoever
wins it" is not an answer the game offers, and a corner-scoped answer is *strictly stronger*
than a winner answer rather than merely overlapping it — which is why the
one-Prediction-per-Bout index matters more under 0015 than it did here. This record's
consequence that the operational cost of a card does not change is reversed with it: a Bout
carries fourteen to eighteen priced numbers rather than eight to ten.

Nothing else moves. A round Prediction still needs no finish named beside it, and a round
Prediction on a Bout that went to a Decision is still graded wrong rather than refused at
submission. [[adr-0002]], [[adr-0005]] and [[adr-0013]] are as this record left them.

Citations to this record in the schema, the shared modules and the components are left
pointing here, and what they describe is what is still shipped until the change [[adr-0015]]
decides has landed.
