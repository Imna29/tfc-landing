---
status: accepted
---

# TFC Predictions awards no Prizes, and an account holds less because of it

Prizes are gone. No fan receives anything outside the game for finishing a Season anywhere in
particular, and TFC no longer runs a contest at all — it runs a free game whose reward for
playing well is a [[coin]] Balance and a place on a board.

Supersedes [[adr-0007]], which described Prizes as a manually fulfilled contest under Georgian
rules and published four constraints as the terms of it. Two of those constraints are retired
here, one is re-founded on something else, and the fourth was never about Prizes and survives
untouched.

## What a Season is played for now

The [[leaderboard]] while it runs, and its [[final-standings]] once it closes. Nothing else.

This is a smaller claim than the one it replaces, and it is worth saying plainly rather than
dressing up: a fan who finishes first receives the fact of having finished first. Closing a
Season still freezes its standings and still cannot be undone, and the reasoning for that is
unchanged in shape but different in weight — the frozen rows are the record of what happened,
not the evidence behind a thing of value that was handed over because of them. A record worth
keeping does not need to be worth arguing about to be worth keeping straight.

## The four published constraints, one at a time

**18 and over: retired.** The application no longer holds a `date_of_birth` and no longer
gates anything on age. [[adr-0007]] stored the date as the only evidence of the gate, and
`docs/research/prize-games-georgia-legal.md` recommended the gate for data-protection,
tax-withholding and reputational reasons — reasons which are not all about Prizes, and two of
which do not disappear with them. **This is the decision in this record with the least
technical necessity behind it and the most judgment in it.** It is recorded as what it is: a
product decision that a free game with nothing of value to win does not need to know how old
its players are, taken knowing that the research recommended otherwise for a product that
did. Reintroducing the gate means reintroducing the column, and the migration that dropped it
does not keep the data.

**One account per person: re-founded, and stronger than it was.** ADR-0007 said this was
"enforced only by email verification … a published rule and a speed bump, not a technical
guarantee". Email verification is retired below, so that enforcement is gone — and it is
replaced by a required, unique phone number on every account (`users_phone_unique`). It is a
better speed bump than the one it replaces: a second email address is free and instant, and a
second phone number is neither. It is still not a guarantee, and nothing here pretends it is.

**The uniqueness only means anything because the number is normalised first.** A phone number
has many spellings — `+995 555 123456`, `+995555123456`, `00995555123456` — and an index over
whatever a fan typed would hold all three and call them three people, which is this rule
failing silently in the one place nothing would notice. So `normalisePhone` reduces every
spelling to one E.164 string, a number given with no country code is refused rather than
guessed at, and a `user.create.before` hook runs the whole thing on the way into the database
so that it holds on `better-auth`'s own sign-up route too. The hook is where the 18+ gate used
to live, and it is there for the same reason that one was.

**A confirmed email address before a first Entry: retired.** Nothing confirms an address, no
confirmation link is sent, and signing up now signs a fan in and lets them play in one step.
The address is still held, still has to look like one, and is still what a password reset is
sent to — so a typo is still found out, by the fan, at the moment they need to get back in.

**Prizes are non-transferable and never exchangeable for cash: moot.** There are no Prizes.
What survives is the half of that sentence that was never about them, and it is now the whole
of the fine print every page of the game carries: **Coins are never purchasable, transferable
or redeemable, and have no real-money value.** That has not changed and must not — the moment
any of it becomes false, this is a different product in a different legal category, exactly as
ADR-0007 said.

## Consequences

- `first_name`, `last_name` and `date_of_birth` are dropped from `users`. All three existed
  only to serve a Prize or the gate around one, none of them was ever returned by any
  endpoint, and nothing else in the schema held a copy — so the migration is irreversible and
  the data is not recoverable. That is the point: an account that no longer needs a fan's
  legal name should not still be storing one.
- `phone` replaces them: required at sign-up, unique, `returned: false`, and stored normalised
  so that the uniqueness means something. Accounts created before this decision have no phone
  number and the column is nullable for their sake alone —
  `select id, email from users where phone is null` is the list of fans TFC still has to ask.
- `email_verified` stays on `users` because `better-auth`'s user model requires it, and is
  read by nothing. It is not evidence of anything any more.
- The `/prizes` and `/contest-rules` pages, the `prizes` and `contest_rules` Prismic models
  and the `PrizeTiers` slice are all removed. The Season deadline those pages carried moves to
  a `season_deadline` model read by the [[leaderboard]], which is where a fan asking "how am I
  doing?" and "how long have I got?" already goes.
- Nothing in the game's own section is edge-cached any more, because the two pages that were
  are the two that went. `app/utils/navigation.ts` and `app/layouts/play.vue` both said
  otherwise and now say this instead; the arrangement in `useBalance` is unchanged, because
  the marketing header is still on stored pages ([[adr-0008]]).
- `docs/research/prize-games-georgia-legal.md` is kept and marked as answering a question TFC
  no longer asks. It cost real work, and a later ticket that reopens Prizes should start from
  it rather than from nothing.
- **The legal pages still need review.** ADR-0007's last consequence — that
  `/terms-of-service` and `/privacy-policy` describe a brochure site rather than a service
  holding personal data — is *less* pressing than it was and is not resolved by this record.
  The service holds fewer categories of personal data than it did and runs no contest, which
  is a smaller thing to describe, not nothing to describe.
