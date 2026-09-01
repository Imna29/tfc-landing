# Context

The glossary for this project. Terms here are canonical: use them in code, issues, tests
and UI copy, and avoid the synonyms each entry rules out.

## Naming rule: no sportsbook vocabulary

This product is a free-to-play prediction game, not a sportsbook, and the language has to
hold that line everywhere — schema, API, UI copy. **Banned: bet, wager, slip, stake, odds,
parlay, accumulator, bookmaker, payout, void, punter, bankroll.** The replacements below
are the approved vocabulary. When a new concept needs a name, pick the word a quiz or
fantasy-league product would use, not the word a betting site would.

## Prediction Game

The feature is called **TFC Predictions** in public-facing copy. Not "prediction market" —
"market" is finance and sportsbook vocabulary, and the naming rule above applies to the
product name too.

### Event

One TFC fight card: a set of Bouts on a single date at a single venue. Authored in Prismic
and [[import]]ed into Postgres by an admin, which is what the game runs on from then on.
Belongs to exactly one Season. See [[adr-0001]].

### Lock

The moment a Bout stops accepting Predictions. Bouts lock individually: the first
automatically at the card's scheduled start, the rest advanced by an admin during the
event, with automatic backstops behind them. A locked Bout can never be reopened.
See [[adr-0006]].

Every Lock is recorded — when it happened, how, and which admin if one did it — and that
record is the answer to a fan who thinks their Bout closed too early. Its moment is the
moment the Bout stopped taking Predictions, never the moment the row was written: an
automatic Lock falls due while nobody is looking and is written down by the next request
to arrive.

The four ways a Bout locks: an admin locks it (**manual**), the card reaches its
scheduled start with the Bout fought first still open (**scheduled**), the [[sweep]]
passes (**sweep**), or a result is entered on a Bout still open (**result**). Only the
first is somebody deciding to close that Bout at that moment, and the other three are
**automatic** — a result Lock included, because what the admin decided to do was enter a
result.

Two of them are recorded against the admin whose action caused them, manual and result;
the two the card performs on its own are recorded against nobody, because nobody
performed them.

### Sweep

The last automatic backstop: every Bout still open a configured window after the card's
scheduled start — six hours by default — is locked regardless of what an admin
remembered to do.

Not a scheduled job. There is nothing to run one on ([[adr-0009]], [[adr-0010]]), so it
is applied by the requests that care where a Bout is: the public card, an Entry being
submitted or cancelled, the listing a fan reads the Entries they can still cancel in, and
the admin area. A card nobody is looking at locks the moment somebody looks, and the
[[lock]] is still dated at the moment it fell due.

Not the Entry history on the profile, which is the one listing of Entries that does not
apply it: nothing there can be cancelled, and a Prediction is graded against what its
Bout produced rather than against the moment it stopped taking answers.

### Result

What happened in a [[bout]], as an admin records it: who won, the method it ended by, and
the round it ended in. A [[bout]] that ends in a Decision has no round, for the same reason
a Prediction of one has none.

Recorded once per Bout and only after it has locked — entering one locks a Bout still open
— and the Bout is **settled** from that moment, which is the end of the road its status
travels: closed, open, locked, settled. A Result entered wrong is corrected rather than
deleted, the way a Coin Transaction is — see [[correction]] and [[adr-0003]].

A Result may record one more method than the game offers: a **disqualification**. It is
how a Bout ends and it is not one of the three answers any fan was shown, so it settles
the winner Question and turns the other two into [[no-result]]s.

Not a "score" and not an "outcome": an [[outcome]] is an answer the game offered, and a
Result is what actually happened. A [[bout]] that produced nothing gradable is a
[[no-result]] rather than a Result of its own. Both are recorded the same way and in the
same place, and a Bout is **settled** either way.

### Correction

Replacing a [[result]] that was entered wrong, once Entries have already settled against
it. The Bout stays settled and its Lock stays where it was: what was wrong is the record of
the fight, not the fact that it is over.

A Correction **reverses** the Coin Transactions the first Result wrote and grades every
Entry on the Bout again ([[adr-0003]]). It never edits or deletes one: a fan whose Entry
flipped from Won to Lost has the Reward taken back by a row that says so, standing beside
the row that paid it, so the mistake and its fix are both readable afterwards. An Entry
whose grade has not changed is not moved at all.

What the Bout used to be recorded as is kept, with who entered it, who corrected it and
when — the answer to a fan whose Entry was Won yesterday and is Lost today. The one Entry a
Correction never reaches is a cancelled one ([[cancellation]]), which was taken back before
anything in it was decided.

Not an "amendment", and never "voiding" a Result. Correcting is what the ledger is shaped
for, not an exception to it.

### Settlement

Grading every Entry affected by a Bout's [[result]] and writing the resulting Coin
Transactions, as one transaction. An Entry becomes Lost the instant any of its Predictions
loses, without waiting for its remaining Bouts. See [[adr-0003]].

A Prediction is **correct** only if every answer in it is: the winner, and the method and
round where the fan named them. Whether one landed is worked out from the Bout's Result
whenever it is shown, never written onto the Prediction — the [[result]] is the only record
of what happened.

### Bout

A single scheduled fight between two fighters on an event card. Carries its two fighters,
its weight class, and how many rounds it is scheduled for.

Not a "match", "fight", or "matchup". A Bout is the thing users predict against; the
`fighter` documents it references are the same fighters shown on the marketing site.

### Corner

One side of a [[bout]]: **red** or **blue**. Carries the name the fighter is fought under
and, when that fighter has a `fighter` document, their image and the uid their profile
page is reached by.

A corner with only a name is a **fallback name**, and is how a late replacement booked
days before a card appears on it at all. Requiring a document would mean either a rushed
half-empty one or a Bout that cannot be published, and the second costs predictions on a
fight that is actually happening. See [[adr-0001]].

### Card order

Where a [[bout]] sits on an [[event]]: 1 is fought first. Two Bouts on one card can never
share a place — it is the order they are locked in as the card progresses ([[adr-0006]]),
and the order a fan reads the card in.

Deliberately not the order the Bouts appear in Prismic, which is usually the reverse: a
card is written main event first and fought the other way round.

### Import

Copying an [[event]] and its [[bout]]s out of Prismic and into Postgres, which is where
the game reads them from afterwards ([[adr-0001]]). An admin does it, and does it again to
pull a lineup change through — but only while every Bout on the card is still closed. Once
one is open, fans hold Coins against these rows and the card can no longer be replaced.

Not a "sync": nothing goes back the other way, and nothing repeats it on a schedule.

### Question

One thing asked about a Bout. There are three: **winner**, **method of victory**, and
**round of victory**.

A Question is never an answer — "KO/TKO" is not a Question. Previously called a "market";
renamed because "market" reads as sportsbook.

### Outcome

One selectable answer to a Question — "Fighter A", "KO/TKO", "Round 2" — carrying the
Multiplier that answer pays.

### Multiplier

The number an Outcome pays, set by an admin before the Bout opens. **Never "odds".**

A Multiplier is copied onto a Prediction when the Entry is submitted and never recalculated.
Editing an Outcome's Multiplier afterwards never changes an Entry that already exists.
See [[adr-0002]].

Every Outcome is [[import]]ed carrying a **seeded** Multiplier from a fixed table, so that
pricing a card is eight numbers per Bout adjusted rather than eight authored from blank. A
seeded Multiplier is deliberately not a price: an Outcome is **priced** only once an admin
has set it, and a Bout with an **unpriced** Outcome cannot be opened. Method and round
Multipliers are priced conditionally on the winner the fan picked ([[adr-0004]]) — a method
of ×3.2 means ×3.2 *given that* the fighter they chose wins.

### Prediction

A user's answer for **one Bout**: a required winner Outcome, plus optionally a method
Outcome and a round Outcome. Its Multiplier is the product of the Outcomes chosen.

An Entry holds **at most one Prediction per Bout** — deepening a Prediction with method and
round is how you increase its Multiplier, and chaining across different Bouts is how you
combine. See [[adr-0004]].

A round of victory only goes with a **KO/TKO or a Submission**: a Decision is the Bout going
the distance, so there is no round it ends in, and "it ended in round 2" with no method named
is not something a result could grade either way.

### Entry

The committed unit: between one and ten Predictions plus an Amount of Coins. An Entry is
what a user *submits*, and what the profile history lists.

An Entry with more than one Prediction is a **Chained Entry**. Never a "slip", never a
"parlay" or "accumulator".

### Entry Status

One of **Open** (some Predictions still unresolved), **Won** (every Prediction correct or
No Result, Reward paid), **Lost** (at least one Prediction wrong), **Cancelled** (the fan
took it back before any of it was decided — see [[cancellation]]), or **Refunded** (every
Prediction was No Result, Amount returned).

The last two both return the Amount in full and are not the same thing. A Cancellation is
the fan's decision, taken while every Bout in the Entry was still open; a Refund is the
game's, because nothing in the Entry turned out to be gradable ([[adr-0005]]).

### Cancellation

A fan taking an Entry back. Its status becomes Cancelled and its Amount returns to the
Balance in full, as one Coin Transaction — restoring the Balance exactly, because the
Amount is the only thing that ever left it.

Allowed only while **every** Bout in the Entry is still open, and refused from the moment
the first of them locks. Multipliers are frozen at submission ([[adr-0002]]), so an Entry
that could be withdrawn at any point would let a fan wait for a Multiplier to move, or fish
for a pricing mistake and back out of it — and "frozen at submission" would mean nothing.
The rule is worth as much as "Predictions are made on open Bouts": a fan who could take an
Entry back after a Bout closed could take it back knowing how that Bout was going.

A cancelled Entry is not deleted. It stays in the fan's history with its status, is never
graded against a [[result]] and never pays a [[reward]], and is never cancelled twice —
what happened is recorded rather than unwritten, the way the [[coin-transaction]] ledger
records everything else ([[adr-0003]]).

It counts towards no leaderboard either. Its Coins are back in the [[balance]] the
standings are read from, so a ranking by Balance excludes it by arithmetic; a column
counting Entries played has to exclude it by asking, because an Entry the fan took back
is not one they played.

Not a "withdrawal", which is money leaving an account somewhere, and never "voiding" an
Entry.

### Amount

The Coins a user commits to an Entry. Minimum 1, maximum the user's whole Balance. Deducted
at submission, not at settlement. Never a "stake".

### Reward

Coins returned by a winning Entry: Amount × the Entry's combined Multiplier, which is capped
at ×100. A losing Entry has no Reward; it is not a "negative reward". Never a "payout".

The cap is a rule of the game rather than a number frozen on the Entry, so a Reward is
worked out from the Predictions every time one is needed and never read back from a promise.
See [[adr-0013]].

### Prize

What a top finisher of a Season receives from TFC once it ends — never Coins, and never a
cash equivalent. Described on the prizes page, governed by the published contest rules, and
awarded by hand, offline, by TFC staff. The application has no notion of a prize: no
claiming, no shipping details, no prize state. See [[adr-0007]].

Not a [[reward]]. A Reward is Coins the game pays a winning Entry; a Prize is what the
Season's final standings are worth outside the game. Never a "payout" for either.

### Fan

A person with an account: the audience this game is built for, and the word the spec's
user stories use throughout. Prefer it to "user" in copy and in names for things a fan
would recognise as themselves.

A Fan is public only as their [[username]]. Their first and last name are held solely so
TFC can match a [[prize]] to a person and are never returned by any endpoint; their date
of birth is the only evidence of the 18+ gate and is stored as a date, never as an age.
See [[adr-0007]].

The table is `users` and `better-auth` calls the model `user`, because that is what it
requires of a schema. Above that layer — routes, composables, pages, tests — the word is
Fan.

### Admin

A [[fan]] whose [[role]] is admin: TFC staff who price a card, open and lock Bouts, enter
results and run Seasons. Not a second kind of account — an Admin has a Balance and can
play like anyone else, and every "as an admin" user story is about what the role permits,
not about who the person is.

The admin area is one deliberately plain part of the same application, at `/admin`. There
is no separate admin site. See [[adr-0011]].

### Role

What a user is permitted to do: `fan` or `admin`, held as a column on the user row. Not
"permission", "scope" or "claim" — there is one column with two values, and naming it as
though it were a permissions system would promise something the product does not have.

A Role is never carried on a session and is never settable through any route: it is
granted by hand in SQL, so that no form, and no field an auth library might helpfully
accept, can make somebody an admin. See [[adr-0011]].

### Username

The only identifier TFC ever shows publicly: on a leaderboard, beside an Entry, anywhere
one fan can see another. Chosen at signup, unique regardless of capitalisation, and never
a real name.

### Coin

The virtual currency. Has no real-money value and is never purchasable, transferable or
redeemable. Users receive 100 at the start of each Season.

### Coin Transaction

One append-only row in the Coin ledger — a commitment, a Reward, a refund, or a reversal.
The ledger is the source of truth for Balance; there is no mutable balance column.
See [[adr-0003]].

Deliberately *not* called a "ledger entry", because [[entry]] already means something else
in this domain.

### Balance

A user's current Coin total for the current Season, derived from their Coin Transactions.
Coins committed to an unsettled Entry have already left the Balance.

A **materialised Balance** is a stored copy of that total, per user per Season, so a header
or a leaderboard does not add the ledger up on every request. It is derived data and can
always be rebuilt from the Coin Transactions — it is never a source of truth, and never the
mutable balance column [[adr-0003]] rules out.

### Rank

Where a [[fan]] sits in a Season's standings: 1 is the top. Ordered by [[balance]], and
where two fans hold the same, by who reached that total first — so that a Rank is
predictable rather than arbitrary, and does not reorder between one page load and the
next.

Read from the materialised [[balance]] rather than by adding the ledger up, because the
leaderboard asks for a page of them and every profile asks for one.

A fan reads their own Rank on their profile however far down it they are, which is the
question the top ten cannot answer for somebody sitting at 340th. What a Rank is worth
outside the game is a [[prize]], and only a Season's final standings decide those.

### No Result

A Bout that produced nothing gradable, and which of four it was: **cancelled**,
**withdrawal**, **draw**, or **no contest**. Its Prediction contributes a Multiplier of
×1.0 and the rest of the Chained Entry plays on; if every Prediction in an Entry is No
Result, the Amount is refunded in full.

The reason is recorded and shown, because a fan told their Prediction counted for nothing
and not why is reading an outcome that looks arbitrary.

It is also what a single Question becomes where the Bout answered the others. A
disqualification settles the winner and leaves the method and round Questions No Results —
so a No Result is a thing that happens to a Question, and a Bout that produced nothing is
the case where it happens to all three.

Never "void". See [[adr-0005]].

### Season

An admin-declared block of Events. Every user starts each Season with 100 Coins, and there
are no mid-Season top-ups — a user who reaches zero waits for the next Season. Leaderboards
are scoped to a Season; Entry history is kept forever and grouped by Season.
