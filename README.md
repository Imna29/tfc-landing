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

## Database

Postgres, accessed with Drizzle. `DATABASE_URL` is the only variable needed to
connect; copy `.env.example` to `.env` and point it at your local Postgres.

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
about, so what a test *is* about stays readable.

## Prismic and the edge cache

Pages are edge-cached. `route-rules.ts` puts `isr: 600` over `/**`, so on Vercel
a page is stored for ten minutes and then refreshed *behind* the next request:
the visitor who arrives at minute eleven is still served the old HTML, and only
the one after that sees the new. Each edge region has its own copy, so a publish
can look like it landed in one place and not another. Nothing is wrong with
Prismic when that happens — the page just has not been rebuilt yet.

A Prismic webhook fixes it, by purging the pages on publish instead of waiting
for them to expire. Two variables, both set in the Vercel project:

```bash
openssl rand -hex 32   # NUXT_PRISMIC_WEBHOOK_SECRET
openssl rand -hex 32   # NUXT_REVALIDATE_BYPASS_TOKEN
```

`NUXT_REVALIDATE_BYPASS_TOKEN` is read at **build** time as well as at runtime —
it is baked into every ISR route's prerender config — so it takes a redeploy to
change, not just a restart.

Then in Prismic, under *Settings → Webhooks*, add one pointing at
`https://<the site>/api/prismic/revalidate` with `NUXT_PRISMIC_WEBHOOK_SECRET`
as its secret. "Trigger it now" answers `{"ok": true, "type": "test-trigger"}`
if the URL and the secret are right, and purges nothing.

On a real publish the endpoint re-renders every page the site serves from
Prismic, not just the documents that changed. It has to: the footer is on every
page, fighters appear in three different slices, and Prismic reports document
ids rather than URLs, so the pages a publish affects cannot be worked out from
what it tells us. `server/utils/prismic-paths.ts` holds the map from document
types to paths — **a new Prismic type with a page of its own has to be added
there**, or that page will only ever refresh on the ten-minute timer.

One edit the webhook cannot speed up is *unpublishing*: a document that is no
longer live is not in the query the endpoint runs, so its path is not among the
ones purged and the page serves its old HTML until the ten minutes are up.

The ten minutes remain the backstop. If the webhook is misconfigured, or Prismic
never calls it, the site is stale for that long and no longer; the webhook only
makes it faster, so a mistake here is slow, not broken.
