---
status: accepted
---

# The round of victory is not a Question the game asks

The game asked three Questions about a Bout: the winner, the method of victory, and the
round of victory. It asks two. Every round Outcome, every round Prediction and the round an
admin recorded on a [[result]] are gone, and a Bout offers **eight** answers — two winner
Outcomes and six method Outcomes — whatever format it is booked in.

This is a decision about what the product is, taken above the model rather than inside it,
and the reasoning below is what the model looks like once it lands rather than the argument
that it should.

## What the round Question cost

**It is the answer a fan has least to go on.** Who wins is a read on two fighters. How they
win is a read on two styles. Which of three or five rounds it ends in is those two reads
plus a guess, and the seeded table said so: the round answers carried the game's largest
Multipliers, up to ×28.50 for the deepest round of a five-rounder. A fan is most likely to
be wrong exactly where the number in front of them is most exciting, and that is the shape
of a Question worth removing rather than one worth keeping.

**It is the number hardest to price and the most expensive to get wrong.** [[adr-0002]]
makes an admin set every Multiplier by hand before every card, forever, and [[adr-0015]]
doubled that bill by giving each answer a fighter. Ten of the fourteen numbers on a
three-round Bout were round answers, eighteen of a five-rounder's. They were also the ones
nobody could check: what a KO/TKO by a named fighter is worth is arguable, and what round 4
of a five-round Bout is worth by a named fighter is a number an admin can only accept.
[[adr-0013]]'s cap bounds what a mispriced Outcome pays out; it does not make the number
easier to choose.

**It was the one thing about the game that varied by format.** A Bout offered a different
number of answers depending on how long it was booked for, so the seeded table needed a row
per format and a fallback for the formats TFC does not book,
`defaultOutcomes` and `inAskedOrder` needed the scheduled rounds passed in, and the public
card, the admin pricing screen and the key holding an answer to the card all had to know
that a three-round Bout has no round 4. All of it existed for one Question.

**It carried the least explicable pair of gradings in the game.** A round Prediction on a
Bout that went to a Decision is *wrong*, because going the distance is precisely not ending
in the round the fan named. The same Prediction on a disqualification is a **No Result**,
because "won by DQ" was never an answer the game offered ([[adr-0005]]). Two Bouts that both
ended with no round recorded, settling opposite ways. That is defensible and it was
defended, in [[adr-0014]] and again in [[adr-0015]]; it is also the hardest sentence in this
product to say to somebody who has just read it happen to them.

## A Result records what the game asked about

The round on a [[result]] goes too, and it is worth saying why that is not a separate
decision. It was there to grade round answers and for nothing else: the
`bout_results_round_was_offered` key pointed at the round Outcomes themselves,
`bout_results_a_round_is_a_finish` existed to keep it beside a KO/TKO or a Submission, and
the sentence refusing a finish with no round said, in as many words, that fans predicted it.

Keeping it would leave an admin at cageside entering a number nothing reads, on the most
consequential form in the product, on a phone, in the dark. A Result is what the game grades
against, and the game does not grade against the round.

What stays is `bouts.scheduled_rounds`. How long a fight is booked for is a fact about the
fight — a fan reads it on the card beside the weight class — and it is now a fact nothing
prices and nothing is graded against.

## What this changes in ADR-0015, which otherwise stands

[[adr-0015]] is not superseded. Its rule holds exactly as written for both remaining
Questions: every Outcome and every Prediction names the [[corner]] it is about, `corner` is
`not null` on both tables, and the grading rule it added — a method answer is correct only
when its corner also matches the recorded winner — is untouched. So are
`predictions_one_per_bout_in_an_entry` and the argument that makes it load-bearing: "Fighter
A by Decision" still says everything "Fighter A wins" says and more.

Three things in that record stop being true, and a reader arriving from a citation should
know which:

- **The count.** A Bout carries eight Outcomes, not "fourteen on a three-round Bout and
  eighteen on a five-round one". Pricing a card is roughly what it was before ADR-0015
  rather than close to twice it.
- **The round examples.** "Fighter A in round 2" is not an answer the game offers, so every
  sentence in ADR-0015 built on one describes a Question that no longer exists.
- **Its round consequence, and ADR-0014's before it.** "A round Prediction needs no finish
  named beside it, and one on a Bout that went to a Decision is graded wrong rather than
  refused at submission" is now about nothing.

Everything else those two records decided is live. [[adr-0002]], [[adr-0005]] and
[[adr-0013]] are untouched: a Multiplier is still copied onto a Prediction at submission and
never recalculated, a disqualification still settles the winner Question while leaving the
method Question a No Result, and the combined Multiplier, its ×100 cap and the Reward are
still worked out from the Predictions wherever one is needed.

## Rejected: keeping the Question and not offering it

The smallest change was to stop rendering the round answers on the card and leave everything
else where it was. No migration, no re-pricing, and the Question could come back.

It leaves the schema claiming something the product does not do, and every one of its rules
still has to be maintained: the constraints, the composite key, the format-dependent seeded
row, the two gradings that settle opposite ways. An admin would still be asked to price ten
to eighteen Outcomes per Bout that no fan can reach, because a Bout with one unpriced
Outcome cannot be opened — so the alternative is either that bill, unpaid for nothing, or a
second rule about which Outcomes count. Code kept for a Question nobody asks is code nobody
maintains and nobody deletes.

## Rejected: keeping the round on a Result as a record of fact

The round a fight ended in is true whether or not anybody predicted it, and recording it
costs one integer.

It costs more than that. It is an input on the result form — the control that grades every
Entry on a Bout and moves the Coins — filled in by somebody watching a fight who has one
thing to do and should be doing it quickly. It is a validation with two rules and three
refusal sentences behind it. And it is a column the application would read nowhere, which is
the definition of a field that quietly becomes wrong: nothing would notice a card entered
with every round left blank, because nothing asks. If TFC wants a record of what happened in
its fights, that is a fight record and belongs where the fighter documents do, not in the
table settlement grades against.

## Rejected: asking the round about the Bout again

Making the round Question about the fight rather than about a fighter — "ends in round 2,
whoever wins" — would halve its answers and roughly halve the pricing bill, and would make
the deepest Multiplier less extreme.

That is [[adr-0015]] reversed for one Question, and reversed for the Question it was most
clearly right about: `Bout 3 — Round 2` was the unreadable Prediction that opened the whole
argument. It also does nothing about the two gradings that settle opposite ways, or about a
Bout offering a different number of answers depending on its format. It buys a cheaper
version of the thing being removed.

## Consequences

- **The database is wiped rather than migrated.** The migration drops the four `round`
  columns and stops on a database holding any round row: `outcomes_question_known` refuses
  `question = 'round'`, and a round Prediction is an answer a fan committed Coins to, with no
  honest thing to convert it into. The project is pre-launch, which is what makes that the
  cheap answer rather than the reckless one. The same call as
  `20260902203757_a_corner_on_every_answer`.
- **One trigger function has to be replaced by hand.**
  `refuse_a_correction_nobody_recorded` matches a superseded Result against the correction
  log field by field, and the round was one of those fields. A function body is not a
  dependency Postgres tracks, so nothing drops it with the column and every correction fails
  at runtime until it is rewritten. The migration does it, at the end.
- **Pricing a card is eight numbers per Bout.** Down from fourteen to eighteen, and no
  longer dependent on the format. `DEFAULT_MULTIPLIERS` loses the only row that had to know
  whether a Bout was booked over three rounds or five.
- **Three signatures lose an argument each.** `defaultOutcomes` and `inAskedOrder` no longer
  need the scheduled rounds, and `parseEnding` no longer needs the Bout — it took one to
  refuse a round the Bout was never booked over, and that is the whole of what it took one
  for.
- **A fan with a card open from before this lands is refused rather than mis-committed.**
  `isQuestion` no longer answers to `round`, so an Entry carrying a round answer is
  unreadable and is refused whole. Dropping the answer and committing the rest would hand a
  fan a chain they never read a Reward for.
- **A Chained Entry gets shorter reach on one card.** An Entry holds at most one Prediction
  per Bout, so the longest chain a fan can build on an eight-Bout card is eight Predictions
  either way — but a fan who used to hold two views on one fight by committing a winner in
  one Entry and a round in another now has one fewer thing to say about it. That is the
  Question being removed, felt where it is felt.
