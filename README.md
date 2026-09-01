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
design pass. The live lock console at `/admin/console` is the one screen that
gets one, because it is the only one used cageside on a phone.

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
Both of its columns are derived, the `updated_at` beside the total included: it
is the moment of the fan's last Coin Transaction in the Season, because that is
what a Rank breaks a tie by. See the leaderboard section.

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

`POST /api/admin/seasons/<id>/close` is the other end of it — see **Closing a
Season, and rolling into the next** below, under the leaderboard.

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

Every number in that table stands for its own answer outright (ADR-0014):
"Submission ×4.05" means ×4.05 if the Bout ends that way, whoever wins it. What
each number is worth, why the winner Question carries a thinner margin than the
other two, and why **Decision went up** from ×2.00 to ×2.65 — the cell an admin
is most likely to "correct" back — are argued where they can be read beside the
numbers, in the docblock over `DEFAULT_MULTIPLIERS`.

What is worth knowing here is that the round Multipliers come from **two rows
keyed by the rounds the Bout is scheduled for** — three and five, the two
formats TFC books. Round 3 ends a three-round Bout and catches everything still
standing; on a five-rounder it is a middle round with two more behind it. Not
the same question, so not the same number: ×5.70 against ×8.90. A Bout booked
over any other number of rounds seeds from the five-round row, and a round past
its fifth repeats its deepest number rather than the table inventing one.

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

### Locking a Bout, and the backstops behind the admin

A **Lock** is the moment a Bout stops taking Predictions, and ADR-0006 makes it
per Bout rather than per card: a fan can still predict the main event while the
opener is being fought. That is the engagement case for the whole product, and
it is bought with an admin at a keyboard for the length of every event — an
admin who is also watching the fights.

So the automatic backstops are not enhancements. **A Bout still taking
Predictions while it is being fought is the one failure that lets a fan win with
certainty**, and an admin who forgets to lock one is the expected case, not the
exceptional one. There are three:

1. **The Bout fought first locks when the card reaches its scheduled start.**
2. **Entering a result locks that Bout** if it is somehow still open. Result
   entry itself is #14, so what exists here is the seam: `lockBout` takes the
   connection to run on, and #14 must call it inside the transaction it settles
   from, so grading, moving the Coins and closing the Bout can never be half
   done. Until #14 lands this criterion is only as true as that seam.
3. **The sweep**: every Bout still open `LOCK_SWEEP_HOURS` after the scheduled
   start — six by default — locks regardless.

**Nothing schedules those.** ADR-0009 and ADR-0010 leave a serverless function
with no cron beside it, so `applyAutomaticLocks` in `server/utils/locks.ts` is
run by the requests that care where a Bout is: the public card, an Entry being
submitted or cancelled, the listing a fan reads their own Entries in, and the
admin area. A card nobody is looking at locks the moment somebody looks. Two
things make that honest rather than a fudge:

- **A Lock is dated at the moment it fell due**, not the moment the row was
  written — otherwise a fan asking why their Bout closed would be answered with
  a time that has nothing to do with them.
- **The refusal does not wait for the row.** `automaticLock` in
  `shared/locks.ts` is asked directly while an Entry is priced, so a Bout past
  its moment is refused whether or not anything has been written down yet. The
  sweep is what makes the state a fact and the audit log an answer.

An admin locks a Bout with `POST /api/admin/bouts/[id]/lock`, from
`/admin/events/[id]` at a desk and from the cageside console below. It names a
Bout, which is both things ADR-0006 asks for: advancing the Lock as a
card progresses is locking the next Bout on it, and closing one early — a
fighter withdrew — is locking that Bout and leaving the card alone. It is also
why a double-tap in a dark arena is safe: the second press asks about the same
Bout and is told it has locked.

**A Lock is final.** There is no route that reopens a Bout and there is not
going to be one: `a_locked_bout_is_never_reopened` refuses it in Postgres, so a
hand-written `update` is refused too.

**Every Lock is recorded**, in `bout_locks`: when, how, and which admin where
one acted. The log is what answers a fan who thinks their Bout closed early, so
it is held to be complete rather than remembered —
`locked_bouts_are_recorded` is a deferred constraint trigger that refuses any
transaction leaving a Bout locked with no record, or a record with no Lock, and
`bout_locks_are_append_only` refuses rewriting one afterwards for the reason
ADR-0003 gives about the Coin ledger. An admin reads it down the card at
`/admin/events/[id]`, beside the fight it belongs to.

### The live lock console

`/admin/console` is the screen an admin actually uses cageside: the card being
fought, in the order it is being fought, and one control that locks the next
Bout on it. It is the only part of the admin area with a design pass, and
ADR-0011 says why — everything else is a form somebody sits down in front of
before a card, and this is used on a phone, one-handed, in a dark arena, by
somebody who is also watching the fights. Nothing here makes locking *possible*;
all of it already worked. It makes locking quick.

**There is no card in the URL.** `cardBeingFought` in `server/utils/events.ts`
says which card the game is on — the next Event until it starts, then the one
being fought until the backstop behind it has closed everything on it — and that
is the same answer the public card is built from, so the card a fan is
predicting on and the card an admin is locking can never be two different
Events. A card an admin has to go and find first is a card they are finding
while the next Bout walks out.

Four decisions in the page are about a thumb in the dark:

- **One control, and it names one Bout.** `nextToLock` in `shared/console.ts`
  decides which — the open Bout fought first — and it is never a choice. A
  screen of buttons, one per fight, is a screen where the wrong one gets
  pressed. A Bout nobody opened is passed over, and so is one whose own
  automatic moment has passed but whose Lock nothing has written down yet.
- **The control is at the bottom of the screen and the height of a thumb**, on a
  page whose layout is `false` so that the site header and footer do not take a
  third of a phone screen — and so that the footer's Prismic round trip is not
  on an arena connection. The card scrolls above it.
- **It rests for four seconds after every press**, showing a statement where the
  button was and no button at all. The control moves to the next fight the
  moment a Lock lands, so an accidental double-tap would otherwise close two
  Bouts, the second of them a fight nobody has finished. The route already
  refuses a second press on the *same* Bout, because the control names a Bout by
  id; the rest is what stops a second press reaching the *next* one. A refused
  press rests too — every refusal it can meet is the card having moved
  underneath it, which moves the control just the same.
- **Before the card has started, it asks twice.** `hasStarted` in
  `shared/console.ts` arms it. During the evening this screen is for, closing
  the Bout being fought is one press; before the scheduled start the same
  control would close a fight days out from being fought, on the one screen
  built to be pressed without looking. An early Lock is still an admin's to make
  cageside — a card running ahead of schedule is exactly the override ADR-0006
  gives them — it just costs a second press. Where an early Lock is the whole
  point rather than a hazard, a fighter withdrawing a week out, it is one press
  at the desk on `/admin/events/[id]`.

The console re-reads itself every fifteen seconds as well as after every press,
because an admin is not the only thing that locks Bouts: the backstops fall due
while nobody is looking, and a second admin may be locking from a second phone.
Each read applies the Locks that have fallen due, so opening the console is also
what closes the Bout a sweep was waiting on. Every Bout that has locked says
how — "Locked automatically when the card started", or an admin's username —
which is `lockLine` in `app/utils/locks.ts`, the same line `/admin/events/[id]`
shows, on the screen where the locking is happening. A Lock that has fallen due
with nothing written down yet says what it is about to be recorded as, rather
than saying a Bout has locked and refusing to say why at first bell. The countdown in the header is the sweep: how long until everything
still open locks regardless.

The page is `app/pages/admin/console.vue`, it reads
`GET /api/admin/console`, and it locks through the same
`POST /api/admin/bouts/[id]/lock` every other screen uses. Once the sweep behind
a card has passed, the card leaves the console: nothing on it can be open, so
there is nothing left to lock, and a Lock is read back afterwards at
`/admin/events/[id]` beside the fight it belongs to.

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
  disagree. The row catches up on the next request (see
  [Locking a Bout](#locking-a-bout-and-the-backstops-behind-the-admin)), and
  `boutState` in `shared/predictions.ts` says the same thing either side of it.
- **A card stays the card being shown until its sweep has passed**
  (`sweepWindow()`, six hours by default). Past that no Bout on the card can be
  open, so there is nothing left on it to predict. One number rather than two
  that happened to agree: a card that vanished while its Bouts were still
  taking Predictions would be a card a fan could submit into and no longer see.

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
panel, the API and the settlement that will eventually pay it. The cost of that
is worth stating: the cap and the rounding are *rules*, applied wherever a
Reward is worked out, rather than numbers frozen onto the Entry — so changing
either changes what every unsettled Entry pays. That is a decision to take
between Seasons rather than during one, and `COMBINED_MULTIPLIER_CAP` says so
where somebody would change it.

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

### Cancelling an Entry

A fan changes their mind, usually because the card changed after they
submitted. `POST /api/predictions/entries/:id/cancel` takes the Entry back: its
status becomes `cancelled` and its Amount returns to the Balance in full, as one
`entry_refund` row in the ledger. The commitment stays where it is — the ledger
is append-only (ADR-0003), and what happened is that Coins were committed and
then came back.

**An Entry can be cancelled only while every Bout in it is still open.** That is
the whole feature, and it is ADR-0002's bill rather than a courtesy:
Multipliers are frozen at submission, so an Entry that could be withdrawn at any
point would let a fan wait for one to move, or fish for a pricing mistake and
back out of it. It is worth as much as "Predictions are made on open Bouts" — a
fan who could take an Entry back after a Bout closed could take it back knowing
how that Bout was going.

`GET /api/predictions/entries` is what the fan reads before they press anything:
every Entry they hold this Season, each Prediction carrying where its Bout
stands and the moment it locks by itself. `cancellationOf` in
`shared/entries.ts` turns that into a button or a sentence, and it is the same
function the route decides with — so the panel stops offering to cancel at the
instant the first Bout in an Entry locks, rather than at the next time somebody
asks the server, and a fan who presses it in that last second is refused in the
words already on the page. This is not the Entry history: that goes back through
every Season and grades each Prediction of a chain, and is on the profile — see
the section below.

The same layers as submission, and the same reason for each: the page asks
while the fan is looking, the route asks again of what arrived, and Postgres
holds the ones worth holding.

| Rule | Held by |
| --- | --- |
| Every Bout in the Entry is still open | `entries_are_cancelled_while_every_bout_is_open` |
| An Entry is cancelled out of Open, once, and stays cancelled | `an_entry_is_cancelled_once_out_of_open` |
| An Entry that was made whole has one refund standing, for its whole Amount, and one that was not has none | `entries_are_refunded_in_full`, a deferred constraint trigger on both tables |
| A refund returns Coins, for an Entry | `coin_transactions_refund_returns_coins` |

**Two requests cancelling the same Entry.** `cancelEntry` takes the Entry row
`for update` before reading anything about it, which is what makes "cannot be
cancelled twice, or double-refunded" true of two requests in flight at once: the
second queues behind the row and reads the status the first one left. Without it
both would find the Entry open and every Bout open, and the fan would be
refunded twice — with the unique index the only thing left to notice, after one
of the two had already told a fan it worked.
`test/server/entry-concurrency.test.ts` fires both.

A cancelled Entry is not deleted, and settlement never touches it: grading reads
only Entries that are still `open`, so a Bout it once predicted on settles
around it. It stays in the fan's listing with its status, because it is Coins
that moved and a decision the fan made. A correction does not touch it either,
for a stronger reason: nothing in it was ever graded against a result.

### Correcting a result that was entered wrong

Results are typed in by somebody watching a fight, and the fights are decided in
a cage at one in the morning. By the time anybody notices the winner went down
the wrong way round, Rewards are in Balances that fans have seen and some of
those Coins are committed to other Entries. `POST
/api/admin/bouts/:id/correction` is the fix, and it is the scenario ADR-0003
built the whole ledger for: **it reverses the Coin Transactions the first result
wrote and grades every Entry on the Bout again.** With a mutable balance column
the only available fix would be quietly rewriting people's totals with nothing
to say it happened, which is indefensible the first time a fan disputes theirs
in public.

Nothing is edited and nothing is deleted. A Reward paid on the wrong result
stays where it is; an `entry_reversal` row stands beside it naming it and worth
exactly the negative of it; the re-graded Reward stands beside that. A fan who
saw 120 Coins and now sees 80 can be shown all three. The Bout is not re-opened,
re-locked or unsettled — what was wrong is the record of the fight, not the fact
that it is over.

**Only what is no longer true moves.** An Entry whose grade has not changed is
left exactly as it is, ledger rows included: reversing and re-paying an
identical Reward would be two movements in a fan's history that add up to
nothing having happened, and on a well-attended card that is several hundred
fans. What is compared is the Reward the Entry would be paid *now* against the
one standing beside it, not the status alone — a disqualification corrected to a
KO/TKO leaves an Entry Won either way and pays a different number (ADR-0005).

`bout_results` is updated rather than replaced: it is what every Prediction is
graded against wherever one is shown, and a correction that removed the row
would have to unsettle the Bout, which `a_locked_bout_is_never_reopened`
refuses. What it used to say goes to `bout_result_corrections` — the ending, who
entered it, who corrected it, and when — which is the answer to the fan whose
Entry was Won yesterday and is Lost today. The admin area lists it under the
fight.

| Rule | Held by |
| --- | --- |
| A reversal is worth the negative of the movement it names, for the same fan and Entry | `a_reversal_undoes_the_row_it_names` |
| Only a Reward or a refund is reversed, and a reversal takes Coins back | the same trigger, and `coin_transactions_reversal_takes_coins_back` |
| A movement is taken back once | `coin_transactions_one_reversal_per_row` |
| Only a reversal names another row, and every reversal names one | `coin_transactions_a_reversal_names_what_it_undoes` |
| An Entry that has Won holds one Reward standing; every other Entry holds none | `won_entries_are_rewarded_once`, a deferred constraint trigger on both tables |
| An Entry made whole holds one refund standing, for its whole Amount | `entries_are_refunded_in_full`, the same shape |
| A Result that was changed says what it said before | `corrected_results_are_recorded` |
| The log of what a Bout used to be recorded as is never rewritten | `bout_result_corrections_are_append_only` |

#14's `coin_transactions_one_reward_per_entry` is gone, and its replacement is
the interesting part of this ticket. It was a partial unique index — "one
`entry_reward` row per Entry" — which is a proxy for the property that actually
matters: an Entry cannot end up holding two Rewards. A correction meets that
index the moment it re-grades an Entry it has just reversed the Reward of. So
the property is now stated directly, as a rule counting the Rewards *standing* —
the ones no reversal names — which an index cannot express and which says the
other direction too: an Entry that is not Won holds no Reward at all. That is
the failure a correction would otherwise leave behind: the status moved and the
Coins forgotten.

**A Balance can go below zero, and that is the correction working.** A fan paid
on a wrong result may have committed those Coins to other Entries before anybody
noticed; taking the Reward back leaves them owing. This is why
`entry_commitments_are_within_the_balance` holds only *commitments* to the
Balance rather than the ledger as a whole — so that a reversal is never the row
refused. The alternative is leaving Coins in circulation that were never won.

Two admins correcting the same Bout queue on the `bout_results` row, taken `for
update` before anything is read; the Entries are taken under the same kind of
lock settlement uses, and for the same reason. `test/server/corrections.test.ts`
is the suite, and it asserts the ledger trail as hard as it asserts the
statuses.

### The profile: where a fan stands, and everything they predicted

`/profile` is the page a fan comes back to. It answers three separate requests
and they are separate on purpose:

- **`/api/accounts/me`** is who is signed in, shared with every page that asks.
- **`/api/coins/standing`** is the Season being played, the fan's Balance in it,
  and their Rank. It sits beside `/api/coins/balance` rather than inside it
  because the two are asked at different rates and cost different things: the
  Balance is in the site header on every page a fan opens and is one indexed
  row, and a Rank orders every fan in the Season. Folding the second into the
  first would charge every page for it.
- **`/api/predictions/history`** is every Entry the fan has ever committed,
  filtered.

**A Rank is an ordering of the materialised Balance and nothing else**
(`server/utils/standings.ts`), and `CONTEXT.md` defines it. Ties are broken by
who reached the total first —
the moment a fan's materialised Balance last moved — and then by the fan's own
id, because two fans granted their starting Coins by the same statement did
reach a hundred at the same instant and an ordering still has to answer. Without
that, two fans on the same Coins swap places between one page load and the next.
It is one statement that always answers a row: the count is of the Season and
the Rank is of one fan in it, and asking separately would let a fan be told they
are 12th of 11. The leaderboard is the same ordering read a page at a time —
`BY_STANDING` is written once and embedded in both — and the section below is
about that page.

**Nothing on this page is stored.** The combined Multiplier, the Reward and each
Prediction's own grade are worked out from the Predictions and the Results every
time the page is read. That is ADR-0013 applied to a whole page: a history that
quoted a Reward written down beside the Entry would be a second answer to a
question settlement has already answered, and the day they differed nothing
could say which was right.

`entryAsItStands` in `shared/results.ts` is the arithmetic — `settledPrice` over
every answer, `potentialReward` over the chain they make, which is `rewardFor`
in `server/utils/results.ts` in the same order. It is one function because a fan
can have it on the screen twice: the listing beside the card and the Entry
history both price the same Entry, and two copies of those four lines would be
two Rewards on two pages. `shared/history.ts` adds only the reading — `readEntry`
grades each answer beside it, `bySeason` groups, `rewardOf` decides whether the
Coins beside an Entry are a promise, a payment, an Amount coming back, or
nothing at all.

The number a **Lost** Entry shows is worth a sentence. It is derived exactly
like every other Entry's, so on a dead chain it is a counterfactual — what the
Entry was going for, priced against what happened. `HISTORY_MESSAGES.lost` names
it as one, because a bare "No Reward" under a Multiplier reads as Coins the game
decided not to hand over.

**Every Prediction says where it stands, whatever the Entry did.** A chain that
is already Lost still shows how the Bouts already fought went and that the rest
are still to come. That is #14's "remaining Predictions are still graded for
display" kept where a fan can actually see it: "I was one Bout away" is the most
engaging sentence on this page, and it works because a grade is derived from the
Bout's Result at read time rather than written onto the Prediction when the
Entry was graded — so a Bout that settles *after* the chain died still shows its
true grade.

**The page opens on the whole history**, grouped by Season with the current one
first. Narrowing is the fan's move, not the page's opening position: a status
filter over one Season would answer "find my wins" with some of them, and the
grouping is what stops the old Entries drowning the current ones. `bySeason`
does the grouping; `entries_by_fan_over_time` — `(user_id, submitted_at desc)`,
added in `0013_profile_and_entry_history.sql` — is what keeps that affordable
when history is kept forever, because `entries_by_fan` leads with the Season
this query deliberately does not narrow to.

**The filter is in the URL**, read by `historyFilter` in `shared/history.ts` and
answered back on `filter` so the controls and the listing cannot disagree. It is
handed the Seasons the fan has actually played, which is what keeps a Season id
somebody typed into a URL from reaching Postgres as a cast: an id that is not
one of theirs is answered with the whole history, the same as a real Season they
never played, because that is the honest reading of both. Nothing here is ever
refused — a filter is a way of looking at a page, and a page that returned an
error over a word in a query string would be worse than one that showed
everything.

**One fan's history is one fan's.** There is no parameter naming a fan on either
route: the answer is always `requireFan`'s, so there is nothing to send that
would ask for somebody else's. Both routes and the page are exempt from the edge
cache (ADR-0008), and `/PROFILE` is a 404 rather than a second spelling that
could miss the exemption (ADR-0012).

Real names never appear. `shared/fan.ts` has no field for one and no endpoint
returns one — see ADR-0007 and the Accounts section.

### The leaderboard: the top ten, and the row under it

`/leaderboard` is the public scoreboard of the Season being played, and
`/api/leaderboard` is the whole of it: the ten fans holding the most Coins, and
the row of whoever is reading it. A visitor with no account is answered the top
ten rather than a 401, because sizing up the competition is how somebody
decides to join it.

**The signed-in fan's own row is pinned below the top ten at their true Rank,
even at 340th.** That is the point of the page: a leaderboard a fan can never
appear on stops being motivating after one event, and "how far am I from the
top?" is a question ten rows cannot answer. A fan already inside the top ten is
marked in it instead — `Leaderboard` in `shared/standings.ts` carries `you` only
when `top` does not, so showing the same fan twice is not a mistake the page can
make. `whereYouStand` tells apart the four different things an empty `you`
means: a visitor, a fan in the top ten, a fan the Season has granted nothing,
and no Season at all.

**It is one statement** (`leaderboardOf` in `server/utils/standings.ts`), and one
that reads the materialised Balance rather than adding the ledger up — the
aggregate ADR-0003 put `balance_cache` there to avoid, and the one ADR-0009
rules out putting Redis in front of. `BY_STANDING` is the ordering, written once
and embedded in both this and the profile's `standingIn`, so that the Rank a fan
reads on their own page and the Rank they read here cannot come to disagree:
Balance, then who reached that total first, then the fan's own id. The new index
`balance_cache_by_standing` — `(season_id, balance desc, updated_at, user_id)`,
added in `0014_season_leaderboard.sql` — is that order per Season, so reading the
top of one is an index scan rather than a sort of everybody in it. The primary
key leads with the Season too, but it answers "what does this fan hold?" and
cannot answer "who holds the most?".

Two details in that ordering are worth knowing, because both fail silently.
**`nulls last` is written into `BY_STANDING` deliberately**: Postgres orders a
`desc` column nulls first and a btree index declares them last, and the planner
matches an ordering to an index including that flag — so `order by balance desc`
alone matches nothing and sorts the whole Season, on a column that is `not null`
and could never have answered differently either way. Measured on 200,000 rows:
a sequential scan and a sort of all of them, against an index-only scan with the
two words written in.

And **`balance_cache.updated_at` is derived, like the total beside it**. It is
`max(created_at)` over the fan's Coin Transactions in the Season, taken in the
same statement as the sum (`materialiseBalances`), never the clock at the moment
the row was written. It is what breaks a tie, so stamping it with `now()` meant
`rebuildBalanceCache` handed back the same Balances with every tied fan in a new
order — a leaderboard reshuffled by a repair that is supposed to change nothing.
`test/server/leaderboard.test.ts` rebuilds the cache mid-test and asserts the
page is unchanged.

Asking for the ten and the eleventh row in one statement is what stops them
being two readings taken a moment apart — a fan shown under a top ten they are
already in. **Entries played is counted per row shown**, at most eleven index
lookups on `entries_by_fan`, rather than for every fan in the Season only to
throw all but eleven away. A cancelled Entry is not one a fan played: its Coins
are already back in the Balance, so the ranking excludes it by arithmetic, and
this column has to exclude it by asking.

The page is **public and personalised at once**, which is exactly the shape
ADR-0008 warns about: the CDN keys on the path and ignores the cookie, so a
stored copy is one fan's Rank served to everybody who follows them onto it.
`route-rules.ts` exempts `/leaderboard` and server-renders it per request, and
`test/server/cache-boundary.test.ts` puts a cache in front of a real server and
proves the next visitor does not get the last one's row.

Only usernames leave the route. There is no column on the answer a real name
could travel in, and no endpoint anywhere that would return one (ADR-0007).

### Closing a Season, and rolling into the next

`POST /api/admin/seasons/<id>/close` ends a Season, and it is the
highest-consequence button in the admin area after entering a result. It does two things in one
transaction: marks the Season closed, and **freezes its final standings** into
`final_standings` — every fan's closing Balance and the Rank it put them at.
That table is the record TFC awards Prizes from (ADR-0007), so it is write-once:
a `final_standings_are_frozen` trigger refuses every `update` and `delete`, and
`a_closed_season_is_never_reopened` refuses the `update` that would put the
Season back. Both are hand-written in `0015_closing_a_season.sql` for the reason
the ledger's trigger is, and only `test/server/seasons.test.ts` will notice if
either goes missing.

**The Rank is stored rather than re-derived, and that is the point.**
`freezeFinalStandings` writes it from `BY_STANDING` in the same statement that
reads the Balances, so the frozen order is the order the leaderboard was
actually showing. A snapshot ordered by Balance alone would hand a Prize to
whichever of two tied fans Postgres returned first; one re-derived later would
be reading a cache a `rebuildBalanceCache` could have re-dated, since
`balance_cache.updated_at` is the tie-break. `final_standings_one_fan_per_place`
is Postgres refusing a record that came out of a window with no tie-break in it.

**A Season will not close over a Bout that is `open` or `locked`**, and the
refusal names every one of them — which card, where on it, who is fighting — so
an admin can go and finish them. Those two states are exactly "Coins could still
move here": an open Bout is taking Entries, and a locked one has Entries riding
on it with no Result to grade them. A Bout still `closed` deliberately does
*not* block, because it took no Predictions, holds nobody's Coins, and can never
settle at all — entering a result on a Bout nobody opened is refused outright, so
blocking on one would leave the Season open forever with no route that could
clear it. A card nobody played is taken off by importing it again (ADR-0001).

`outstandingBouts` is asked **inside the closing transaction**, and only there.
Asking in the route first so the sentence could name them, and again underneath
so the decision was sound, would be two reads that could disagree; one read that
both decides and writes the sentence cannot. At Postgres's default isolation it
sees every settlement committed by the moment it runs, so a result entered while
an admin was reaching for the button refuses the close rather than being closed
over.

Closing resets nothing. It leaves every fan holding what they finished on, in a
Season nobody is playing — the leaderboard says so in words, `/api/coins/standing`
answers nulls, and no Entry can be committed. **Opening the next Season is what
resets them**, by the same `grantStartingCoins` that has always run: one
`season_grant` row per fan, worth 100, in the new Season. There is no reset path
and no balance being written anywhere — ADR-0003 again, a Balance is what the
ledger adds up to. Entry history is untouched and stays grouped by Season, which
is the whole of "the reset is to the economy, not to the record".

One consequence worth knowing: **a correction entered on a closed Season's Bout
moves the ledger and never the frozen standings.** That is what "frozen" means
rather than a gap — the standings are what the Season finished as, the ledger is
what turned out to be true, and both are kept and readable. `test/server/seasons.test.ts`
corrects a result after the rollover and asserts the record does not follow it.

### What a Season finished as

`/standings/<season>` is the frozen record, one page per Season. There is
deliberately no `/standings` index page: `GET /api/standings` answers every
Season that has final standings, newest first, and the **leaderboard** renders
that list at the bottom of itself — which is where somebody looking for last
Season's standings actually goes, and where it matters most, because between
Seasons the table above it is empty and says so.

It is a second surface rather than `/leaderboard` with an id on it, because
`CONTEXT.md` keeps the two words apart: the leaderboard is the Season being
played, and a Season that has ended has final standings. The difference is real
— these rows come out of `final_standings` rather than out of the materialised
Balance — and a Season still being played answers 404 at `/standings/<its id>`,
because "final" is what it does not have yet.

Like the leaderboard, the page shows the top ten and the reading fan's own row
wherever they finished. Every fan the Season ranked is in `final_standings`, not
just the ten — that is what makes it evidence — but nothing renders the whole
table today. A hall-of-fame page is the ticket that would.

The table is one component, `SeasonStandings.vue`, rendered twice. Everything
that differs between a Season being played and one that is over is a sentence,
so the vocabulary is a parameter (`StandingsWords`): `LEADERBOARD_MESSAGES` is
the present tense and `FINAL_STANDINGS_MESSAGES` the past. Nothing on a closed
Season fills up, nobody climbs it, and a fan who is not in it will not be.

It is public and personalised at once, exactly like the leaderboard, so
`route-rules.ts` exempts `/standings` and `test/server/cache-boundary.test.ts`
proves a real server does not serve one fan's final Rank to whoever asks next.
This is the easier of the two to forget, because it arrived on a path of its own
after ADR-0008 was written.

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
