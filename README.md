# Nuxt Minimal Starter

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.

## Content model

Pages are authored in Prismic. The models live in the repo — one directory per
custom type under `customtypes/`, one per slice under `app/slices/` — and
`prismicio-types.d.ts` is the generated TypeScript for them.

The repo is only ever the *local* copy. A model added here does not exist in the
Prismic repository until it is pushed with the Prismic CLI, and until it is, the
content team has nothing to edit. `prizes` and `contest_rules` have been pushed
and have no documents written against them yet, so the pages render their
built-in content and wait.

Pages are written to survive that gap rather than to depend on it. A singleton
that has never been created reads as a missing document, not an error, and
`/contest-rules` publishes the ADR-0007 eligibility constraints from
`app/utils/eligibilityRules.ts` until someone authors better wording.

**`prismic.config.json` cannot describe a type the Document API does not
already know.** Its `routes` are sent to Prismic as a query parameter on
*every* document fetch, and the API validates the whole array before answering:
one entry naming a type it does not recognise fails the request with a 400
`Link resolver error`, so no page gets any content and `app/pages/[uid].vue`
answers 404 for all of them. The failure is total and names a type rather than
a route, which is what makes it read like a broken app rather than a config
that ran ahead of the content.

Pushing the model is *not* enough to make that entry safe, and neither is
writing a document: `cta` and `picture` carry no documents at all and are
accepted, while `prizes` and `contest_rules` were still rejected long after a
successful push. Prismic keeps more than one view of which types exist and they
converge at their own pace — the `types` map on `/api/v2` listed both new types
while the route validator was still refusing them, with its error naming the
older, shorter list. So `types` is not the gate, and the only honest check is
to ask the validator itself:

```bash
ref=$(curl -s https://tfc-landing.cdn.prismic.io/api/v2 | jq -r '.refs[0].ref')
curl -s -o /dev/null -w '%{http_code}\n' -G \
  https://tfc-landing.cdn.prismic.io/api/v2/documents/search \
  --data-urlencode "ref=$ref" \
  --data-urlencode 'routes=[{"type":"prizes","path":"/prizes"}]' \
  --data-urlencode 'q=[[at(document.type,"home_page")]]'
```

`200` means the entry is safe to add; `400` means it would take the whole site
down with it. Run it once per type being added. `route-rules.ts` is
unaffected either way — `/prizes` and `/contest-rules` are real pages under
`app/pages/`, and the resolver only ever computed `document.url` for links to
those documents, of which there are none yet.

Models are edited either in the [Type Builder][type-builder] — Prismic's
browser UI, which writes straight to the repository — or here with the CLI,
which is the half that syncs. `prismic.config.json` is its config too, so there
is nothing to set up:

```bash
npx prismic login
npx prismic status        # what would be pushed or pulled, before doing either
npx prismic push          # local models up to Prismic
npx prismic pull          # remote models down into the repo
npx prismic gen types     # regenerate prismicio-types.d.ts
```

Each direction makes one side match the other, and neither merges. `push`
treats the local models as the source of truth and *deletes* remote models the
repo does not have; `pull` treats the remote as the source of truth and
*deletes* local ones — which, while `prizes` and `contest_rules` are still
unpushed, means a `pull` right now would remove them and the two slices they
were added with. Read `status` first, work from a clean tree, and let git be
the thing that makes a wrong direction recoverable.

A custom type also has to go up together with the slices its slice zone offers,
or it lands with choices that resolve to nothing.

Model JSON under `customtypes/` and `app/slices/` is written by these tools; do
not hand-edit it. `.agents/skills/prismic` teaches coding agents the same
workflow.

[type-builder]: https://prismic.io/docs/type-builder

`test/unit/vocabulary.test.ts` holds the naming rule from `CONTEXT.md` over
every file that carries copy: no sportsbook vocabulary, anywhere a fan can read
it.

## Routing

**One spelling per URL.** Route matching is case-sensitive
(`router.options.sensitive` in `nuxt.config.ts`), which is not Vue Router's
default. It has to be, because Nitro's route rules are case-sensitive and Vue
Router was not: `/PROFILE` rendered the signed-in fan's page while missing the
rule that exempts `/profile` from the edge cache, so it fell through to the
marketing catch-all and was stored and served to whoever asked next. See
ADR-0012. The cost is that a URL typed in capitals is a 404 rather than the
page it was aiming at.

`app/pages/[uid].vue` is the Prismic catch-all and takes any single segment, so
every wrong-case URL lands there. It answers 404 for a uid with no document
behind it — an empty `SliceZone` with a 200 would make each one look like a
page whose content nobody had written yet.

## Database

Postgres, accessed with Drizzle. Copy `.env.example` to `.env`: `DATABASE_URL`
points at your local Postgres, and `BETTER_AUTH_SECRET` is any long random
string (`openssl rand -base64 32`) — changing it signs every fan out.

```bash
createdb tfc                # or: docker exec <postgres> createdb -U postgres tfc
pnpm db:migrate             # apply migrations
```

Run `pnpm db:migrate` again after pulling work that added one. A missing
migration does not announce itself as a missing migration: it surfaces as
`relation "events" does not exist` from whichever route touches the table
first.

The schema is `server/db/schema.ts`. After changing it, generate a migration and
read the SQL before it runs anywhere:

```bash
pnpm db:generate --name what_it_does
```

Migrations are applied, never edited once committed — a Coin ledger has to be
able to explain how it got to its current shape.

## Accounts

Signing up, signing in and sessions are `better-auth`, wired up in
`server/utils/auth.ts`. That file is the only place its vocabulary meets this
one, and the note at the top of it is worth reading before changing anything
here: `better-auth` calls a display name `name`, and the only display name a
fan has is their username.

Two rules are enforced below every route rather than in one:

- **18+** lives in a `user.create.before` database hook, so no route — not
  `better-auth`'s own sign-up route, not a social login added later — can
  create an account without it. ADR-0007 is not a rule one form gets to be the
  enforcement of.
- **Real names never leave the database.** `firstName` and `lastName` are
  declared `returned: false`, so no response `better-auth` composes can carry
  them. They exist only so a Prize can reach a person.

A database hook must not query anything: it runs inside a transaction holding
the process's only connection. See ADR-0010, which is the rule every later
ticket has to work inside.

Signing up has a route of this app's own — `POST /api/accounts/sign-up` — which
speaks this domain's vocabulary and answers a bad form with every problem at
once. Confirming an address and resetting a password add two more, for the
reason given under [Email](#what-is-not-here). Everything else is `better-auth`
under `/api/auth`, including verifying a link and setting the new password.

`better-auth` rate-limits its own routes in a built server: three sign-ins or
sign-ups every ten seconds per IP, and three verification or reset emails a
minute. A test file that spends those on assertions it could make another way
runs out of them.

## Admin

Everything an admin can do lives in the same app, at `/admin` and under
`/api/admin` — one deliberately plain area, no separate admin application and no
design pass. The live lock console (#20) is the one screen that gets one,
because it is the only one used cageside on a phone.

`server/middleware/admin.ts` refuses every request under those two prefixes
before any handler runs: 401 for a signed-out visitor, 403 for a signed-in fan.
The guard is the *prefix*, not a list of routes, so an admin page or endpoint
added by a later ticket is locked from its first line rather than from whenever
somebody remembers to lock it. What that costs is the matching itself — a path
the guard fails to recognise is a path served with no role check at all — which
is why `server/utils/adminArea.ts` is a module of its own with unit tests of its
own. It deliberately recognises more than the app serves, `/ADMIN` among them:
guarding a path that turns out not to exist costs a 404, and failing to guard
one costs everything.

A handler still calls `requireAdmin(event)`, but not to be let in: that already
happened. It is how the handler learns *which* admin is acting, for the "who did
this, and when" that lock and result records have to carry.

`/api/admin/me` is the shape to copy for a new admin endpoint, and
`test/server/admin.test.ts` the file to add its tests to.

### Granting the admin role

There is no route, no form and no script that grants it. `role` is not a field
`better-auth` knows about, so nothing it serves can read or write the column and
a sign-up asking for `"role": "admin"` is a request nothing acts on. The only
way in is SQL, run by hand against the database — which has to have had
`pnpm db:migrate` run against it, or there is no `role` column to set:

```sql
update users set role = 'admin' where lower(email) = lower('someone@tfcgeo.com');
```

Check it landed:

```sql
select username, email, role from users where role = 'admin';
```

Every spelling but `fan` and `admin` — `'Admin'` included — is refused by the
`users_role_known` check constraint, so a typo fails loudly instead of leaving
an account that looks granted. To take the role away, set it back to `'fan'`:
the role is read from the row on every request, so the next one is refused and
there is no session to wait out.

See ADR-0011 for why it is arranged this way.

## Seasons and Coins

**Balance is not a column.** It is what a fan's Coin Transactions add up to
(ADR-0003), and every movement of Coins is an append-only row carrying its
kind, a signed amount, a reason, and a reference to what caused it. The reason
is corrections: when a result is entered wrongly and hundreds of Entries have
settled against it, the fix has to be reversing rows that leave the mistake and
its correction both visible, rather than balances silently rewritten.

`balance_cache` is a materialised copy of what those rows add up to, per fan per
Season, because the site header and the leaderboard cannot aggregate the whole
ledger on every request and ADR-0009 rules out putting anything in front of
Postgres. It is derived data. `server/utils/coins.ts` only ever writes it as a
`select` back out of the ledger — there is deliberately no "add this much"
path — so `rebuildBalanceCache` is the same statement with nothing narrowing
it, and `test/server/coins.test.ts` corrupts the cache and proves it comes back.

### Where Coins come from, and nowhere else

`POST /api/admin/seasons` opens a Season and grants every fan who has an account
their 100 Coins. A fan who joins afterwards is granted the same 100 by a
`user.create.after` database hook, so it happens on `better-auth`'s own sign-up
route too, not only on this app's. That is the whole supply: everything a later
ticket adds moves Coins that already exist.

There is no route that adds Coins to a fan, and adding one would undo this. What
stops one being added by accident is in the schema, not in a review:

- `coin_transactions_one_grant_per_fan`, a partial unique index — one grant per
  fan per Season, whatever asks.
- `coin_transactions_grant_is_the_starting_balance` — a grant is worth exactly
  100 Coins and points at its own Season. Hard-coded, so changing what everyone
  starts on is a migration somebody reviews.
- `coin_transactions_kind_known` permits exactly the kinds that something writes
  today, which is one. The ticket that adds a commitment or a Reward adds its
  kind in its own migration, where somebody has to ask what writes it and what
  stops it writing twice.
- `seasons_one_open`, another partial unique index — at most one Season open, so
  two admins pressing the button in the same second cannot hand out two
  hundreds.
- A `coin_transactions_are_append_only` trigger refuses every `update` and
  `delete` on the ledger. Drizzle does not model triggers, so it is hand-written
  in `0003_seasons_and_the_coin_ledger.sql` and nothing but the test suite will
  notice if it goes missing.

Closing a Season and rolling into the next one arrive with #19. Until then a
Season opens and stays open.

### Repairing a fan with no Coins

The joining grant is not in the same transaction as the account — it cannot be;
`better-auth` has already committed by the time an `after` hook may query
(ADR-0010). If it fails, the account exists holding nothing, and the failure is
reported rather than swallowed so that somebody knows. Writing the missing row
by hand is the repair, and it is refused rather than doubled if the fan turned
out to have one already:

```sql
insert into coin_transactions (season_id, user_id, kind, amount, reason, cause, cause_id)
select s.id, u.id, 'season_grant', 100, 'Joined ' || s.name, 'season', s.id
from seasons s, users u
where s.status = 'open' and lower(u.email) = lower('someone@example.com')
on conflict do nothing;
```

Then bring the materialised Balance back in step — the ledger is the truth, and
the cache is only what it was last told:

```sql
insert into balance_cache (season_id, user_id, balance)
select season_id, user_id, sum(amount) from coin_transactions
where season_id = (select id from seasons where status = 'open')
group by season_id, user_id
on conflict (season_id, user_id) do update
  set balance = excluded.balance, updated_at = now();
```

### The Balance in the site header

`app/components/FanBalance.vue` asks `/api/coins/balance` **from the browser**,
and renders nothing at all on the server. That is not a preference. The header
is part of every marketing page, and those are edge-cached with a key that
ignores cookies (ADR-0008): a Balance rendered into one would be stored and
served to whoever asked next. So the HTML ships identical for everybody and the
browser fills the number in.

The consequence is that the header is mounted once and outlives every page, so
it only learns the answer has changed because somewhere says so. That is what
`useBalance()`'s three verbs are for: `load()` is "make sure we know", which is
what the header itself calls; `refresh()` is "it has changed, ask again", which
signing in and signing up call, and which submitting an Entry will have to when
#11 lands; `forget()` is "there is no fan now", which signing out calls.

## Cards: from Prismic into the game

A fight card is authored in Prismic as an `event` document — title, scheduled
start, venue, poster, and a repeatable `bouts` group — and an admin imports it
at `/admin/events`. Import copies the Event and its Bouts into Postgres, and
**from that moment the game reads only Postgres** (ADR-0001). Editing the
document afterwards changes the marketing site; it never changes a Bout a fan
has committed Coins to.

Each corner of a Bout is either a link to a `fighter` document — whose name,
image and uid are resolved at import — or a **fallback name** typed straight
into the group. Fight cards change late, and a replacement booked 48 hours out
usually has no `fighter` document yet; requiring one would mean either a rushed
half-empty document or a Bout that cannot be published, and the second costs
predictions on a fight that is actually happening.

The import is two halves, and they are worth telling apart:

- `server/utils/cardImport.ts` decides what the card **says**. Pure, and the
  half with tests (`test/unit/card-import.test.ts`): it refuses a card whose
  Bout has no card order, whose corners are empty, whose fighter document is
  unpublished, whose division is missing, or which claims two main events —
  each with a sentence naming the row to go and fix.
- `server/utils/events.ts` decides what the game **runs on**: the Event and its
  Bouts, written as one transaction.

### Re-importing, and the door that shuts

A card can be re-imported while **every Bout on it is still closed**, which is
how a lineup change gets pulled through. Re-import replaces the Bouts rather
than reconciling them — a replacement fighter, a Bout added and a Bout dropped
are all the same edit from outside — so a re-imported card is a card to be
priced again once #9 lands.

Once any Bout has been opened, re-import is refused. Not by the route being
careful: by a trigger in `0004_event_import.sql` that refuses to `delete` a Bout
whose status is not `closed`, because a replaced Bout is a Prediction pointing
at a fight that no longer exists. The route asks first only so that the admin is
told which rule it was.

`bouts.status` is `closed` or `open` today. `locked` arrives with #12 and
`settled` with #14, each added by that ticket's own migration — everything here
asks whether a Bout is still `closed`, so those land without reopening this
decision.

### Pricing a card, and opening its Bouts

Every Bout arrives with its whole set of Outcomes already written: two winner
Outcomes, three method Outcomes, and **one round Outcome for each round it is
scheduled for**, so a three-round Bout has no round 4 to offer. `shared/pricing.ts`
is the one place that says what a Bout is asked and what each answer is seeded
to pay; `server/utils/pricing.ts` writes them, inside the import's own
transaction.

Seeding is what makes ADR-0002 payable. Multipliers are fixed by hand, so
somebody at TFC prices every card before it opens — forever, not once — and the
difference between ten minutes and an hour is whether they are adjusting eight
numbers per Bout or authoring them from blank.

**A seeded Multiplier is not a price.** `outcomes.priced_at` is null until an
admin saves that Bout at `/admin/events/[id]`, and a Bout with an unpriced
Outcome **cannot be opened**: nothing in the default table knows which fighter
is favoured, and ADR-0002 has no pool to self-correct a mispriced Outcome once
fans are committing Coins against it. The route says so, and so do two triggers
in `0005_multipliers_and_opening_bouts.sql` — the rule holds for a hand-written
`update`, and for a Bout inserted open, which has no Outcomes at all. `/admin/events` lists, per card, how many Bouts are still to price
and how many are open.

Method and round Multipliers are priced **conditionally on the winner the fan
picked**, because ADR-0004 multiplies them onto a winner pick rather than
treating them as a chain of their own: "Submission ×3.2" means "×3.2 given that
your fighter wins". That is what makes eight numbers enough where pricing every
combination by hand would be thirty.

A Multiplier is above 1 and no higher than 100, to two decimal places
(`outcomes_multiplier_pays`, and `MULTIPLIER` in `shared/pricing.ts`). At 1 a
correct Prediction returns exactly the Coins committed and below it a fan is
worse off for being right; the ceiling is the stuck key — 190 where 1.90 was
meant — and nothing above it could be paid anyway, since a combined Multiplier
is capped at ×100.

Two consequences worth knowing:

- **A re-imported card is a card to be priced again.** Re-import replaces the
  Bouts, and the Outcomes hung off them go with them.
- Repricing a Bout that is already open is deliberately allowed. A Prediction
  carries a *copy* of the Multiplier it was submitted at (ADR-0002), so
  correcting a number changes what the next Entry is offered and never an Entry
  that already exists.

A card imported before this migration has no Outcomes at all, and is refused an
opening by the same rule. Re-import it — which is allowed while every Bout on it
is still closed — and it comes back seeded.

### The card a fan reads

`/predictions` is the public card: every Bout of the upcoming Event in card
order, both fighters with their photos and records, the weight class, the
rounds, and what each answer pays. It is visible signed out — a visitor should
be able to see the game before deciding to join it — and served by
`server/api/predictions/card.get.ts`, which asks for no session at all.

**The card and the game are two models, on purpose.**

- `shared/fightCard.ts` is a lineup and nothing more: an Event, its Bouts, and
  two corners each. It imports nothing, and `test/unit/fight-card.test.ts`
  checks that no word from the game gets into it. A card is worth showing
  wherever a lineup is — a marketing page, an archive, a card read straight out
  of Prismic — and that only stays true while this half owes the game nothing.
- `shared/predictions.ts` is what TFC Predictions adds to a lineup: what each
  answer pays, where a Bout is, and when it locks.

They meet in exactly one place. `app/components/FightCard.vue` takes `card`
and an **optional** `predictions`; given nothing for the second, it renders the
fight and stops. `server/utils/publicCard.ts` is the only module that knows the
two halves came out of the same row.

How far that is actually held: the model's independence is checked directly
(`test/unit/fight-card.test.ts`), and a real card rendering with no Multiplier
anywhere on it is checked through the running server
(`test/server/bouts.test.ts`). The `predictions`-absent path itself is held by
`vue-tsc` and by the template's own guards rather than by a render — this repo
has no component-test setup, and adding one is a bigger decision than #10.

Four rules worth knowing about what a fan is shown:

- **Nothing is offered on a Bout nobody has opened.** Every Outcome arrives
  seeded from a fixed table, and a seeded number is not a price (ADR-0002) — so
  the Multipliers appear the moment a Bout opens, which is the moment an admin
  has priced every Outcome on it, and not before.
- **Only the first Bout has a countdown.** It is the one that locks
  automatically, at the card's scheduled start; an admin advances the rest as
  the card progresses (ADR-0006), so a countdown on them would be a promise the
  game does not make.
- **A Lock that has passed reads as locked**, whatever `bouts.status` still
  says, so a countdown reaching zero and the words beside it can never
  disagree. `locked` becomes a status of its own with #12, and `boutState` in
  `shared/predictions.ts` keeps saying the same thing when it does.
- **A card stays the card being shown for six hours after its scheduled
  start** (`A_CARD_RUNS_FOR` in `server/utils/publicCard.ts`). That number is a
  guess and is the one thing here somebody at TFC should look at: nothing in
  the schema yet says a card has finished, so an evening stands in for it until
  #12 and #14 make "every Bout is done with" a question that can be asked.

The page is exempt from the edge cache (ADR-0008) for staleness rather than
privacy — it is the same HTML for everybody, and a copy ten minutes old is a
Bout shown open that locked eight minutes ago. That is the easier of the two
reasons to forget, so `test/server/cache-boundary.test.ts` holds it.

A corner's photo and **record** are copied out of the `fighter` document at
import, so the card renders from one query rather than from Postgres and a CMS
together. A record is the one thing on a corner that a published fighter may
still be missing; like a fallback name's missing photo, that is a gap on the
card rather than a card that cannot be imported.

### Building and submitting an Entry

The same page is where a fan plays. Picking an answer turns the card
interactive — every Outcome on an open Bout is a button — and
`app/components/EntryBuilder.vue` holds the Entry being built: the Predictions
in it, the combined Multiplier, whether the ×100 cap has decided it, the Amount,
and the Coins it returns if it lands. `POST /api/predictions/entries` commits
it.

**A Prediction is one compound answer for one Bout**: a required winner, and
optionally a method and a round, whose Multipliers multiply onto the winner
(ADR-0004). Chaining is across *different* Bouts. Deepening one Prediction and
chaining another are the two different things they look like, and an Entry holds
**at most one Prediction per Bout**.

Three layers of the same rules, on purpose:

- **`shared/entries.ts`** is every rule that can be answered without asking
  anybody: what a Prediction may be made of, what the Entry returns, what the
  Amount may be. The panel uses it so a fan is never offered something that
  would be refused, and the route uses it on what actually arrives — the page is
  not what the server is holding. `priceOf` is the one function both sides
  price an answer with, so the Reward on the panel and the Reward in the
  database cannot come to disagree.
- **`server/utils/entries.ts`** adds everything only the database knows: is that
  Bout open, is that round one it offers, and — under a row lock — does the fan
  still hold the Coins.
- **`0007_entries_and_predictions.sql`** holds the ones worth holding, because a
  rule that lives only in a route handler is one refactor away from
  disappearing:

| Rule | Held by |
| --- | --- |
| One Prediction per Bout in an Entry (ADR-0004) | `predictions_one_per_bout_in_an_entry` |
| Between one and ten Predictions | `entries_hold_one_to_ten_predictions`, a deferred constraint trigger on both tables |
| The answer was one that Bout offered | `predictions_winner_is_offered`, `…_method_is_offered`, `…_round_is_offered` |
| No round alongside a Decision | `predictions_a_round_needs_a_finish` |
| The Bout is open | `predictions_are_made_on_open_bouts` |
| An Amount of at least 1 Coin | `entries_amount_is_committed` |
| No Coins a fan does not hold | `entry_commitments_are_within_the_balance` |
| One commitment per Entry | `coin_transactions_one_commitment_per_entry` |

The three `…_is_offered` keys are the interesting ones. A Prediction stores the
answer it gives — `red`, `ko_tko`, round 2 — rather than a reference to the
Outcome row, because settlement grades answers and a disqualification settles
the winner while leaving the method and round ungradable (#15). Each answer
still points at the Outcome that priced it, through a composite key on
`(bout_id, corner)`, `(bout_id, method)` and `(bout_id, round)`. So "round 4 of
a three-round Bout" is refused by Postgres, and the stored answer and the
Outcome behind it can never drift apart. Postgres does not check a key whose
columns include a null, which is exactly right for the two optional answers.

**A round only goes with a KO/TKO or a Submission.** ADR-0004 says so about a
Decision, and the same sentence rules out a round with no method at all: "it
ended in round 2" and "it went the distance" are not answers to the same
question, and nothing could grade the pair. The card disables the rounds until
a finish is picked, and says why.

**What is frozen, and what is worked out.** Each Prediction stores what each of
its three answers paid at submission (ADR-0002) — three numbers, not the one
they multiply out to, because they are graded separately. The Entry stores
neither the combined Multiplier nor the Reward: both are the product of what is
on its Predictions, and a stored copy would be a second answer to a question
that already has one. `potentialReward` in `shared/entries.ts` is where they
become a Reward, capped at ×100 and rounded to whole Coins, said once for the
panel, the API and the settlement that will eventually pay it.

**The Coins leave at submission**, as one `entry_commitment` row in the ledger
written in the same transaction as the Entry (ADR-0003). The route reads the
Balance `for update` first, which is what makes "an Amount above the fan's
Balance is refused" true of two requests arriving together: without the lock
both read a hundred Coins, both find themselves within it, and no constraint on
the ledger can catch it, because neither transaction can see the other's
uncommitted row. `test/server/entry-concurrency.test.ts` is the only file in
the suite that raises `DATABASE_POOL_MAX`, and that is why.

What a fan is told, and where: `ENTRY_MESSAGES` in `shared/entries.ts` is every
sentence, so the panel and the API refuse in the same words. A signed-out
visitor can build an Entry and is asked to sign in when they submit it; a fan
whose email is not confirmed is told before they start, because being told at
the last step, having built a Chained Entry, is the worst moment to learn it.

How far the tests carry this. Every rule, every refusal and every Coin movement
is driven through the API against a real Postgres in
`test/server/entries.test.ts`, and the rules Postgres holds are also written by
hand there so that a passing route is not the only evidence for them. What a
fan clicks is held by the unit tests over `shared/entries.ts` — building a
Prediction, the cap, the Reward — plus the server-rendered shell of the page;
the reactivity between them is held by `vue-tsc` and by those functions being
the same ones the server uses, because this repo still has no component-test
setup (see the card display section above).

### Pushing the model

`customtypes/event/` is the local copy of the model, written with the Prismic
CLI (see the Content model section above) and pushed to the repository. Nothing
renders an `event` document on the marketing site yet, and `prismic.config.json`
deliberately has no route for it: routes are validated by the Document API on
every fetch, and an entry for a type it does not yet recognise takes the whole
site down (see the same section).

## Email

Two messages, and no others: a link that confirms a fan's email address, and a
link that lets one who is locked out set a new password. Both are `better-auth`
flows; what this repo supplies is the transport, the copy, and the answer a fan
gets when a message does not go out.

- **`shared/emails.ts`** is what the messages say, and how long each link
  lasts. It lives in `shared` because that is the part of the tree
  `test/unit/vocabulary.test.ts` reads: an email is copy a fan reads like any
  page, and copy composed in `server/` would be the one piece nothing checks.
- **`server/utils/email.ts`** is how a message leaves. There is no queue and no
  retry — ADR-0009 rules out a second managed service, and a retry loop inside
  a request would hold a serverless function open waiting on somebody else's
  outage. A message that cannot be handed over is reported to the fan, whose
  retry is a button.

Setting a new password signs every session out, this one included, so a fan
lands back on the sign-in form: someone resetting a password has usually lost
control of the old one, and leaving the sessions it opened alive would defeat
the reset.

Without `RESEND_API_KEY` the messages are written to the server log, link and
all. That is the whole reason this was split from the accounts ticket: nobody
needs DNS access to work on signing up. Setting it makes `EMAIL_FROM` and
`BETTER_AUTH_URL` required, because sending for real means a verified sender
and links that point somewhere real.

`NODE_ENV` deliberately decides none of this. `nuxt build` settles it at build
time, so a built server reads "production" whoever is running it — the test
suite included. `server/db/client.ts` says the same about the connection pool.

### Before it can send: DNS

This is the part no code can do, and the part most likely to delay a launch.

1. Add the domain to Resend — a **subdomain**, `mail.tfcgeo.com`, never the
   apex. A sending subdomain keeps a deliverability problem away from the
   address people write to.
2. Publish the DNS records Resend shows: a `TXT` for DKIM, an `MX` and `TXT`
   for the return path, and a `DMARC` `TXT` on `_dmarc.tfcgeo.com` if the
   domain has none.
3. Wait for Resend to report the domain verified.
4. Set `RESEND_API_KEY`, `EMAIL_FROM` on that subdomain, and `BETTER_AUTH_URL`.

Until step 3, sending fails with Resend refusing the sender — which surfaces to
the fan as a retryable error and to the log with Resend's own message, rather
than as a silent success.

### What is not here

**Rate limiting on the two routes this ticket adds.** `POST
/api/accounts/verification-email` and `POST /api/accounts/password-reset` exist
so that a fan hears about a message that did not go out. They reach
`better-auth` through `auth.api` rather than through its HTTP handler, and so
do **not** inherit its rate limiting — three of either a minute per IP on the
routes they wrap.

What that is worth knowing about: neither is an open relay. The verification
route needs a session and only ever mails the address on it; the reset route
sends nothing at all for an address with no account. So the exposure is
volume — a fan's own inbox filled with TFC's own reset emails, and Resend
quota spent doing it — not mail to strangers. Rate limiting these belongs at
the route level, as ADR-0009 says, and has no ticket yet.

`/api/accounts/sign-up` has the same gap, and has had it since #4.

## Tests

```bash
pnpm test                   # everything
pnpm test --project unit    # just the fast ones
```

Two projects:

- **`unit`** — logic and configuration. No database, no Nuxt, milliseconds.
- **`server`** — the real Nitro server against a real Postgres, in a container
  started for the run. Nothing is mocked, so a passing test is a statement
  about what the deployed app does. Needs Docker.

Every server test starts from an empty database; `test/setup/database.ts`
arranges that, so no test has to remember to. Reach for `test/helpers` to
arrange state — `createUser()` and friends fill in anything the test is not
about, so what a test *is* about stays readable. `test/helpers/accounts.ts`
signs fans up and in over HTTP, the way the forms do; `createUser()` writes a
row directly and gives you a fan who cannot sign in. `signUpAdmin()` signs a fan
up and then grants the role with the same `update` this README tells a human to
run, so the documented way in and the tested way in cannot drift apart.

The server suite runs with `DATABASE_POOL_MAX=1`, the connection budget a
serverless function has, so code that needs a second connection while holding
one deadlocks here rather than in production (ADR-0010). One file raises it and
says why: `test/server/entry-concurrency.test.ts` submits two Entries at once,
and on a single connection the driver would queue the second behind the first —
which would make it pass whether or not the application had taken a lock at
all.

Email is not mocked either. `test/helpers/mailbox.ts` starts a stand-in for
Resend on a local port and `test/server/email.test.ts` points the app at it, so
a test that reads a link out of that mailbox has proved the app composed,
authenticated and sent a real request — which a stubbed `fetch` would only have
proved about the stub. That file pins its port, because `BETTER_AUTH_URL` is
what emailed links are built from and has to be configuration the server starts
with rather than something discovered from it afterwards.
