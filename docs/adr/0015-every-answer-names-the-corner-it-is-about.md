---
status: accepted
---

# Every answer names the corner it is about

The winner Question names a fighter. The method and round Questions do not: under
[[adr-0014]] "KO/TKO" means the Bout ends that way whoever wins it, and "Round 2" means it
ends in round 2 whoever wins it. Both are answers about the Bout, and nothing a fan reads
says so. Beside a Winner column listing two fighters by name, "Method of victory: KO/TKO"
reads as a method of victory *for one of them* — the words "of victory" presuppose a victor
the answer never names. Committed it is worse: the Prediction reads back as
`Bout 3 — Round 2`, with no fighter in it at all.

So every Outcome and every Prediction names a **corner**. The method and round Questions
stop being asked of the Bout and start being asked of a fighter — "Fighter A by KO/TKO",
"Fighter A in round 2" — and `corner` is `not null` on both tables, so an answer naming none
is refused by Postgres rather than by whichever route remembers to ask. `QUESTION_LABELS`
needs no change: "Method of victory" was always describing a victory, and the answers simply
never named the victor.

Nullability is not the whole of the schema change. Both `…_answers_its_question` checks
collapse to the same shape — a corner always, plus exactly one of `method` and `round`,
decided by the Question — and the three `outcomes_one_per_*` unique indexes, which keep one
Outcome per answer today by NULL-distinctness, have to become corner-inclusive or they
collide the moment every row carries a corner. The composite foreign keys behind
`predictions_method_is_offered` and `predictions_round_is_offered` widen with them, which is
what keeps "round 4 of a three-round Bout" a refusal from Postgres rather than only from a
route.

## What this supersedes in ADR-0014, and what it does not

This supersedes [[adr-0014]], which made every method and round answer a statement about the
Bout rather than about a fighter, and rested that on one argument: method and round Outcomes
carry no corner, so there is one Submission price per Bout rather than one per fighter, and
an admin pricing a card has always been averaging across both fighters and calling the
average a conditional price. It concluded that the schema cannot express what [[adr-0004]]
claimed. That is the one claim reversed here: the schema is changed to express it.

Expressing it is not reinstating it. ADR-0004 priced a method *conditionally on the winner
the fan picked* and multiplied the two Multipliers into one number, and that shape stays
rejected for the reason ADR-0014 gave. A corner-scoped Outcome is a standalone answer that
happens to name a fighter, priced on its own and graded on its own. It is what the
conditional price was always reaching for: what "Fighter A by Submission" is worth is not
what "Fighter B by Submission" is worth, and one number for both was an average of two
answers an admin never got to tell apart.

The judgement being reversed is #29's own. It weighed per-corner pricing and rejected it —
"it multiplies what an admin prices per Bout without buying anything the standalone model
does not already give" — and what it buys is the thing that judgement did not weigh: an
answer a fan can read without being told separately what it means. Reversed here on the
record rather than quietly.

## What survives, and why it is restated here

Nothing about how the game combines answers changes. It is restated rather than left in a
superseded record, because a stronger kind of answer is arriving under rules written for a
weaker one.

**A Prediction is one answer to one Question, carrying one Multiplier.** A fan with a read
on only one of the three says only that, and it is a whole Prediction. A method answer is
not a decoration on a winner answer, and naming a corner does not make it one.

**Multipliers never multiply within a Bout.** The three Questions asked about one Bout are
questions about the same fight, and multiplying correlated answers pays a fan as though they
predicted two things when they nearly predicted one. Combining happens by chaining across
*different* Bouts, which are genuinely independent events, so nothing correlated is ever
multiplied.

**An Entry holds at most one Prediction per Bout.** ADR-0004's title rule, carried through
ADR-0014 and carried again here, held by the `predictions_one_per_bout_in_an_entry` index
rather than by whichever route remembers to ask. A fan holding two views on one Bout commits
two Entries, which are funded, cancelled and graded separately.

## What stays rejected

ADR-0014's two rejected alternatives are rejected here for the same reasons, written down
again so that neither is left documented only in a superseded record.

**Settling each answer of an Entry independently** — one Entry holding a winner, a method
and a round on the same Bout, each graded on its own — still dismantles chaining. Those
answers are correlated, so they still could not be multiplied, and the Entry's combined
Multiplier would have to add them instead. [[adr-0002]] chose fixed Multipliers over a
self-balancing pool precisely because "commit 20 to win 240" is the emotional payload of
this product, and ten answers summing to a few times the Amount is not that. Naming a corner
makes the correlation total rather than merely heavy, which strengthens that argument rather
than weakening it.

**Pricing the round unconditionally and multiplying it onto a method** is still the one
genuinely farmable combination. Winner and method are close enough to independent that
multiplying them is roughly honest — who wins says little about how. Method and round are
strongly dependent: a Bout that ends in round 2 is overwhelmingly a Bout that ended in a
finish. Under this decision the two answers share a corner as well, so they are more
dependent than they were, not less.

## A corner-scoped answer is strictly stronger, and the index is what makes it safe

"Fighter A by Decision" says everything "Fighter A wins" says, and more. That is why it pays
more, and it is why the two can never be held in one Entry: multiplying them would pay a fan
for two answers when they gave nearly one. The overlap ADR-0014 described between "Fighter A
wins" and "the Bout ends by KO" was heavy. Under this decision it is total — the winner
answer is contained in the method answer, and in the round answer.

`predictions_one_per_bout_in_an_entry` is the whole of what stands between the game and
that. ADR-0014 anticipated the rule mattering and did not need it to carry this much: a
corner-free method answer overlapped a winner answer without containing it, so a fan
combining the two was farming a rough price rather than being paid twice for one sentence.
The index is load-bearing now, and nothing in this change touches it.

## Rejected: offering the corner-free answers beside the corner-scoped ones

The gentler change was to keep "KO/TKO" and add "Fighter A by KO/TKO" beside it, so that the
fan who reads a finish without a read on the finisher keeps their Question.

Two shapes for one Question is a consistency an admin has to maintain by hand. "The Bout
ends by Submission" is the chance either fighter submits the other, so every corner-free
Multiplier has to stay arithmetically in step with the pair beneath it — the *chance* it
implies being the two corner chances added, which is emphatically not the two Multipliers
added — across up to twenty-six numbers per Bout, before every card, forever. Nothing can
check it for them: these are prices rather than chances, and the margin an admin is entitled
to charge is the thing a check would have to know before it could call a difference an
error.

Where it drifts, the difference is not a rounding error somebody tidies up later. It is
committable — the corner-free answer in one Entry and the two corner answers in two others,
all three funded separately and all three settled. [[adr-0013]]'s cap bounds what that pays,
and bounding the damage of a farmable price is not the same as not offering one.

## Rejected: saying it in copy and leaving the model alone

The cheap fix was to relabel — "Ends by KO/TKO (either fighter)", "Ends in round 2 (either
fighter)". One commit, no schema, no re-pricing, and the answer becomes readable, which is
the defect that opened this.

What it leaves in place is the thing that made the answer hard to read. One price for
"either fighter submits the other" is one price for two claims: an admin pricing a card
where one fighter is a submission specialist and the other has never attempted one is still
averaging across the matchup. A label saying "either fighter" tells a fan what the average
means; it does not make the average a number worth answering. Pricing every card by hand is
[[adr-0002]]'s standing bill, and the moment to buy the admin a per-corner price is the
moment the answer is being rewritten anyway.

## Consequences

- **The fan ADR-0014 was built for loses their Question.** Somebody confident a Bout ends by
  Submission, with no read on which fighter gets it, had exactly one thing to say under
  ADR-0014 and has nothing to say now — every answer left asks them for a fighter they have
  no view on. That fan is real, and this trades their Question away for an answer every
  other fan can read without decoding.
- **ADR-0014's operational consequence is reversed.** It said the cost of a card does not
  change: "the same eight to ten numbers per Bout". A Bout now carries **fourteen** Outcomes
  on a three-round Bout and **eighteen** on a five-round one — two winners, six methods, and
  two per scheduled round. Pricing a card is close to twice the work it was, and the admin
  pricing screen has to hold that many inputs legibly.
- **The seeded method and round Multipliers roughly double, and correcting them back is the
  expensive mistake.** Nothing that seeds a Bout knows which fighter is favoured, which is
  already why both winner Outcomes seed level. Applying that rule to method and round splits
  a Bout-level chance evenly between the corners, and half the chance is twice the
  Multiplier. Every implied total the seeded table was chosen for is preserved exactly; what
  changes is the number of answers it is spread across.
- **Grading gains one rule, in one place.** A method or round Prediction is correct only
  when its corner also matches the recorded winner. A round answer naming the fighter who
  lost is wrong even where the Bout did end in the round it named.
- **[[adr-0005]] is unaffected.** A disqualification still settles the winner Question — a
  fighter who won by any means is a fighter a fan called correctly — and still leaves the
  method and round Questions No Results, because "won by DQ" is not one of the answers
  offered. Naming a corner does not change that: a method Prediction on a disqualified Bout
  counts for nothing whichever corner it named.
- **ADR-0014's round consequence stands.** A round Prediction needs no finish named beside
  it, and a round Prediction on a Bout that went to a Decision is graded wrong rather than
  refused at submission — going the distance is precisely not ending in a round.
- **[[adr-0002]] and [[adr-0013]] are untouched.** A Multiplier is still copied onto the
  Prediction at submission and never recalculated, and the combined Multiplier, its ×100 cap
  and the Reward are still worked out from the Predictions wherever one is needed. So is the
  ten-Prediction limit.
- **The chain is 0004 → 0014 → 0015.** [[adr-0004]] is left as it is, pointing at ADR-0014,
  and citations elsewhere are left pointing where they point: following one lands on the
  note that says the decision moved.
