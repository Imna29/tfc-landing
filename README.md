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
once. Everything else is `better-auth` under `/api/auth`.

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
row directly and gives you a fan who cannot sign in.

The server suite runs with `DATABASE_POOL_MAX=1`, the connection budget a
serverless function has, so code that needs a second connection while holding
one deadlocks here rather than in production (ADR-0010).
