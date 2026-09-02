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

`route-rules.ts` puts `isr: 600` over `/**`, so on Vercel a page is stored at
the edge for ten minutes and then refreshed *behind* the next request — the
visitor at minute eleven still gets the old HTML. Each region caches
separately. That, not Prismic, is why an edit can seem not to land.

A Prismic webhook purges the pages on publish instead. Set two variables in the
Vercel project, both `openssl rand -hex 32`:

- `NUXT_PRISMIC_WEBHOOK_SECRET`
- `NUXT_REVALIDATE_BYPASS_TOKEN` — read at **build** time as well as at
  runtime, so changing it takes a redeploy, not just a restart.

Then in Prismic, under *Settings → Webhooks*, add one pointing at
`https://<the site>/api/prismic/revalidate` with that secret. "Trigger it now"
answers `{"ok": true, "type": "test-trigger"}` and purges nothing.

A publish re-renders every page the site serves from Prismic, not just the
changed documents — the footer is on every page and fighters appear in three
slices, so the pages one publish affects cannot be worked out from the document
ids Prismic sends. `server/utils/prismic-paths.ts` maps types to paths, and **a
new type with a page of its own has to be added there**.

Two things the webhook does not cover: unpublishing a document (it is gone from
the query, so its page waits out the ten minutes), and a misconfigured or
uncalled webhook. Both fall back on the expiry, so a mistake here is slow, not
broken.
