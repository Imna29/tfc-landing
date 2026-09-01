---
status: accepted
---

# Every Question is priced and predicted on its own terms

Winner, method of victory and round of victory are three Questions about a Bout. Each Outcome
carries a Multiplier standing for that answer outright, and those Multipliers **never
multiply together**. A Prediction is one answer to one Question, so a fan may predict only
who wins, only how a Bout ends, or only the round it ends in, and each of those is a complete
Prediction. Combining happens by chaining across *different* Bouts, which are genuinely
independent events.

This supersedes [[adr-0004]], which made a Prediction a compound answer — a required winner
plus an optional method and round, multiplied into one number — and priced method and round
*conditionally on the winner the fan picked*.

The conditionality was never real. Method and round Outcomes carry no corner
(`outcomes_answers_its_question`), so there is one Submission price per Bout rather than one
per corner: an admin pricing a card has always been averaging across both fighters and
calling the average a conditional price. The schema cannot express what ADR-0004 claimed, and
the seeded table shows the drift — read as standalone answers, `DEFAULT_MULTIPLIERS` implies
105% across the winner Question and 127% across the method Question. Nobody chose that gap;
it is what happens when two columns quietly mean different things.

The compound shape also forced a fan into an answer they did not have. Somebody confident a
Bout ends by Submission but with no read on which fighter gets it had to name a winner first
and carry its Multiplier whether they wanted the risk or not. Round was worse: a fan with a
view on how long a Bout lasts had to name a winner *and* a method to say so.

## An Entry still holds at most one Prediction per Bout

ADR-0004's title rule survives untouched, and is restated here because it is what makes the
new model safe.

"Fighter A wins" and "the Bout ends by KO" overlap heavily. Multiplying them pays as though a
fan predicted two things when they nearly predicted one — a systematic overpayment fans find
and farm. ADR-0004 bounded that by refusing the second Prediction and folding the extra
answers into the first at a conditional price. This decision dissolves it instead: within a
Bout there is exactly one answer, and across Bouts the events are independent, so nothing
correlated is ever multiplied. The rule is unchanged, and for the first time the game's
arithmetic honours it rather than working around it.

It stays enforced by the `predictions_one_per_bout_in_an_entry` index rather than by
whichever route remembers to ask. A fan who holds two views on one Bout commits two Entries,
which are funded, cancelled and graded separately.

## Rejected: settle each answer independently

The obvious alternative was to let one Entry hold a winner, a method and a round on the same
Bout and grade each on its own. Those three answers are correlated, so they still could not
be multiplied; the Entry's combined Multiplier would have to add them instead.

That turns a Chained Entry from a product into a sum, and the product is the feature.
[[adr-0002]] chose fixed Multipliers over a self-balancing pool precisely because "commit 20
to win 240" is the emotional payload of this product, and ten answers summing to a few times
the Amount is not that. It would dismantle chaining to buy a shape a fan can already have by
committing a second Entry.

## Rejected: price the round unconditionally and keep multiplying it onto a method

The narrower alternative was to keep the compound Prediction, fix only the pricing by making
each Outcome mean its answer outright, and go on multiplying them together.

That is the one genuinely farmable combination. Winner and method are close enough to
independent that multiplying them is roughly honest — who wins says little about how. Method
and round are strongly dependent: a Bout that ends in round 2 is overwhelmingly a Bout that
ended in a finish, so an unconditional round price multiplied onto a method price pays far
more than the pair is worth. Fixing the prices while keeping the multiplication would have
traded an overpayment nobody could measure for one anybody could compute.

## Consequences

- **ADR-0004's validation consequence inverts.** A round Outcome was only selectable
  alongside KO/TKO or Submission; `predictions_a_round_needs_a_finish` has to go, because a
  round Prediction now stands on its own. A round Prediction on a Bout that went to a
  Decision is graded **wrong** rather than refused at submission — going the distance is
  precisely not ending in a round.
- **Every seeded Multiplier has to be re-priced to mean what it says**, including seeding
  rounds differently for a three-round Bout and a five-round Bout, where one table has served
  both. That re-pricing is #30 rather than part of this decision.
- **The operational cost of a card does not change.** It is the same eight to ten numbers per
  Bout, each of which an admin can now reason about on its own rather than as an average
  across two corners.
- **[[adr-0002]] and [[adr-0013]] are untouched.** A Multiplier is still copied onto the
  Prediction at submission and never recalculated, and the combined Multiplier, its ×100 cap
  and the Reward are still worked out from the Predictions wherever one is needed. So is the
  ten-Prediction limit.
- **[[adr-0005]] is unaffected, and reads more directly.** A disqualification settles the
  winner Question and leaves the method and round Questions No Results — which is now a
  statement about which Predictions on that Bout count for nothing, rather than about parts
  of one.
