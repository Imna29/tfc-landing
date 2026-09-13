---
status: accepted
---

# The combined Multiplier is uncapped

An Entry pays what its Predictions multiply out to. A chain of ten answers at ×3 returns
×59049, and `potentialReward` in `shared/entries.ts` works that out and rounds it to whole
Coins without a ceiling anywhere in the arithmetic.

Supersedes [[adr-0013]], which capped the combined Multiplier at ×100 and argued that the cap
was a rule of the game rather than a term of the offer. The cap is removed here. The rest of
that record — that the combined Multiplier and the Reward are derived wherever one is needed
and never written onto the Entry — is unchanged and restated below, so that the rule the code
actually depends on is not left documented only in a superseded record.

## Why the cap goes

It was the wrong instrument for the thing it was aimed at. [[adr-0002]] prices every Outcome
by hand with no pool behind it to correct a number nobody looked at, and the cap was half of
the answer to that: a bound on what one mispriced Outcome could cost, standing beside the
ten-Prediction limit.

What it cost was the point of the game. A chain is the reason to build a long Entry, and a
Multiplier that stops growing at the fourth or fifth Prediction takes the reason away exactly
where a fan is most invested in it — the panel went on counting Predictions while the number
beside them sat still. [[adr-0013]] accepted that and paid for it with a sentence in the panel
explaining why the number had stopped. A rule that has to be explained at the moment it bites
is a rule working against the product.

The exposure it was bounding is also smaller than it looks. A Multiplier is set before a Bout
opens and is refused unless it is above 1 and no higher than 100 (`outcomes_multiplier_pays`),
which is the guard against a stuck key — 190 where 1.90 was meant. A mispriced Outcome is
still exploitable until somebody notices, and that is [[adr-0002]]'s standing bill, unchanged.

## What now bounds a Reward

The ten-Prediction limit, and nothing else. That is the whole of it, and it is the thing to
weigh before anybody widens `ENTRY_PREDICTIONS`: ten wrong Multipliers now multiply out in
full.

Coins are not money ([[adr-0018]] retired Prizes, so a Balance buys nothing outside the game),
which is what makes an unbounded number a design decision rather than a liability.

## What is unchanged from ADR-0013

- **Nothing is stored.** There is no `entries.combined_multiplier` column and no stored
  Reward. Both are the product of what is on the Entry's Predictions, worked out by
  `potentialReward` for the panel a fan confirms in, the answer the API sends back, and the
  settlement that pays.
- **Settlement could not pay a stored number anyway.** A No Result contributes ×1.0
  ([[adr-0005]]) and a disqualification leaves the method Question with nothing to grade, so
  the Reward actually paid is worked out from the answers that survived. A stored "if every
  Prediction lands" number would sit beside the number that pays, looking like the authority
  and being wrong for every Entry that met one of those.
- **What [[adr-0002]] freezes still is frozen.** Every Multiplier an Entry multiplies together
  is a value copied onto its Prediction at submission, and repricing an Outcome tomorrow never
  reaches it.
- **The Reward is worked out in JavaScript and written to the ledger as whole Coins.** Nothing
  recomputes it in SQL: Postgres and JavaScript round differently — `30 × 1.15` is
  `34.499999999999996` as a float and `34.50` as `numeric` — so a second implementation would
  disagree with the first about somebody's Coins.

## Consequences

- Removing the cap changes what every unsettled Entry pays, upward, for the same reason
  [[adr-0013]] said changing the number would: the Reward is a rule applied wherever one is
  worked out rather than a number frozen on the Entry. This lands between Seasons.
- `PotentialReward` no longer carries a `capped` flag and `ENTRY_MESSAGES` no longer has a
  sentence for it. Nothing in the panel explains a number that has stopped growing, because it
  no longer stops.
- A Reward can be large enough to be worth reading carefully. `coinsLabel` formats it, and
  that is the place to change if the number ever needs abbreviating.
- **A Reward is written to an `integer` column** (`coin_ledger.amount`), so it cannot exceed
  2147483647. The cap used to put that out of reach; nothing does now. Ordinary pricing stays
  far below it — ten answers at ×3 on an Amount of 100 is under 6 million — but five Outcomes
  priced at the ×100 ceiling chain past it, and such an Entry would fail its settlement
  transaction rather than pay a wrong number. That is the honest trade for removing the cap:
  the failure is loud and it takes a pricing mistake nobody would make by hand to reach it. A
  `bigint` column is the fix if it ever stops being theoretical.
