---
status: accepted
---

# What a Bout offers is decided by the discipline it is fought in

TFC books three formats and puts them on one card. A **[[discipline]]** is now a fact carried
by every [[bout]], read out of Prismic at [[import]], and it is the one fact about a fight
that changes what the game asks about it.

- **MMA** is asked both [[question]]s. Eight [[outcome]]s: two winner, six method.
- **CageBox** is asked both, with a narrower method. Six Outcomes: a CageBox Bout is boxing,
  and a Submission is not an ending it has.
- **Cage Grappling** is asked the winner Question alone. Two Outcomes, no method of victory,
  and a [[result]] on one records a winner and nothing else.

Everything else about the game is untouched. Every answer still names the [[corner]] it is
about ([[adr-0015]]), every Question is still priced and predicted on its own terms
([[adr-0014]]), and how long a Bout is booked for still decides nothing ([[adr-0016]]).

## Why this is not the format rule coming back

[[adr-0016]] removed the last thing that made a Bout's offering depend on how it was booked,
and named it as a cost worth being rid of: "a Bout offered a different number of answers
depending on how long it was booked for". This record reintroduces a Bout offering different
numbers of answers. It is worth saying plainly why that is not the same mistake.

The scheduled rounds are a fact about **one booking**. Three rounds or five is a matter of
where a fight sits on a card, it changes nothing about what can happen in the cage, and the
answers it added — round 4, round 5 — were answers about the same sport asked of a longer
fight. The Question was askable of every Bout and the format only decided how many ways there
were to answer it.

A discipline is **what is being fought**. A Submission cannot happen in a CageBox Bout: it is
not a long shot, it is not an answer a fan would be unwise to give, it is an ending that does
not exist. Offering it would be offering an answer that is wrong by the rules of the sport
before either fighter walks out — priced, chainable, and impossible. And a Cage Grappling
Bout has no method of victory the game separates from winning at all: asking "how did they
win?" of a submission grappling match is asking a question with one answer.

So the two look alike in the schema and are opposites in the domain. One made the game's
offering depend on a scheduling decision; this makes it depend on what the fight is.

## A Result records what the game asked about

[[adr-0016]] took the round off a Result with that sentence, and it decides the method here
too. A Cage Grappling Bout is settled on its winner, and its Result records no method — not
a fourth method value meaning "none", and not a method quietly recorded and never read.

This costs one thing worth naming: a Cage Grappling Bout that ends in a disqualification is
recorded as a win for the fighter who was awarded it, and the DQ is not written down. That
is deliberate. A DQ is recorded on an MMA or CageBox Bout for exactly one reason — it turns
the method Question into a [[no-result]] ([[adr-0005]]) — and where there is no method
Question there is nothing for it to do. Recording it anyway would be the round again: a
field on the highest-consequence form in the product, filled in by somebody watching a
fight, that the application reads nowhere.

What follows in the schema is that `bout_results_is_a_result_or_no_result` is told apart by
the **winner alone**. It used to say a row names a winner *and a method*, or the reason there
is neither.

## The uid is the identifier, the name is display text

A Bout points at a `discipline` document in Prismic, and the game recognises it by that
document's **uid** — `mma`, `cagebox`, `cage-grappling`. The name an editor typed is what
they pick it by in the CMS and is not read by anything.

The discipline is a **closed set**, unlike the division beside it on the same row. A division
is text a card shows; a discipline decides what a Bout is priced and graded on, so one the
game does not recognise is not a Bout it can run. An import carrying an unknown discipline is
refused whole, naming the uids the game answers to — the same shape as every other thing the
import refuses ([[adr-0001]]), and refused while the fix is still an edit in a CMS.

Keying on the name instead was rejected: renaming a document is a thing editors do, "CageBox"
becoming "Cage Box" one afternoon is a reasonable edit to make, and a rename that silently
stopped a card importing would send somebody hunting through the wrong file.

## A narrowed Question is worth what it was worth

CageBox's seeded [[multiplier]]s are not MMA's with the Submission row deleted. Taking an
answer away does not make a Question easier to be right about — it makes the answers that
remain likelier — so the Submission's share of the chance is shared out between KO/TKO and
Decision in proportion to what the table already said about the pair. KO/TKO seeds at 3.39
and Decision at 4.09, and the method Question still implies about 108% across both corners,
the same as an MMA Bout's.

Simply dropping the row would have priced a two-answer Question at a three-answer Question's
margin: about 83% implied, which is the game returning more Coins on that Question than fans
commit to it, on every CageBox Bout on every card. That is not a rounding error, and nothing
in the product would have reported it — a seeded number is not a price ([[adr-0002]]), so an
admin correcting the two numbers in front of them would have had no reason to notice the
third was missing from the arithmetic.

The seeded table is therefore also **where a discipline's methods are written down**: a
method with no number in it is one that discipline is not asked. That is not a shortcut. A
Bout with one unpriced Outcome cannot be opened ([[adr-0002]]), so an answer nobody could
price is an answer no fan could ever be offered, and a list kept beside the table could only
ever disagree with it.

There is exactly one such list, and it is deliberate: the SQL `CASE` inside
`a_result_records_the_method_its_discipline_asks`. A trigger cannot call `methodsAsked`, and
a constraint assembled from a lookup is only as true as whatever last wrote the lookup — the
same reasoning `outcomes_question_known` spells its Questions out under. What keeps that copy
honest is a test rather than a comment: "holds the trigger's own list of endings to the one
the game asks" puts every discipline against every ending the game knows, both ways round, so
the two cannot drift apart without a run going red.

## Rejected: a Question narrowed rather than dropped

Cage Grappling could have kept the method Question with one answer on it — "wins by
submission" — or with the winner's own name as the only method.

A Question with one answer is not a Question. It would be priced, offered and chained like a
second answer while saying nothing the winner answer does not already say, which is exactly
what `predictions_one_per_bout_in_an_entry` exists to stop ([[adr-0015]]): a fan would be
paid twice for one read. And an admin at cageside would be asked to choose from a list of
one, on the form that moves the Coins.

## Rejected: the discipline on the Event rather than the Bout

One card, one discipline, is how some promotions work and would have been a smaller change:
one column on `events`, one refusal at import, and nothing per Bout.

It is not how TFC books. A card carries MMA Bouts, CageBox Bouts and Cage Grappling Bouts
together, and the whole reason this record exists is that the game has to ask different things
of the fights on one card. An Event-level discipline would mean either three Events for one
night — three cards a fan has to find, three Seasons' worth of [[import]]s, and a
[[leaderboard]] question nobody wants to answer — or a card where two thirds of the Bouts are
offering answers that cannot happen.

## Rejected: a method Select on the Bout row in Prismic

Instead of pointing at a `discipline` document, the `bouts` group could carry a Select field
listing the methods that Bout can end by.

It puts the game's pricing model in the CMS. What a Bout offers would be whatever an editor
ticked at eleven at night the day before a card, with no seeded Multiplier to go with a
method somebody added and nothing to say what a new combination is worth. The `discipline`
documents already exist, editors already pick them, and a closed set of three that the game
knows how to price is the thing being modelled.

## Consequences

- **The migration converts rather than stopping**, which is the first one in this sequence
  that does. Every Bout imported before this was imported with the eight answers MMA asks
  and priced and graded as one, so `discipline = 'mma'` is what those rows already were —
  unlike the corner ADR-0015 added or the round ADR-0016 removed, where there was no honest
  thing to convert into. No Outcome is added, removed or repriced, and nothing a fan
  committed Coins to changes meaning.
- **Which methods a Bout may record is held by a trigger**, not a check constraint: the
  answer is on the `bouts` row, and a check cannot read another table.
  `a_result_records_the_method_its_discipline_asks` is what refuses a Submission on a CageBox
  Bout in Postgres, and it fires on the update a [[correction]] makes as well as on the
  insert.
- **`parseEnding` gains an argument**, which ADR-0016 had just removed one from. It is a
  narrower one: the scheduled rounds were a fact about one booking, and this is what is being
  fought.
- **`recordedMethods` is a function where `RECORDED_METHODS` was a constant.** "The ways a
  Bout ends" stopped being one answer.
- **`inAskedOrder` takes no discipline and does not need one.** What a Bout offers is a
  subset of what the game asks, so the order of the whole is the order of every part of it —
  and a function told which Bout's Outcomes it was sorting could be told wrong.
- **The card shows what is being fought.** A fan reading three formats down one card has to
  be told which is which, so the discipline sits beside the weight class — on the marketing
  card as much as in TFC Predictions, which is why `Discipline` lives in the card model and
  not beside the import that reads it.
- **A Cage Grappling Bout is a shorter chain than it looks.** A fan holds at most one
  Prediction per Bout either way, but on an MMA Bout they choose which of two Questions to
  answer and here they have one. That is the Question not being asked, felt where it is felt.
