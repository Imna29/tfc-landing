---
status: accepted
---

# The combined Multiplier is capped at ×10000

An Entry's combined Multiplier stops at ×10000 however far it is chained.
`potentialReward` in `shared/entries.ts` applies `COMBINED_MULTIPLIER_CAP` wherever a Reward is
worked out, and says in `capped` whether the cap is what decided the number.

Supersedes [[adr-0020]], which removed the cap entirely. It reinstates the bound [[adr-0013]]
put there, at a hundred times the number: ×10000 rather than ×100.

## Why the cap comes back

[[adr-0020]] was right about what the cap cost and wrong about what removing it left.

What it was right about: a chain is the reason to build a long Entry, and at ×100 the number
stopped growing around the fourth or fifth Prediction, while the panel went on counting them.
That is a rule working against the product, and it had to be explained at the moment it bit.

What it left is an Entry with no ceiling at all, resting entirely on ten hand-set prices being
right. [[adr-0002]] has no pool to correct a number nobody looked at, so one Outcome priced at
190 where 1.90 was meant is exploitable until somebody notices — and uncapped, that mistake
multiplies through the other nine links in full. The ten-Prediction limit bounds how long a
chain is, not what it pays, so it was never the bound [[adr-0020]] asked it to be.

## Why ×10000

**The cap is meant to catch the absurd and nothing else.** At ×10000 it is not a number a fan
plays against; it is the ceiling a Reward cannot pass however badly an Outcome was priced.

- Ten answers at ×2 multiply out to ×1024, and ten at ×2.5 to ×9537. So the longest Entry the
  game allows, at the prices it is usually offered at, does not reach the cap at all.
- Two Outcomes priced at the ×100 ceiling a single Multiplier may be given
  (`outcomes_multiplier_pays`) come to exactly ×10000 and do not pass it. It takes three such
  prices, or a long chain of smaller mistakes, to be capped.
- Ten at ×3 multiply out to ×59049, which is capped, and that is the shape this is for: either
  a fan who has predicted ten underdogs correctly, or prices nobody checked.

**The consequence to accept is that the cap will almost never be the number a fan sees.** That
is deliberate at this height — an Entry that reaches ×10000 is an extreme — and it is worth
writing down, because a cap that never appears looks broken to anybody testing for it. The
rule is real and it is rarely reached; both halves are the design.

`ENTRY_MESSAGES.capped` still explains the number where it does bite, for the reason
[[adr-0013]] gave: a Multiplier that stopped moving with no sentence beside it reads as a page
that has stopped working.

## What this does not put out of reach

A Reward is written to an `integer` column (`coin_ledger.amount`), so it cannot exceed
2147483647. [[adr-0020]] noted that removing the cap left nothing between a long chain and a
settlement transaction that fails on overflow. A cap of ×10000 narrows that but does not close
it: **the Amount need only exceed 214,748 Coins** for a capped Entry to overflow the column.

That is reachable in two steps rather than none. A Season starts every fan on 100 Coins
([[adr-0018]]), one capped win turns 100 into 1,000,000, and committing a fifth of that on
another chain that caps overflows the ledger. The Entry fails its settlement transaction rather
than paying a wrong number, so the failure is loud — but it is no longer only theoretical, and
a `bigint` column is the fix when a Balance that large stops being hypothetical. A lower cap
would have bought this back; ×10000 is the choice not to.

## What is unchanged

- **The cap is a rule of the game, not a term of the offer.** [[adr-0013]]'s reasoning is kept
  whole, and this is the record that restates it: the cap and the rounding are applied wherever
  a Reward is worked out — the panel a fan confirms in, the answer the API sends back, the
  settlement that pays — rather than written onto the Entry as a number to be read back.
- **Nothing is stored.** There is no `entries.combined_multiplier` column and no stored Reward.
- **Settlement could not pay a stored number anyway.** A No Result contributes ×1.0
  ([[adr-0005]]) and a disqualification leaves the method Question with nothing to grade, so
  the Reward actually paid is worked out from the answers that survived and re-capped.
- **What [[adr-0002]] freezes still is frozen.** Every Multiplier an Entry multiplies together
  is a value copied onto its Prediction at submission, and repricing an Outcome tomorrow never
  reaches it. The cap is not one of those numbers.
- **The Reward is worked out in JavaScript and written to the ledger as whole Coins.** Nothing
  recomputes it in SQL: Postgres and JavaScript round differently — `30 × 1.15` is
  `34.499999999999996` as a float and `34.50` as `numeric` — so a second implementation would
  disagree with the first about somebody's Coins.

## Consequences

- Changing `COMBINED_MULTIPLIER_CAP` changes what every unsettled Entry pays, for the reason
  both previous records gave: the Reward is a rule applied wherever one is worked out rather
  than a number frozen on the Entry. This lands between Seasons.
- `PotentialReward` carries `capped` again and `ENTRY_MESSAGES` has a sentence for it again,
  which `EntryBuilder.vue` shows under the Returns figure. Both were removed by [[adr-0020]]
  and are restored rather than reinvented.
- A `SubmittedEntry` carries `capped` back to the fan who submitted it, so the panel's
  confirmation agrees with the panel that priced it.
- The ceiling on a single Multiplier (`MULTIPLIER.maximum`, and `outcomes_multiplier_pays`) is
  doing the work the cap used to do on a short Entry. Two prices at that ceiling reach ×10000
  exactly and are paid in full, so a stuck key on a two-Bout Entry is caught by that check or
  not at all.
- Because the cap is rarely reached, the test suite is where the evidence that it works lives:
  `test/unit/entries.test.ts` holds the arithmetic, and the cases in
  `test/server/entries.test.ts` and `test/server/settlement.test.ts` arrange prices high enough
  to reach it through the API and through a settlement that pays.
