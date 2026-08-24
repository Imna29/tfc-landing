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
Prismic repository until it is pushed with Slice Machine, and until it is, the
content team has nothing to edit. `prizes` and `contest_rules` are in that state
now: the pages render their built-in content and wait.

Pages are written to survive that gap rather than to depend on it. A singleton
that has never been created reads as a missing document, not an error, and
`/contest-rules` publishes the ADR-0007 eligibility constraints from
`app/utils/eligibilityRules.ts` until someone authors better wording.

`test/unit/vocabulary.test.ts` holds the naming rule from `CONTEXT.md` over
every file that carries copy: no sportsbook vocabulary, anywhere a fan can read
it.

## Database

Postgres, accessed with Drizzle. Copy `.env.example` to `.env`: `DATABASE_URL`
points at your local Postgres, and `BETTER_AUTH_SECRET` is any long random
string (`openssl rand -base64 32`) — changing it signs every fan out.

```bash
createdb tfc                # or: docker exec <postgres> createdb -U postgres tfc
pnpm db:migrate             # apply migrations
```

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
own.

A handler still calls `requireAdmin(event)`, but not to be let in: that already
happened. It is how the handler learns *which* admin is acting, for the "who did
this, and when" that lock and result records have to carry.

`/api/admin/me` is the shape to copy for a new admin endpoint, and
`test/server/admin.test.ts` the file to add its tests to.

### Granting the admin role

There is no route, no form and no script that grants it. `role` is not a field
`better-auth` knows about, so nothing it serves can read or write the column and
a sign-up asking for `"role": "admin"` is a request nothing acts on. The only
way in is SQL, run by hand against the database:

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
one deadlocks here rather than in production (ADR-0010).

Email is not mocked either. `test/helpers/mailbox.ts` starts a stand-in for
Resend on a local port and `test/server/email.test.ts` points the app at it, so
a test that reads a link out of that mailbox has proved the app composed,
authenticated and sent a real request — which a stubbed `fetch` would only have
proved about the stub. That file pins its port, because `BETTER_AUTH_URL` is
what emailed links are built from and has to be configuration the server starts
with rather than something discovered from it afterwards.
