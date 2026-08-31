---
status: accepted
---

# The combined Multiplier cap is a rule of the game, not a term of the offer

An Entry freezes what each of its answers paid ([[adr-0002]]) and nothing else. The combined
Multiplier, the ×100 cap on it and the rounding to whole Coins are worked out from the
Predictions wherever a Reward is needed — by `potentialReward` in `shared/entries.ts`, for
the panel a fan confirms in, the answer the API sends back, and the settlement that pays.
There is no `entries.combined_multiplier` column and no stored Reward.

The alternative was to write the capped Multiplier the fan was shown onto the Entry as a
term of what they were offered, and settle against that number.

What decided it is that settlement can never pay the stored number anyway. A No Result
contributes ×1.0 ([[adr-0005]]) and a disqualification leaves the method and round Questions
with nothing to grade, so the Reward actually paid is worked out from the answers that
survived and re-capped. A stored "if every Prediction lands" number would sit beside the
number that pays, looking like the authority and being wrong for every Entry that met one of
those. [[adr-0003]] refuses that shape for a Balance for the same reason: derived data is
either the truth or a cache with a rebuild path, and a stored combined Multiplier is neither.

What is frozen is what [[adr-0002]] says has to be. A fan knows what they stand to win at the
moment they commit because every Multiplier their Entry multiplies together is a value copied
onto their Prediction, and repricing an Outcome tomorrow never reaches them. The cap is not
one of those numbers. It is a bound on what a mispriced Outcome can cost, standing beside the
ten-Prediction limit, and both are rules of the game rather than prices anybody was quoted.

## Consequences

- Changing `COMBINED_MULTIPLIER_CAP` changes what every unsettled Entry pays. That is why it
  is a constant edited in a reviewed change rather than a setting somebody can type, and why
  it moves between Seasons rather than during one.
- Settlement recomputes both the combined Multiplier and the cap from the Predictions. It
  never reads a promised number back, so there is no case in which two numbers disagree and
  something has to choose.
- The Reward is worked out in JavaScript and written to the ledger as whole Coins. Nothing
  recomputes it in SQL: Postgres and JavaScript round differently — `30 × 1.15` is
  `34.499999999999996` as a float and `34.50` as `numeric` — so a second implementation would
  disagree with the first about somebody's Coins.
- The schema sketch in the parent spec, which lists a combined Multiplier and a potential
  Reward on the Entry, is superseded here.
