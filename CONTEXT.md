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
and copied into Postgres when an admin opens it for predictions. Belongs to exactly one
Season. See [[adr-0001]].

### Lock

The moment a Bout stops accepting Predictions. Bouts lock individually: the first
automatically at the card's scheduled start, the rest advanced by an admin during the
event, with automatic backstops behind them. A locked Bout can never be reopened.
See [[adr-0006]].

### Settlement

Grading every Entry affected by a Bout's result and writing the resulting Coin
Transactions, as one transaction. An Entry becomes Lost the instant any of its Predictions
loses, without waiting for its remaining Bouts. See [[adr-0003]].

### Bout

A single scheduled fight between two fighters on an event card. Carries its two fighters,
its weight class, and how many rounds it is scheduled for.

Not a "match", "fight", or "matchup". A Bout is the thing users predict against; the
`fighter` documents it references are the same fighters shown on the marketing site.

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

### Prediction

A user's answer for **one Bout**: a required winner Outcome, plus optionally a method
Outcome and a round Outcome. Its Multiplier is the product of the Outcomes chosen.

An Entry holds **at most one Prediction per Bout** — deepening a Prediction with method and
round is how you increase its Multiplier, and chaining across different Bouts is how you
combine. See [[adr-0004]].

### Entry

The committed unit: between one and ten Predictions plus an Amount of Coins. An Entry is
what a user *submits*, and what the profile history lists.

An Entry with more than one Prediction is a **Chained Entry**. Never a "slip", never a
"parlay" or "accumulator".

### Entry Status

One of **Open** (some Predictions still unresolved), **Won** (every Prediction correct or
No Result, Reward paid), **Lost** (at least one Prediction wrong), or **Refunded** (every
Prediction was No Result, Amount returned).

### Amount

The Coins a user commits to an Entry. Minimum 1, maximum the user's whole Balance. Deducted
at submission, not at settlement. Never a "stake".

### Reward

Coins returned by a winning Entry: Amount × the Entry's combined Multiplier, which is capped
at ×100. A losing Entry has no Reward; it is not a "negative reward". Never a "payout".

### Prize

What a top finisher of a Season receives from TFC once it ends — never Coins, and never a
cash equivalent. Described on the prizes page, governed by the published contest rules, and
awarded by hand, offline, by TFC staff. The application has no notion of a prize: no
claiming, no shipping details, no prize state. See [[adr-0007]].

Not a [[reward]]. A Reward is Coins the game pays a winning Entry; a Prize is what the
Season's final standings are worth outside the game. Never a "payout" for either.

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

### No Result

A Bout that produced nothing gradable: cancelled, a fighter withdrew, a draw, or a no
contest. Its Prediction contributes a Multiplier of ×1.0 and the rest of the Chained Entry
plays on; if every Prediction in an Entry is No Result, the Amount is refunded in full.

Never "void". See [[adr-0005]].

### Season

An admin-declared block of Events. Every user starts each Season with 100 Coins, and there
are no mid-Season top-ups — a user who reaches zero waits for the next Season. Leaderboards
are scoped to a Season; Entry history is kept forever and grouped by Season.
