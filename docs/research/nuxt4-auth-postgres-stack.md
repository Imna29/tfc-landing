# Auth + Postgres + deployment shape for the TFC prediction market

Research note. Written 2026-08-24. All version numbers and dates verified against the npm
registry, GitHub releases, or first-party docs on that date — see [Sources](#sources).

**Repo state at time of writing** (verified locally):

- `nuxt` 4.4.6 (latest published is 4.5.2, 2026-08-05), `vue` 3.5.35, `vue-router` 5.1.0,
  `nitropack` 2.13.4 (resolved transitively), `h3` 1.15.11, pnpm 12.0.0-beta.4, Node v26.7.0,
  `"type": "module"`.
- Content: `@nuxtjs/prismic` 5.3.0 + `@prismicio/client` 7.21.8.
- `nuxt.config.ts` `routeRules`: `'/**': { isr: 600 }`, `'/slice-simulator': { ssr: true }`,
  `'/slice-simulator/**': { ssr: true }`.
- **No `server/` directory, no database, no auth, no test runner.** Lint/format is oxlint 1.67 +
  oxfmt 0.52.
- **No deployment config of any kind.** I searched the working tree and the full git history
  (`git log --all --diff-filter=A --name-only`) for `vercel.json`, `netlify.toml`, `wrangler.*`,
  `Dockerfile`, `.github/`, `fly.toml`, `railway.*`, `Procfile`, `nixpacks.*` — **zero hits**. The
  only YAML ever committed is `pnpm-lock.yaml`. There is no CI. The hosting target is genuinely
  undecided, and the deployment is presumably being done by hand or via a dashboard-linked Git
  integration that leaves no repo artifact.

---

## Recommended stack

1. **Auth: `nuxt-auth-utils` 0.5.30** — sealed-cookie sessions, scrypt password helpers, and it is
   the *only* option that already knows about Nitro's route cache (it skips server-side session
   fetch on cached routes and rehydrates on the client). Everything else fights the ISR setup.
2. **…unless you want email verification + password reset for free — then Better Auth 1.7.1.** It
   ships those flows, DB-backed sessions, rate limiting and CSRF/origin checks; you pay with a
   4-table schema and no cache-awareness (you must set `loadStrategy`-equivalent behaviour yourself).
3. **ORM: Drizzle (`drizzle-orm` 0.45.2 + `drizzle-kit` 0.31.10)** — zero runtime dependencies,
   SQL-shaped transactions, and `drizzle-kit generate` produces reviewable `.sql` files, which is what
   you want for a money-like ledger.
4. **Postgres: Neon, region `aws-eu-central-1` (Frankfurt)** — nearest Neon region to Tbilisi, has a
   real PgBouncer pooler on a `-pooler` hostname, and the free tier is enough to build on.
5. **Driver: `postgres`/`pg` over Neon's **pooled** connection string, not `neon-http`** — the HTTP
   driver cannot do interactive transactions, and your settlement logic needs them.
6. **Hosting: Vercel (Pro, `fra1` function region)** — it is the only target that keeps the current
   Prismic ISR working *unchanged* and gives you a minute-granularity cron. Hobby's once-per-day cron
   cap makes it unusable for settlement.
7. **ISR fix (non-negotiable): add `'/api/**': { isr: false }` plus explicit rules for every
   authenticated page.** Today `'/**': { isr: 600 }` would put your `/api/**` responses and any
   SSR'd per-user HTML into a **shared, cookie-blind** CDN cache.
8. **Per-user pages: `{ ssr: false }`.** Safe by construction — the server never renders per-user
   HTML at all, so there is nothing to leak into a cache.
9. **Settlement: an authenticated `POST /api/admin/settle/:eventId` endpoint, driven by Vercel Cron.**
   Nitro `scheduledTasks` does **not** run on the Vercel preset in nitropack 2.13.4 (verified in the
   installed source — it silently does nothing).
10. **Tests: Vitest 4.1.11 + `@nuxt/test-utils` 4.1.0 e2e `setup()`, against a real Postgres from
    `@testcontainers/postgresql` 12.1.0** started in a Vitest `globalSetup` and injected via
    `project.provide()` → `setup({ env: { DATABASE_URL } })`.

---

## 1. Auth

### The candidates, verified

| Package | Latest | Published | Status |
| --- | --- | --- | --- |
| `nuxt-auth-utils` | **0.5.30** | 2026-08-04 | Active, pre-1.0. Prior release 0.5.29 was 2026-02-17 — releases are infrequent but current. |
| `better-auth` | **1.7.1** | 2026-08-18 | Very active (1.6.30 shipped 2026-08-17). |
| `@sidebase/nuxt-auth` | **1.3.1** | 2026-06-30 | Active but slow (1.2.0 was 2026-02-06). |
| `lucia` | **3.2.2** | 2024-10-20 | **Deprecated.** npm carries a `deprecated` field on the latest version. |
| `@nuxtjs/supabase` | **2.0.10** | 2026-08-10 | Active. |
| `@clerk/nuxt` | **3.0.13** | 2026-08-20 | Active. |

Version/date source: npm registry `dist-tags` + `time` maps, fetched 2026-08-24, cross-checked
against GitHub releases for `nuxt-auth-utils` (`v0.5.30`, published 2026-08-04T13:58:12Z).

### Lucia — verified dead

`lucia@3.2.2` on npm carries:

> `"This package has been deprecated. Please see https://lucia-auth.com/lucia-v3/migrate."`

And [lucia-auth.com](https://lucia-auth.com/) states:

> "Lucia was deprecated in March 2025. This website was updated in July 2026"

The author's current recommendation is **not a library**: the site now points at a single-file
copy-paste session implementation (`code/auth_session.ts`) plus the Auth Book. So "use Lucia" today
means "write your own session table and cookie handling using their reference code." That is a real
option (it is ~150 lines) but it is a build-it-yourself answer, not a dependency. **Do not adopt
Lucia as a package.**

### `nuxt-auth-utils` — what you actually get

Source: [README on `main`](https://github.com/atinux/nuxt-auth-utils/blob/main/README.md).

**Session storage.** Encrypted-and-sealed cookie. There is no session table.

> "Since we encrypt and store session data in cookies, we're constrained by the 4096-byte cookie size
> limit. Store only essential information."

Config defaults, verbatim from the README:

```ts
{
  name: 'nuxt-session',
  password: process.env.NUXT_SESSION_PASSWORD || '',
  cookie: {
    sameSite: 'lax'
  }
}
```

It delegates to [h3's `useSession`](https://h3.unjs.io/examples/handle-session); the module wires
`runtimeConfig.session` into it. Requires `NUXT_SESSION_PASSWORD` ≥ 32 chars.

**Server utils** (auto-imported in `server/`): `setUserSession`, `replaceUserSession`,
`getUserSession`, `clearUserSession`, `requireUserSession` (throws 401 when there is no `user` key).
Session shape is split into `user` (readable client-side), `secure` (server-only), and free-form
extra fields; types are augmented via `declare module '#auth-utils'`.

**Passwords.** `hashPassword` / `verifyPassword` / `passwordNeedsRehash`, using **scrypt**
("as it is supported in many JS runtime"). scrypt cost params configurable under `auth.hash.scrypt`.

**OAuth.** 40+ providers via `defineOAuth<Provider>EventHandler({ onSuccess, config?, onError? })`,
configured through `runtimeConfig.oauth.<provider>` or `NUXT_OAUTH_<PROVIDER>_CLIENT_ID/_SECRET`.
Also WebAuthn/passkeys and AT Protocol.

**What it does NOT give you** — I grepped the README for `csrf`, `email verif`, `password reset`,
`reset password`, `magic link`, `rate limit`, `verification`: **no matches**. So you build yourself:

- the users table and all persistence,
- email verification (token issue/verify/expiry + sending),
- password reset (same),
- login rate limiting / brute-force protection,
- CSRF beyond `SameSite=Lax` (which does stop classic cross-site form POSTs, but is not a token).
  For a money-moving endpoint I would still add an origin check in server middleware.

**The one thing no competitor has:** it is cache-aware. From
[`src/runtime/app/plugins/session.server.ts`](https://github.com/atinux/nuxt-auth-utils/blob/main/src/runtime/app/plugins/session.server.ts):

```ts
// Flag if request is cached
nuxtApp.payload.isCached = Boolean(useRequestEvent()?.context.cache)
if (nuxtApp.payload.serverRendered && !nuxtApp.payload.prerenderedAt && !nuxtApp.payload.isCached
  && nuxtApp.$config.public.auth.loadStrategy !== 'client-only'
) {
  await useUserSession().fetch()
}
```

and the client counterpart re-fetches after `app:suspense:resolve` when `prerenderedAt` or
`isCached` is set. Plus `auth.loadStrategy: 'client-only' | 'none'` and an `<AuthState>` component
with a `placeholder` slot for exactly this situation. **Read the caveat in §4** — `context.cache` is
set by *Nitro's own* cache, not by Vercel/Netlify CDN ISR, so this safety net does not fire on
Vercel ISR.

### Better Auth — what you actually get

Sources: [Nuxt integration](https://www.better-auth.com/docs/integrations/nuxt),
[database concepts](https://www.better-auth.com/docs/concepts/database),
[email & password](https://www.better-auth.com/docs/authentication/email-password),
[security reference](https://www.better-auth.com/docs/reference/security).

There is **no first-party Nuxt module** — `@better-auth/nuxt` does not exist on npm (404).
`better-auth-nuxt` is a third-party package last published 2025-05-16 and should be treated as
abandoned. Integration is manual, and documented:

```ts
// server/api/auth/[...all].ts
import { auth } from "~~/lib/auth";

export default defineEventHandler((event) => {
	return auth.handler(toWebRequest(event));
});
```

```ts
import { createAuthClient } from "better-auth/vue";
export const authClient = createAuthClient();
export const { signIn, signUp, signOut, useSession } = authClient;
```

Server-route guard: `auth.api.getSession({ headers: event.headers })`, throw 401 if absent.

**Session storage.** Database-backed. Four required tables: `user`, `session` (`id`, `userId`,
`token`, `expiresAt`, `ipAddress`, `userAgent`), `account`, `verification`. Optional "secondary
storage" (Redis via `@better-auth/redis-storage` 1.7.1, 2026-08-18) for KV-backed sessions. Adapters:
Drizzle, Prisma, built-in Kysely, MongoDB. Schema is emitted by `@better-auth/cli` `generate`
(writes ORM schema) or `migrate` (applies directly — Kysely adapter only for programmatic
`getMigrations`).

Note `@better-auth/cli` latest is **1.4.21 (2026-03-01)** while `better-auth` core is 1.7.1 — the CLI
lags the core by several minors. Verify the generated schema against your `better-auth` version.

**Email/password.** `emailAndPassword: { enabled: true }`, plus `requireEmailVerification`,
`minPasswordLength`/`maxPasswordLength`, `autoSignIn`, `revokeSessionsOnPasswordReset`. Email
verification and password reset flows exist but **you supply the transport**: `sendVerificationEmail`
and `sendResetPassword`. Hashing is scrypt by default ("OWASP recommends using `scrypt` if `argon2id`
is not available").

**Security.** Documented: `httpOnly` session cookies, `SameSite=Lax`, `Secure` when base URL is
https, `trustedOrigins` allow-list ("Requests from origins not on this list are automatically
blocked"), Fetch Metadata headers, and **built-in rate limiting** ("Rate limits are applied across
all routes by default, with specific routes subject to stricter limits"). Sessions expire after
7 days with a 1-day `updateAge`.

**Nuxt caveat, from their own docs:** "authClient actions don't forward cookies during SSR by
default" — you must either call them client-only, or build a request-scoped client. Combined with
having no ISR awareness, Better Auth needs more care in this repo than `nuxt-auth-utils` does.

### `@sidebase/nuxt-auth` — skip

From [their introduction](https://auth.sidebase.io/guide/getting-started/introduction): three
providers (`authjs`, `local`, `refresh`). The `authjs` provider **wraps NextAuth v4.21.1**, and
"NextAuth v4.22+ [is] blocked due to package export changes"; on the Auth.js rebrand they say "New
features that are Auth.js only are not guaranteed to work." Building a money ledger on a module
pinned to a 2023-era NextAuth minor is a poor bet. The `local` provider is a thin client for an API
*you* write — i.e. it gives you almost nothing that `nuxt-auth-utils` doesn't, with more indirection.

### Hosted auth (`@nuxtjs/supabase`, Clerk)

`@nuxtjs/supabase` 2.0.10 (2026-08-10) is a "supa simple wrapper around supabase-js": client
composables (`useSupabaseClient`, `useSupabaseUser`, `useSupabaseSession`,
`useSupabaseCookieRedirect`), server services (`serverSupabaseClient`, `serverSupabaseUser`,
`serverSupabaseSession`, `serverSupabaseServiceRole`), PKCE OAuth, and post-login redirect. Sessions
are Supabase JWTs in cookies.

This is a genuinely good deal **if you also use Supabase Postgres**: you get email verification,
password reset, OAuth, and a managed `auth.users` table for free. The cost is that your money tables
live in the same Postgres as an auth schema you don't control, and you now have a second identity
system to reconcile with your `balances` table (you'll key on `auth.users.id` UUIDs). Clerk
(`@clerk/nuxt` 3.0.13) is the same trade with a separate vendor and a per-MAU bill; I did not
research its pricing and will not guess.

### Recommendation

**Take `nuxt-auth-utils` 0.5.30.**

Reasons, in order:

1. It is the only option built by someone who had to solve the exact ISR-plus-session problem you
   have, and the mitigation ships in the box (`isCached` detection, `loadStrategy`, `<AuthState>`).
2. Sealed-cookie sessions mean **zero DB reads on the hot path** — every page view and every bet-slip
   render already costs you a Neon round-trip; not adding a session lookup matters when the DB is in
   Frankfurt and the function might not be.
3. You are writing a users table anyway (balance, history), so "it doesn't give you a user store" is
   not a real cost here.

**Switch to Better Auth if** you decide you need email verification and password reset on day one
and don't want to write the token tables. That is a legitimate reason and it is the only one — do
not switch for OAuth (both have it) or for "it's more popular."

**One hard constraint either way:** the 4096-byte cookie limit means the session must hold
`{ id, email, role }` and nothing else. **Never put the balance in the session.** It is the single
easiest way to ship a stale-balance bug, and it turns a cache mistake into a money mistake.

---

## 2. Database + ORM

### Verified state, 2026-08-24

| | Drizzle | Prisma |
| --- | --- | --- |
| Stable | `drizzle-orm` **0.45.2** (2026-03-27), `drizzle-kit` **0.31.10** (2026-03-17) | `prisma` / `@prisma/client` **7.9.1** (2026-07-27) |
| Next major in flight | `1.0.0-rc.5` prereleases, latest 2026-08-12 | `8.0.0-rc.5` (2026-08-22) |
| Runtime deps of the client package | **none** (`"dependencies": {}`) | `@prisma/client-runtime-utils` |
| Unpacked install size of client pkg | 10.4 MB / 2,666 files | 78.4 MB / 75 files |
| Migrations | `drizzle-kit generate` → reviewable `.sql` + snapshot; `migrate` applies; `push` skips review | `prisma migrate dev/deploy`, `prisma db push` |

(Unpacked size is install footprint, **not** bundle size — both tree-shake. I did not build a bundle
to measure the deployed artifact, so treat the size column as directional only.)

**Both are mid-major-transition right now, and that is the most important fact in this section.**

- Drizzle 1.0 has been in RC since 2026-04-30 (`v1.0.0-rc.1`) with breaking changes to the `casing`
  API and removal of relational-query-builder v1 (`._query`) for Postgres.
- Prisma 8 is a **ground-up rewrite**. From the `v8.0.0-rc.2` notes: "This repository no longer
  publishes a CLI; the unified `prisma` CLI replace[s]…", "Almost every application will need to
  re-emit its contract and rename its config file." Packages moved to `@prisma/orm-postgres` etc.
  (`v0.17.0` notes). Prisma 7 itself (7.0.0, 2025-11-19) was already a breaking release: ESM-only
  (requires `"type": "module"` — this repo already has it), `output` now **required** in the
  generator block, `prisma.config.ts` as the default config location, and driver adapters
  **required** for all databases.

### Nitro/serverless specifics

**Prisma.** [Their Vercel guide](https://www.prisma.io/docs/orm/prisma-client/deployment/serverless/deploy-to-vercel)
requires a generate step (`"postinstall": "prisma generate"`, or a `vercel-build` script chaining
`prisma generate && prisma migrate deploy && <build>`) and warns that in serverless "every
invocation may result in a new connection to your database. This can cause your database to quickly
run out of open connections." Their
[connections doc](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections)
now says pool sizing is adapter-specific ("Configure a small pool size for your driver adapter…
start small when not using a pooler") and notes "there are no connection URL parameters for these
in Prisma ORM v7" — the old `connection_limit=1` advice is v6-era. With PgBouncer you still pass
`?pgbouncer=true` on the pooled URL.

Prisma 7's driver-adapter model does remove the Rust engine binary from the happy path — their v7
upgrade guide claims "faster queries, smaller bundle size, and require less system resources when
deployed to your server," and confirms `prisma-client-js` (the old engine provider) "will be removed
in future releases." So the historical "Prisma is fat on Lambda" complaint is genuinely much weaker
in v7 than it was in v5/v6. I could not verify a specific cold-start delta and will not invent one.

**Drizzle.** No codegen step at all — schema is TypeScript, types are inferred. No engine, no
generate-on-install, so nothing can go stale between `pnpm install` and `nuxt build`. Transactions
are the plain SQL shape:

```ts
await db.transaction(async (tx) => {
  await tx.update(accounts).set({ balance: sql`${accounts.balance} - 100.00` }).where(eq(users.name, 'Dan'));
  await tx.update(accounts).set({ balance: sql`${accounts.balance} + 100.00` }).where(eq(users.name, 'Andrew'));
});
```

with `tx.rollback()`, savepoints via nesting, and a `PgTransactionConfig` second argument exposing
`isolationLevel` / `accessMode` / `deferrable`.

### Connection pooling behaviour — the part that bites

Both ORMs are equally exposed here; the pooler is the constraint, not the ORM.

- **Neon** ([pooling docs](https://neon.com/docs/connect/connection-pooling)): PgBouncer in
  **transaction mode**, reached by adding `-pooler` to the endpoint host. "Use the pooled connection
  string (hostname with -pooler suffix) for serverless functions and connection-per-request
  workloads." Max 10,000 client connections; default pool size is `0.9 × max_connections`. Transaction
  mode does **not** support `SET`/`RESET`, `LISTEN`/`NOTIFY`, `PRESERVE`/`DELETE ROWS` temp tables,
  SQL-level `PREPARE`/`EXECUTE`, or session-level advisory locks. Protocol-level prepared statements
  *are* supported through drivers.
- **Supabase** ([connecting docs](https://supabase.com/docs/guides/database/connecting-to-postgres)):
  Supavisor session mode on `:5432`, transaction mode on `:6543`. For serverless: "Use pooler
  transaction mode… ideal for serverless or edge functions, which require many transient
  connections." And the flat warning: **"Transaction mode does not support prepared statements. To
  avoid errors, turn off prepared statements for your connection library."** Also: Supavisor is
  IPv4-only on every tier; direct connections are IPv6 unless you buy the IPv4 add-on, and the add-on
  swaps the AAAA record for an A record rather than dual-stacking.

**Consequences for you:** session-level advisory locks are off the table on Neon's pooler, so don't
plan a `pg_advisory_lock`-based settlement mutex. Use row locks inside a transaction instead (§5).
On Supabase you must disable prepared statements (`postgres.js`: `prepare: false`).

### Driver choice — the trap

Drizzle's [Neon connect page](https://orm.drizzle.team/docs/connect-neon) offers three drivers, and
Neon's [serverless driver docs](https://neon.com/docs/serverless/serverless-driver) are explicit:

- `drizzle-orm/neon-http` — HTTP, "single, non-interactive transactions, also referred to as
  'one-shot queries'". **Interactive transactions are not supported over HTTP.** There is a
  `transaction(queriesOrFn, options)` helper for a batched, non-interactive transaction, but you
  cannot read a row, branch on it in JS, and then write — which is exactly what "check balance,
  compute multiplier, debit, insert bet" is.
- `drizzle-orm/neon-serverless` — WebSockets, "provide session and transaction support, as well as
  node-postgres compatibility". Needs `ws` and `bufferutil` under Node.
- `node-postgres` / `postgres.js` — "To use Neon from a serverful environment".

**Pick `postgres.js` (or `pg`) against the `-pooler` host.** On Vercel's Node runtime you are not in
a Workers isolate; the standard TCP driver works, and it is the one with the fewest surprises. Do
not reach for `neon-http` because a blog post said it's faster — it will silently make your
settlement non-atomic.

### Recommendation

**Drizzle.** Three reasons that matter for *this* app:

1. `drizzle-kit generate` emits a `.sql` file you read before it runs. For a ledger, migration review
   is a feature, not friction.
2. Zero runtime dependencies and no generate step removes a whole class of "works locally, broken on
   Vercel" failures.
3. The transaction API is SQL-shaped, so `SELECT … FOR UPDATE` and `WHERE balance >= amount` guards
   are natural rather than fought for.

**What would change it:** (a) if you adopt Better Auth *and* want its Prisma adapter specifically —
though its Drizzle adapter is equally first-class, so this is weak; (b) if someone on the team has
real Prisma operational experience and none with Drizzle — familiarity beats a marginal technical
edge; (c) if Prisma 8 ships stable and Drizzle 1.0 doesn't, the risk calculus inverts. **Re-check
both major versions before you write the first migration** — starting on `drizzle-orm@0.45.x` means a
1.0 upgrade later, and starting on `prisma@7.9` means a v8 rewrite later. Neither has a stable
landing zone right now.

---

## 3. Postgres hosting

### Regions — the Tbilisi problem

**Neither vendor has a region anywhere near Georgia.** Verified:

- **Neon** ([regions](https://neon.com/docs/introduction/regions)): 8 AWS regions —
  `aws-us-east-1`, `aws-us-east-2`, `aws-us-west-2`, **`aws-eu-central-1` (Frankfurt)**,
  `aws-eu-west-2` (London), `aws-ap-southeast-1`, `aws-ap-southeast-2`, `aws-sa-east-1`. The three
  Azure regions are **deprecated**: "Neon Azure regions are deprecated. You can no longer create new
  projects in Azure regions." No Middle East presence.
- **Supabase** ([regions](https://supabase.com/docs/guides/platform/regions)): six European options —
  `eu-west-1` Ireland, `eu-west-2` London, `eu-west-3` Paris, **`eu-central-1` Frankfurt**,
  `eu-central-2` Zurich, `eu-north-1` Stockholm. No Middle East region.

**Nearest for Tbilisi: Frankfurt (`eu-central-1`) on either.** Supabase's Zurich option is not
closer. AWS does have `me-central-1` (UAE) and `me-south-1` (Bahrain), which would be geographically
nearer, but **neither Neon nor Supabase offers them** — so a plain managed instance (AWS RDS,
DigitalOcean, Hetzner, or a Georgian/Turkish provider) is the only way to get closer than Frankfurt.

**I did not measure latency from Tbilisi and will not guess a number.** Before committing, run
`ping`/`psql \timing` from a Tbilisi connection against a throwaway Neon Frankfurt project and a
Supabase Frankfurt project. That measurement is worth more than any of this section. The thing that
actually matters is that **your function region and your DB region must match** — a Frankfurt DB
with a US-East function is the worst of both worlds, and `iad1` is Vercel's default (§7).

### Pooling from a serverless function

Covered in §2. Summary: Neon = `-pooler` host, PgBouncer transaction mode, no session advisory locks,
protocol-level prepared statements OK. Supabase = port `6543`, Supavisor transaction mode,
**prepared statements must be disabled**, IPv4-only pooler.

A plain managed Postgres (RDS/DO/Hetzner) has **no pooler by default** — you would run PgBouncer
yourself or accept connection exhaustion. That is the main reason not to pick one for a serverless
deployment.

### Free / entry pricing, verified 2026-08-24

**Neon** ([pricing](https://neon.com/pricing)) — Free / Launch / Scale:

- Free: **0.5 GB storage per project**, 100 CU-hours/project, 100 projects, 10 branches/project,
  **auto-suspend after 5 min** of inactivity, 5 GB egress, autoscaling up to 2 CU, 6-hour history.
- Launch (first paid, usage-based at **$0.106/CU-hour**): autoscaling to 16 CU, 7-day history,
  snapshots, instant restore, 500 GB egress, **configurable scale-to-zero (can be disabled)**.

**Supabase** ([pricing](https://supabase.com/pricing)) — Free / Pro $25 / Team $599 / Enterprise:

- Free: **500 MB database**, shared CPU / 500 MB RAM, 5 GB egress + 5 GB cached egress, 50,000 MAU,
  **limit of 2 active projects**, and **"Free projects are paused after 1 week of inactivity."**
- Pro **$25/mo**: 100,000 MAU, 8 GB disk (then $0.125/GB), 250 GB egress, 100 GB file storage, daily
  backups kept 7 days, 7-day log retention, **projects are never paused**.

### Recommendation

**Neon, Frankfurt.**

- Neon's free tier suspends after 5 minutes but does **not** pause the project after a week; Supabase
  free pauses the whole project after 7 days of inactivity, which is a genuinely bad property for a
  site whose betting traffic is bursty around fight nights. Between events you could easily go a week
  quiet and come back to a paused DB.
- Neon's scale-to-zero is **disableable on the paid tier** — meaning you can buy your way out of cold
  starts later without changing vendor.
- Neon's pooler doesn't force you to disable prepared statements.

**Pick Supabase instead if** you go with `@nuxtjs/supabase` for auth (§1) — running Supabase Auth
against a Neon database is not a thing, and splitting them across two vendors is worse than either
choice alone. In that case budget the **$25/mo Pro plan from launch**, because free-tier pausing plus
real users is not viable.

**Cold-start caveat, both vendors:** Neon free auto-suspends after 5 min. The first request after a
quiet period pays a compute wake-up. For a site that's idle between fight cards, *every* first
visitor of the day eats that. Measure it; if it's unacceptable, that alone justifies Launch.

---

## 4. The ISR collision — the critical one

### What `routeRules` actually does

`routeRules` is documented in Nuxt under
[Hybrid Rendering](https://nuxt.com/docs/4.x/guide/concepts/rendering) with these options:
`prerender`, `swr: number|boolean`, `isr: number|boolean`, `ssr: false`, `cors`, `headers`,
`redirect`, `appMiddleware`, `noScripts`. Note that the
[nuxt.config reference](https://nuxt.com/docs/4.x/api/nuxt-config) still labels top-level
`routeRules` **"Experimental… API may change in the future"** — worth knowing, though it is
universally used and Vercel documents it as the supported ISR mechanism for Nuxt.

The Nuxt docs describe `isr` as behaving like `swr` "except responses can be added to CDN cache on
supported platforms (Netlify/Vercel)". **That parenthetical is the whole story, and it is
load-bearing.** Verified in the installed `nitropack@2.13.4` source:

- `normalizeRouteRules()` (`dist/core/index.mjs:500-548`) converts `swr` into a Nitro-side
  `cache: { swr: true, maxAge }` rule. **It does nothing with `isr`.**
- `isr` appears only in the **Vercel and Netlify presets** (and a passing reference in the Zeabur
  preset). `grep -rl isr dist/` hits `presets/vercel/*`, `presets/netlify/*`, `presets/zeabur/*`, and
  the type declarations — **nothing in the Cloudflare or Node presets.**

**Therefore: `isr: 600` is a no-op on `node-server` and on Cloudflare.** If you self-host or move to
Workers, your current caching silently disappears and every request re-renders and re-hits Prismic.
This is probably the single most surprising fact in this document.

### How the cache key is computed — and why per-user pages break

Two separate mechanisms, both cookie-blind.

**(a) Nitro's own cache** (`swr` / `cache` route rules, and `defineCachedEventHandler`). From the
[Nitro v2 cache docs](https://v2.nitro.build/guide/cache):

> "All incoming request headers are dropped when handling cached responses. If you define the
> `varies` option, only the specified headers will be considered when caching and serving the
> responses."

Confirmed in source (`dist/runtime/internal/cache.mjs`): the default `getKey` is
`` `${escapedPathname}.${hash(fullPath)}` `` joined with hashes of only the `varies` headers. The
inner handler is invoked with a **proxied request whose headers contain only the `varies` list** —
so a cached SSR render literally cannot see the session cookie. And `dist/runtime/internal/app.mjs`
wraps a handler in `cachedEventHandler` whenever its route rule has `cache`, resolved at
registration time from the route *pattern*.

That last detail has a nasty corollary: **if you ever change `'/**': { isr: 600 }` to
`'/**': { swr: 600 }` (e.g. to self-host), every `server/api/**` handler gets wrapped in Nitro's
cache too**, because `getRouteRulesForPath('/api/whatever')` matches `/**`. Your `POST /api/bets`
would start serving stale JSON.

**(b) Vercel's CDN/ISR cache.** Verified from
[nitropack's vercel preset](https://github.com/nitrojs/nitro) build output logic
(`dist/presets/vercel/utils.mjs`): for **every** route rule with a truthy `isr`, Nitro symlinks an
`<route>-isr.func` and writes a `.prerender-config.json`; it then emits a `config.json` route mapping
that path to the ISR function. And crucially:

```js
...nitro.options.routeRules["/**"]?.isr ? [] : [
  { src: "/(.*)", dest: FALLBACK_ROUTE }
]
```

— with `'/**': { isr: 600 }` there is **no non-ISR fallback route at all**. Everything, `/api/**`
included, is routed through a prerender function.

Vercel's own docs confirm the cache is cookie-blind. From
[CDN cache](https://vercel.com/docs/caching/cdn-cache), the cacheable-response criteria are:

> - Request uses `GET` or `HEAD` method.
> - Request doesn't contain `Range` header.
> - Request doesn't contain `Authorization` header.
> - Response uses `200`, `404`, `410`, `301`, `302`, `307` or `308` status code.
> - Response doesn't exceed `10MB` in content length.
> - Response doesn't contain the `set-cookie` header.
> - Response doesn't contain the `private`, `no-cache` or `no-store` directives…
> - Response doesn't contain `Vary: *` header…

**A request Cookie header is not on that list.** A logged-in user's `GET /account` sends
`Cookie: nuxt-session=…`, gets a 200 with no `Set-Cookie` (reading a session doesn't re-issue the
cookie), and is therefore fully cacheable. And
[Cache Status and Reasons](https://vercel.com/docs/caching/cache-status) enumerates every documented
`BYPASS` reason — Draft Mode, Prerender Bypass (`experimentalBypassFor`), Crawler. **None of them is
"the request had a session cookie."** Next.js opts itself out via `experimentalBypassFor`; Nitro's
Vercel preset does not emit that.

Netlify is the same shape — `dist/presets/netlify/runtime/netlify.mjs` unconditionally attaches
`Netlify-CDN-Cache-Control: public, max-age=<isr>, …, durable` for any path whose route rule has
`isr`, with no cookie inspection.

### The failure mode, stated plainly

With today's `'/**': { isr: 600 }` on Vercel, once you add auth:

1. User A logs in, visits `/account`. Cache miss → the function renders A's page server-side,
   including A's balance and bet history.
2. Vercel stores that HTML in the ISR cache under key `/account`.
3. User B — or an anonymous visitor, or a search-engine crawler — requests `/account` within 600s.
   **Cache hit. B is served A's HTML: A's name, A's coin balance, A's open bets.**
4. Nuxt hydrates on B's machine, the client-side session fetch corrects the DOM — but A's data was
   already in the response body, already in B's browser, and depending on your headers already in
   B's disk cache. Rendering it and then fixing it is not a fix.

Same mechanism turns `GET /api/me/balance` into a shared endpoint: the first caller's balance is
served to everyone for 600 seconds.

And it cuts the other way too: because Nitro drops incoming headers on its own cached responses, a
cached page can't read the session at all — so on a self-hosted `swr` setup you'd get "everyone
appears logged out" instead. Both directions are broken; the Vercel direction is the one that leaks.

**`nuxt-auth-utils`'s `isCached` guard does not save you on Vercel.** That flag reads
`useRequestEvent()?.context.cache`, and `event.context.cache` is assigned in exactly one place —
inside Nitro's own `defineCachedEventHandler` (`dist/runtime/internal/cache.mjs:256`). Vercel ISR
caching happens *above* Nitro, in the platform. The function runs as a normal uncached invocation,
`context.cache` is undefined, the server-side session fetch proceeds, and the personalised HTML is
handed to Vercel to cache. **The safety net only covers `swr`/`cache` rules on a Node server.**

### Can a cached page safely hydrate per-user state client-side?

**Yes — and this is the correct architecture** — provided the *server* never renders per-user data.
That's the whole trick: the cached artifact must be identical for every user. Two supported ways:

1. **`{ ssr: false }` route rule.** The server emits an app shell; all user data is fetched by the
   browser with its own cookies. Nothing per-user ever enters a cache because nothing per-user is
   ever server-rendered. This is the strongest guarantee and what I recommend for account/bet-slip
   pages.
2. **Keep SSR, set `isr: false`, and never cache.** Fine for pages that must be SSR'd for SEO —
   which, for a logged-in account page, they don't need to be.

For shared chrome (a "Log in / Log out" button in the layout that appears on cached marketing
pages), use the module's `<AuthState>` component with a `placeholder` slot, and/or
`auth: { loadStrategy: 'client-only' }`. Per the README: "If the page is cached or prerendered or the
load strategy set as `client-only`, nothing will be rendered until the user session is fetched on the
client-side."

Given the Vercel-ISR blind spot above, **set `loadStrategy: 'client-only'` explicitly.** Don't rely
on auto-detection you've now seen doesn't fire on your platform.

### `varies` is not the answer

You may be tempted by Nitro's `varies: ['cookie']`. Don't. The cache key would then include a hash of
the session cookie, giving every logged-in user their own cache entry — unbounded key growth, ~0%
hit rate, and one wrong `varies` entry away from the same leak. `varies` exists for
multi-tenant `host` splitting, which is the example the docs give.

### Concrete `routeRules` for this repo

Route-rule specificity in Nitro does **not** depend on key order: `getRouteRulesForPath` does
`defu({}, ...matcher.matchAll(path).reverse())`, so the most specific match wins regardless of where
you write it. Ordering below is for human readability.

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  // ...existing config

  routeRules: {
    // ── Public marketing site: unchanged, shared, anonymous HTML only ──
    '/**': { isr: 600 },

    // ── Never cache the API. Auth, bets, balances, settlement. ──
    // Without this, nitro routes EVERY /api/** request through an ISR
    // prerender function on Vercel (verified in the vercel preset source).
    '/api/**': { isr: false },

    // ── Per-user pages: no server-rendered personal data, ever. ──
    // ssr:false means the server emits an identical shell for everyone,
    // so caching it is harmless and the data is fetched with the user's
    // own cookies in the browser.
    '/account/**': { ssr: false, isr: false },
    '/bets/**': { ssr: false, isr: false },
    '/predictions/**': { ssr: false, isr: false },

    // ── Auth screens: dynamic, and they set cookies. ──
    '/login': { ssr: false, isr: false },
    '/register': { ssr: false, isr: false },
    '/auth/**': { isr: false }, // OAuth callbacks / server handlers

    // ── Leaderboard: identical for everyone, so a SHORT shared cache is
    //    correct and desirable. Tune 30s to taste; it is the one place
    //    where caching is both safe and valuable. ──
    '/leaderboard': { isr: 30 },

    // ── Existing: force SSR for the Prismic slice simulator. ──
    // NOTE: the current config writes `{ ssr: true }` only, which does NOT
    // opt out of the inherited `isr: 600` — /slice-simulator is being
    // ISR-cached today despite the apparent intent. isr:false fixes it.
    '/slice-simulator': { ssr: true, isr: false },
    '/slice-simulator/**': { ssr: true, isr: false },
  },
})
```

> **Live bug found while reading the repo:** `'/slice-simulator': { ssr: true }` does not currently
> disable ISR. Route rules are merged, so the effective rule is `{ isr: 600, ssr: true }` and the
> slice simulator is served from a 600-second CDN cache. Add `isr: false`.

### Verification checklist before you ship auth

1. Log in as user A, load `/account`. In a private window (no cookies), load `/account`. **You must
   see the logged-out shell, not A's data.**
2. `curl -sI https://<site>/account` and check `x-vercel-cache`. For an `ssr: false` page a `HIT` is
   fine (it's a shared shell). For any page that SSRs user data, a `HIT` is a bug.
3. `curl -sI https://<site>/api/me` — must never be `HIT` or `STALE`.
4. After a deploy, grep the build output: `ls .vercel/output/functions/` should **not** contain
   `api-*-isr.func` entries.

---

## 5. Server routes

### How they work in Nuxt 4

From the [server directory docs](https://nuxt.com/docs/4.x/guide/directory-structure/server):

```
server/
├── api/          # Routes prefixed with /api
├── routes/       # Routes without /api prefix
├── middleware/   # Runs on every request
├── plugins/      # Nitro plugins
├── utils/        # Custom helper utilities
└── types/        # Server-only auto-imported types
```

Each file default-exports `defineEventHandler()`. Method is matched by filename suffix
(`server/api/bets.post.ts` → `POST /api/bets`). Dynamic segments via `[name].ts` +
`getRouterParam(event, 'name')`. Auto-imported h3 utilities include `readBody`, `getQuery`,
`parseCookies`, `getRequestURL`. Runtime config: `useRuntimeConfig(event)` — the docs say passing
`event` "is recommended… to get the runtime config overwritten by environment variables at runtime
for server routes." Import server code via the `#server` alias. And the standing rule:

> "Do not import Vue app code (components, composables, or other app-only utilities) in your server
> routes or utilities, and do not import server-only code in your app."

Server middleware "should not return values or close responses — only inspect/extend context or throw
errors." Vercel's Nuxt page notes the deployment shape: "Nuxt deploys routes defined in
`/server/api`, `/server/routes`, and `/server/middleware` as one server-rendered Function by
default."

### Session access inside a handler

With `nuxt-auth-utils`, auto-imported:

```ts
// server/api/me.get.ts
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event) // throws 401 if not logged in
  return getBalance(user.id)
})
```

From the client during SSR you must forward cookies — `useFetch` does it automatically, but a bare
`$fetch` does not. Per the [`useRequestFetch` docs](https://nuxt.com/docs/4.x/api/composables/use-request-fetch):
"when making a request during server-side rendering, due to security considerations, we need to
forward the headers manually." So:

```ts
const { data } = await useAsyncData('me', () => useRequestFetch()('/api/me'))
```

(Moot for `ssr: false` pages, which is another reason to prefer them for account screens.)

### The transactional debit-and-bet endpoint

The invariant: **a balance must never go negative, and a bet must never exist without its
corresponding debit.** Both come from doing the check and the write inside one Postgres transaction,
with the row locked.

Postgres' [explicit locking docs](https://www.postgresql.org/docs/current/explicit-locking.html):

> "`FOR UPDATE` causes the rows retrieved by the `SELECT` statement to be locked as though for
> update. This prevents them from being locked, modified or deleted by other transactions until the
> current transaction ends."

```ts
// server/api/bets/index.post.ts
import { z } from 'zod' // or valibot; the repo has neither yet

const Body = z.object({
  eventId: z.string().uuid(),
  legs: z.array(z.object({ fightId: z.string().uuid(), pick: z.enum(['A', 'B']) })).min(1).max(10),
  stake: z.number().int().positive(),
})

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const { eventId, legs, stake } = Body.parse(await readBody(event))

  return await db.transaction(async (tx) => {
    // 1. Lock the wallet row. Concurrent bets from the same user now serialise
    //    here instead of racing the balance check.
    const [wallet] = await tx
      .select({ balance: wallets.balance })
      .from(wallets)
      .where(eq(wallets.userId, user.id))
      .for('update')

    if (!wallet) throw createError({ statusCode: 404, message: 'No wallet' })
    if (wallet.balance < stake) {
      throw createError({ statusCode: 422, message: 'Insufficient balance' })
    }

    // 2. Re-assert the guard in SQL. Belt and braces: even if the lock were
    //    somehow bypassed, this UPDATE cannot drive the balance negative.
    const debited = await tx
      .update(wallets)
      .set({ balance: sql`${wallets.balance} - ${stake}` })
      .where(and(eq(wallets.userId, user.id), gte(wallets.balance, stake)))
      .returning({ balance: wallets.balance })

    if (debited.length === 0) {
      throw createError({ statusCode: 409, message: 'Balance changed, retry' })
    }

    // 3. Multipliers are read INSIDE the transaction and frozen onto the bet.
    //    Never recompute odds at settlement time.
    const odds = await tx.select().from(fightOdds)
      .where(inArray(fightOdds.fightId, legs.map(l => l.fightId)))
    const multiplier = odds.reduce((m, o) => m * Number(o.multiplier), 1)

    const [bet] = await tx.insert(bets).values({
      userId: user.id, eventId, stake, multiplier, status: 'open',
    }).returning()

    await tx.insert(betLegs).values(legs.map(l => ({ betId: bet.id, ...l })))

    // 4. Append-only ledger entry. The wallet balance is a cache of this.
    await tx.insert(ledger).values({
      userId: user.id, delta: -stake, reason: 'bet_placed', refId: bet.id,
    })

    return { betId: bet.id, balance: debited[0].balance, multiplier }
  })
})
```

Notes that matter:

- **Ledger is the source of truth; `wallets.balance` is a denormalised cache.** Add a periodic
  assertion that `SUM(ledger.delta) = wallets.balance` per user. When they disagree you have a bug,
  and you want to find out from a check rather than from a user.
- **Freeze the multiplier onto the bet row.** If you recompute at settlement, changing odds
  retroactively changes payouts.
- **`.for('update')`** is Drizzle's `SELECT … FOR UPDATE`. Do not substitute
  `pg_advisory_lock` — session-level advisory locks are unsupported through Neon's PgBouncer
  transaction-mode pooler (§3).
- **Idempotency.** Add a client-supplied `Idempotency-Key` with a unique index, or a unique
  constraint on `(userId, eventId, requestId)`. Double-submit on a flaky mobile connection is the
  single most common way virtual-currency apps leak coins.
- **Don't hold the transaction open across a network call.** No Prismic fetch, no email send, no
  third-party odds lookup inside `db.transaction`. Every millisecond in there is a millisecond
  another bet from the same user is blocked, and on serverless it's a millisecond of a pooled
  connection.
- The repo has **no validation library yet** — add `zod` or `valibot` and validate every body. Never
  trust `stake` from the client.

---

## 6. Scheduled jobs / settlement

### Nitro tasks — status and reality

From the [Nitro v2 tasks docs](https://v2.nitro.build/guide/tasks) (v2 is what you have,
`nitropack@2.13.4`):

> "Tasks support is currently experimental. See [nitrojs/nitro#1974] for the relevant discussion."

Opt in with `nitro: { experimental: { tasks: true } }`. Tasks live in `server/tasks/[name].ts` (Nitro
scans a `tasks` dir under each scan dir; in Nuxt that's `server/` — verified in
`dist/core/index.mjs:941`, `scanTasks`). Nested dirs join with `:`. Schedules:

```ts
export default defineNuxtConfig({
  nitro: {
    scheduledTasks: {
      '* * * * *': ['cms:update']
    }
  }
})
```

**Platform support, quoted from the v2 docs:**

> - `dev`, `node-server`, `bun` and `deno-server` presets are supported with croner engine.
> - `cloudflare_module` preset have native integration with Cron Triggers. Make sure to configure
>   wrangler to use exactly same patterns you define in `scheduledTasks` to be matched.

**Verified against the installed source** rather than taking the doc's word:

- `startScheduleRunner()` (the in-process croner loop, `dist/runtime/internal/task.mjs:43`) is called
  from exactly five files: `presets/node/runtime/node-server.mjs`,
  `presets/node/runtime/node-listener.mjs`, `presets/bun/runtime/bun.mjs`,
  `presets/deno/runtime/deno-server.mjs`, `presets/_nitro/runtime/nitro-dev.mjs`.
- `runCronTasks()` is wired only from `presets/cloudflare/runtime/_module-handler.mjs` and
  `presets/cloudflare/runtime/cloudflare-pages.mjs`.
- **The Vercel, Netlify, and AWS Lambda presets reference neither.**

> **So: on Vercel or Netlify, `scheduledTasks` compiles, deploys, logs nothing, and never runs.** It
> fails silently. This is the second-sharpest edge in this document.

Also note: Nitro v2's Cloudflare preset requires you to hand-write matching `triggers.crons` in your
wrangler config. Nitro **v3** (public beta, docs now at nitro.build) automates that, and adds native
Vercel Cron generation — from the [v3 tasks doc](https://nitro.build/docs/tasks): "`vercel` preset
has native integration with Vercel Cron Jobs. Nitro automatically generates the cron job
configuration at build time." **That is v3, which this repo is not on.** Nuxt 4.4/4.5 ships Nitro 2.

`runTask(name, { payload })` works everywhere and is the escape hatch:

```ts
export default eventHandler(async (event) => {
  // IMPORTANT: Authenticate user and validate payload!
  const payload = { ...getQuery(event) };
  const { result } = await runTask("db:migrate", { payload });
  return { result };
});
```

Concurrency guarantee from the docs: "Each task can have **one running instance**. Calling a task of
same name multiple times in parallel, results in calling it once and all callers will get the same
return value." That's per-instance, not distributed — on serverless, two concurrent invocations are
two processes. **Do not rely on it for settlement idempotency; rely on the DB (§5).**

### What works where

| Option | Vercel | Netlify | Cloudflare Workers | Long-running Node container |
| --- | --- | --- | --- | --- |
| Nitro `scheduledTasks` | **No** (preset not wired) | **No** | Yes (`cloudflare_module`, manual wrangler crons on Nitro v2) | **Yes** (croner in-process) |
| Platform cron → HTTP endpoint | **Yes** (Vercel Cron) | Netlify Scheduled Functions (not researched) | Yes (Cron Triggers) | n/a (use the in-process runner) |
| Admin-triggered endpoint | Yes | Yes | Yes | Yes |

**Vercel Cron** ([docs](https://vercel.com/docs/cron-jobs)): configured in `vercel.json` (or via the
Build Output API); Vercel "makes an HTTP GET request to your project's production deployment URL,
using the `path`". Requests carry `user-agent: vercel-cron/1.0` and an `x-vercel-cron-schedule`
header. Standard 5-field cron, **UTC only**, no `MON`/`JAN` aliases, and you cannot set day-of-month
and day-of-week simultaneously.

**Vercel Cron limits** ([usage & pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing),
doc last updated 2026-07-15):

| | Cron jobs per project | Minimum interval | Scheduling precision |
| --- | --- | --- | --- |
| Hobby | 100 | **Once per day** | Per-hour (±59 min) |
| Pro | 100 | Once per minute | Per-minute |

> "Hobby accounts are limited to cron jobs that run **once per day**. Cron expressions that would run
> more frequently will fail during deployment."

**This is decisive.** Settlement "after each event" on Hobby means: one attempt per day, arriving
anywhere in a 59-minute window. Unusable.

Max function duration ([limits](https://vercel.com/docs/functions/limitations), 2026-07-01):
Hobby 300s default and maximum; Pro 300s default, 800s maximum, 1800s extended (beta). 300s is plenty
for settling one fight card.

**Cloudflare Cron Triggers** ([docs](https://developers.cloudflare.com/workers/configuration/cron-triggers/)):
`[triggers] crons = ["*/3 * * * *", …]` in wrangler config, `async scheduled(controller, env, ctx)`
handler, one-minute granularity. But the
[limits](https://developers.cloudflare.com/workers/platform/limits/) are brutal on free: **5 Cron
Triggers per account and 10 ms CPU per cron invocation** on the free plan. Paid (Workers Paid) gives
250 triggers/account and 30 s CPU for sub-hourly intervals (15 min for hourly+), 15 min wall clock.
Free-tier subrequests are capped at 50/request. **Settlement on the Cloudflare free plan is not
viable; on Workers Paid it is.**

**Long-running Node container** (`node-server` / `node_cluster` preset, Fly/Railway/Render/a VPS):
`scheduledTasks` genuinely works, croner runs in-process. But **you lose ISR entirely** (§4) — `isr`
is a no-op outside the Vercel/Netlify presets — so you'd migrate the marketing-site caching to `swr`
plus a shared cache storage (Redis/Upstash), because Nitro's default production cache driver is
in-memory and therefore per-instance. And with `node_cluster` or >1 replica, the croner loop runs in
**every** worker — you'd get N concurrent settlement runs. Use a DB advisory lock or a leader flag.

**Admin-triggered endpoint** works everywhere and is genuinely the right primitive here anyway.

### Recommendation

**Build settlement as an idempotent, authenticated HTTP endpoint. Drive it with Vercel Cron. Keep a
manual trigger.**

```ts
// server/api/admin/settle.post.ts
export default defineEventHandler(async (event) => {
  // Vercel Cron sends a GET; give the handler a .get.ts twin or accept both.
  const secret = getHeader(event, 'authorization')
  const { cronSecret } = useRuntimeConfig(event)
  if (!cronSecret || secret !== `Bearer ${cronSecret}`) {
    throw createError({ statusCode: 401 })
  }
  // Settle every event whose fights are all resolved and which is not yet settled.
  return await settleDueEvents()
})
```

```json
// vercel.json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [{ "path": "/api/admin/settle", "schedule": "*/5 * * * *" }]
}
```

Vercel's docs mention securing cron endpoints with a `CRON_SECRET` environment variable; verify the
exact header Vercel sends against
[Managing Cron Jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs) before relying on it — I did
not read that page and will not guess the header name. The `user-agent: vercel-cron/1.0` check is
documented but is **not** an authentication mechanism on its own; it is trivially spoofable.

Settlement must be idempotent at the database level: mark each bet `settled` in the same transaction
that credits the payout, and make the credit conditional on `status = 'open'`. Then a double cron
fire, a retry, and a manual admin click are all harmless.

Because settlement is really "run when a card finishes," not "run at 03:00," the cron is a poller:
every 5 minutes, look for events whose fights are all resolved and which aren't settled yet. That
also means an admin marking the last fight result triggers settlement within 5 minutes without
anyone doing anything — which is the actual product requirement.

---

## 7. Hosting recommendation

**Vercel, Pro plan ($20/user/mo — I did not verify this figure; check
[vercel.com/pricing](https://vercel.com/pricing)), single function region `fra1`.**

Why:

1. **It is the only target where the existing Prismic ISR survives untouched.** `isr` is implemented
   in the Vercel and Netlify presets only. Node/Cloudflare → your caching silently evaporates and
   every request re-renders and re-hits Prismic. Given the git history (`improve caching`,
   `perf: implement caching`, `revert caching`, three `fix: fix 500 errors` commits), caching has
   already cost this project real time. Don't relitigate it.
2. **Minute-granularity cron on Pro.** Hobby's once-per-day cap kills settlement (§6).
3. **Zero-config Nitro preset**, which matters given there is currently no deployment config at all.

**What it costs you in flexibility:**

- **No `scheduledTasks`.** All scheduled work is HTTP endpoints + `vercel.json` crons. Slightly more
  ceremony, and you must secure and rate-limit those endpoints yourself. (Arguably a feature: an
  HTTP-triggered settlement is testable and manually re-runnable.)
- **Hobby is not an option.** The cron limit forces Pro. Budget for it from day one.
- **Single function region on Hobby, up to 5 on Pro** (Hobby: "Single region"). Default for all new
  projects is `iad1` (Washington DC). **You must change it to `fra1`** or every DB query crosses the
  Atlantic to Frankfurt. Set `"regions": ["fra1"]` in `vercel.json` or in project settings →
  Functions.
- **No long-lived connections.** No WebSockets for a live-updating leaderboard on Vercel Functions;
  poll, or use SSE within the duration limit, or add a separate service.
- **300s max duration on Hobby / 800s on Pro** — irrelevant for settling a fight card, relevant if
  you ever batch-recompute the whole ledger.
- **4.5 MB request/response body cap** — irrelevant here.

**Does the current Prismic ISR setup survive? Yes, with two mandatory edits:** add
`'/api/**': { isr: false }`, and add `isr: false` to the `/slice-simulator` rules (which are
currently being cached despite the apparent intent). The marketing pages keep `isr: 600` exactly as
today.

**The alternative worth taking seriously** is a long-running Node container (Fly.io / Railway /
Render / a Hetzner box in Falkenstein or Nuremberg, which is *also* the closest thing to Tbilisi
you'll get). You'd gain: real `scheduledTasks`, WebSockets, persistent DB connections (no pooler
gymnastics), a single always-warm process, and no Neon cold starts. You'd pay: reimplementing the
Prismic cache as `swr` + Redis/Upstash storage, running your own reverse proxy/TLS/CDN, and
single-instance croner discipline. If the site's marketing traffic is modest and the team is
comfortable with a box, **this is a defensible choice** and arguably a simpler system. It is not the
default recommendation only because it throws away work that already exists and works.

**Cloudflare Workers is the weakest fit:** no `isr` support at all, 10 ms CPU per cron on free, and
you'd be running Postgres over a pooler from an isolate. Not worth it here.

---

## 8. Testing

Nothing exists today. Here is a working setup.

### Versions, verified 2026-08-24

- `vitest` **4.1.11** (2026-08-18). Vitest 5.0.0-rc.2 exists (2026-08-17) — **don't**.
- `@nuxt/test-utils` **4.1.0** (2026-07-27). Its `peerDependencies` require **`vitest: "^4.0.2"`**
  (verified from the published package metadata), so Vitest 4 is the pinned pairing.
- `@testcontainers/postgresql` **12.1.0** (2026-08-04); `testcontainers` 12.1.0 same day.

### What `setup()` gives you

From the [Nuxt testing docs](https://nuxt.com/docs/4.x/getting-started/testing) and the
[`TestOptions` type](https://github.com/nuxt/test-utils/blob/main/src/e2e/types.ts): `setup()` builds
your Nuxt app and boots the **real Nitro server** as a child process, then exposes `$fetch(url)`
(HTML string), `fetch(url)` (full response incl. headers — this is how you assert on `Set-Cookie`),
`url(path)`, `createPage(url)` (Playwright), `getServerLogs()` / `clearServerLogs()`.

Options that matter here: `rootDir`, `build` (default `true`), `server` (default `true`), `host`
(test a deployed URL instead of building), `port`, `nuxtConfig: NuxtConfig` (override config for the
test build), **`env?: Record<string, unknown>`** (extra env for the server subprocess), `setupTimeout`
(default 120000, 240000 on Windows), `captureServerLogs`.

`env` is the important one: in `src/e2e/server.ts` the server is spawned with
`env: { ...process.env, PORT, HOST, NODE_ENV: 'test', ...ctx.options.env, ...options.env }`. That is
how you point the built server at your throwaway Postgres.

Also useful for component-level work: `mountSuspended`, `renderSuspended`, `mockNuxtImport`,
`mockComponent`, `registerEndpoint` — but **do not use `registerEndpoint` to fake `/api/bets`.**
Mocking the endpoint you're trying to prove correct proves nothing.

### Real Postgres, not mocks

Vitest [`globalSetup`](https://vitest.dev/config/globalsetup) runs once per project and can hand data
to tests: "you can pass down serializable data to tests via `provide` method and read them in your
tests via `inject` imported from `vitest`". Use it to boot a container and publish the URI.

`pnpm add -D vitest@^4.1.11 @nuxt/test-utils@^4.1.0 @testcontainers/postgresql@^12.1.0 happy-dom @vue/test-utils`

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import { defineVitestProject } from '@nuxt/test-utils/config'

export default defineConfig({
  test: {
    projects: [
      // Pure logic: multiplier maths, parlay combination, payout rounding.
      // Fast, no container, no Nuxt.
      {
        test: {
          name: 'unit',
          include: ['test/unit/**/*.test.ts'],
          environment: 'node',
        },
      },
      // Server + DB integration: real Nitro, real Postgres.
      {
        test: {
          name: 'server',
          include: ['test/server/**/*.test.ts'],
          environment: 'node',
          globalSetup: ['./test/setup/postgres.ts'],
          testTimeout: 30_000,
          hookTimeout: 180_000, // first run pulls the postgres image
          fileParallelism: false, // one Nitro server + one DB, shared
        },
      },
      // Component tests in the Nuxt environment.
      await defineVitestProject({
        test: {
          name: 'nuxt',
          include: ['test/nuxt/**/*.test.ts'],
          environment: 'nuxt',
        },
      }),
    ],
  },
})
```

```ts
// test/setup/postgres.ts
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import type { TestProject } from 'vitest/node'

let container: StartedPostgreSqlContainer

export async function setup(project: TestProject) {
  container = await new PostgreSqlContainer('postgres:17-alpine').start()
  const url = container.getConnectionUri()

  // Apply drizzle migrations against the fresh container.
  const { drizzle } = await import('drizzle-orm/postgres-js')
  const { migrate } = await import('drizzle-orm/postgres-js/migrator')
  const postgres = (await import('postgres')).default
  const sql = postgres(url, { max: 1 })
  await migrate(drizzle(sql), { migrationsFolder: './server/db/migrations' })
  await sql.end()

  project.provide('databaseUrl', url)
}

export async function teardown() {
  await container?.stop()
}
```

```ts
// test/setup/env.d.ts  — types for inject()
declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string
  }
}
export {}
```

```ts
// test/server/bets.test.ts
import { describe, expect, it, inject } from 'vitest'
import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'

describe('bet placement', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('../..', import.meta.url)),
    server: true,
    build: true,
    env: {
      DATABASE_URL: inject('databaseUrl'),
      NUXT_SESSION_PASSWORD: 'test-password-at-least-32-characters-long',
    },
  })

  it('rejects a stake larger than the balance', async () => {
    const cookie = await loginAs('alice') // helper: POST /api/auth/login, read set-cookie
    await expect(
      $fetch('/api/bets', {
        method: 'POST',
        headers: { cookie },
        body: { eventId: EVENT, legs: [{ fightId: FIGHT, pick: 'A' }], stake: 999_999 },
      }),
    ).rejects.toMatchObject({ status: 422 })
  })

  it('never lets concurrent bets overdraw the balance', async () => {
    const cookie = await loginAs('bob') // balance: 100
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        $fetch('/api/bets', {
          method: 'POST',
          headers: { cookie },
          body: { eventId: EVENT, legs: [{ fightId: FIGHT, pick: 'A' }], stake: 100 },
        })),
    )
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    expect(await balanceOf('bob')).toBe(0)
  })

  it('does not serve a cached /api/me across sessions', async () => {
    const a = await fetch('/api/me', { headers: { cookie: await loginAs('alice') } })
    const b = await fetch('/api/me', { headers: { cookie: await loginAs('bob') } })
    expect(await a.json()).not.toEqual(await b.json())
  })
})
```

Notes:

- **Docker is required** for testcontainers. If CI can't run Docker, swap the `globalSetup` for a
  `docker compose` Postgres service and read `DATABASE_URL` from the environment — the rest of the
  config is unchanged. Testcontainers' advantage is a guaranteed-clean database per run.
- `@testcontainers/postgresql` supports `await using container = await new PostgreSqlContainer(IMAGE).start()`
  for scope-based disposal, but `globalSetup`/`teardown` is the right shape for a shared container.
- **The concurrency test above is the one that matters.** It is the only way to prove §5's locking
  actually holds, and it cannot be written against a mock.
- Add `"test": "vitest run"`, `"test:watch": "vitest"` to `package.json` scripts.
- `build: true` means each `setup()` does a full Nuxt build — slow. Keep server tests in **one**
  describe block per file and `fileParallelism: false`, or share a server across files by pointing
  `host` at a manually started one in CI.

---

## Open decisions

| Decision | Options | What each costs |
| --- | --- | --- |
| **Hosting** (blocks everything else) | **Vercel Pro** / long-running Node container / Cloudflare Workers | Vercel: keeps ISR, forces Pro (~$20/user/mo, unverified), no `scheduledTasks`, no WebSockets. Container: real cron + WebSockets + no cold starts, but you rebuild the Prismic cache as `swr` + Redis and run your own TLS/CDN. Cloudflare: `isr` doesn't exist there, 10 ms cron CPU on free — not recommended. |
| **Auth library** | **`nuxt-auth-utils`** / Better Auth / `@nuxtjs/supabase` | auth-utils: no DB session reads, ISR-aware, but you write email verification, password reset, and rate limiting. Better Auth: those flows included + built-in rate limiting, but 4 extra tables, no Nuxt module, no cache awareness. Supabase Auth: most included, but ties your DB vendor and adds a second identity system. |
| **Do you need email verification / password reset at launch?** | Yes → Better Auth. No → `nuxt-auth-utils`. | This single answer decides the auth pick. If accounts are throwaway (virtual coins, no real money), OAuth-only with `nuxt-auth-utils` skips the entire email problem — no SMTP, no deliverability, no reset flow. Worth considering. |
| **DB vendor** | **Neon Frankfurt** / Supabase Frankfurt / plain managed instance | Neon free: 0.5 GB, suspends after 5 min (cold starts) but doesn't pause the project. Supabase free: 500 MB, **pauses after 1 week idle** — bad for bursty fight-night traffic; budget $25/mo Pro. Plain managed: closest possible region and no pooler weirdness, but you operate PgBouncer, backups, and upgrades yourself. |
| **ORM** | **Drizzle 0.45.2** / Prisma 7.9.1 | Both are mid-major-transition (Drizzle 1.0-rc since Apr 2026; Prisma 8-rc is a rewrite). Drizzle: reviewable SQL migrations, zero deps, no codegen. Prisma: better-known, richer tooling, heavier install, and a v8 migration ahead that "almost every application" will feel. |
| **Expected concurrent users** | Unknown — **you must supply this** | Under ~100 concurrent, everything above is comfortably free-tier-shaped and the pooler barely matters. Above that, Neon compute sizing, Vercel function concurrency, and pool limits all need actual numbers. Several recommendations here (Neon Free vs Launch, whether to disable scale-to-zero) are unanswerable without it. |
| **Budget** | Unknown — **you must supply this** | The floor for a working system is roughly: Vercel Pro (cron) + Neon Free or Launch. Hobby + free DB is only viable if settlement is manually triggered by an admin, which is a legitimate v1 (see below). |
| **Manual vs automatic settlement for v1** | Admin clicks "settle event" / cron polls every 5 min | Manual: **works on Vercel Hobby**, no cron, no secret to manage, and someone is watching the first payouts anyway. Automatic: needs Pro. Shipping manual first and adding the cron later costs nothing — the endpoint is identical. |
| **Leaderboard freshness** | `isr: 30` / `isr: false` / client-poll | 30s ISR is cheap and correct (the leaderboard is identical for every viewer). `isr: false` is fresher and costs a function invocation per view. Decide by whether "top 10 is 30 seconds stale" is a product problem. |

---

## Sources

### Primary

**Nuxt / Nitro**

- Nuxt 4 hybrid rendering & route rules — https://nuxt.com/docs/4.x/guide/concepts/rendering
- Nuxt config reference (`routeRules` marked experimental) — https://nuxt.com/docs/4.x/api/nuxt-config
- Nuxt 4 `server/` directory — https://nuxt.com/docs/4.x/guide/directory-structure/server
- Nuxt 4 `useRequestFetch` — https://nuxt.com/docs/4.x/api/composables/use-request-fetch
- Nuxt 4 testing — https://nuxt.com/docs/4.x/getting-started/testing
- Nuxt 4 deployment / `NITRO_PRESET` — https://nuxt.com/docs/4.x/getting-started/deployment
- Nitro **v2** cache (the version this repo runs) — https://v2.nitro.build/guide/cache
- Nitro **v2** tasks + platform support table — https://v2.nitro.build/guide/tasks
- Nitro **v2** Vercel provider (ISR options, `bypassToken`, `allowQuery`) — https://v2.nitro.build/deploy/providers/vercel
- Nitro **v2** Node runtime / `node_cluster` — https://v2.nitro.build/deploy/runtimes/node
- Nitro **v3 beta** tasks (Vercel cron auto-generation — *not* in v2) — https://nitro.build/docs/tasks
- Nitro **v3 beta** Cloudflare provider — https://nitro.build/deploy/providers/cloudflare
- Nitro tasks experimental-status tracking issue — https://github.com/nitrojs/nitro/issues/1974
- **Installed source, read directly** (`node_modules/.pnpm/nitropack@2.13.4/…`):
  `dist/core/index.mjs` (`normalizeRouteRules`, `scanTasks`), `dist/runtime/internal/cache.mjs`
  (cache key, `event.context.cache`), `dist/runtime/internal/app.mjs` (route-rule cache wrapping),
  `dist/runtime/internal/task.mjs` (`startScheduleRunner`), `dist/runtime/internal/route-rules.mjs`,
  `dist/presets/vercel/utils.mjs`, `dist/presets/netlify/runtime/netlify.mjs`,
  `dist/presets/cloudflare/runtime/_module-handler.mjs`.

**Auth**

- `nuxt-auth-utils` README — https://github.com/atinux/nuxt-auth-utils/blob/main/README.md
- `nuxt-auth-utils` cached-route session plugin — https://github.com/atinux/nuxt-auth-utils/blob/main/src/runtime/app/plugins/session.server.ts
- `nuxt-auth-utils` releases — https://github.com/atinux/nuxt-auth-utils/releases
- Better Auth — Nuxt integration — https://www.better-auth.com/docs/integrations/nuxt
- Better Auth — database & schema — https://www.better-auth.com/docs/concepts/database
- Better Auth — email & password — https://www.better-auth.com/docs/authentication/email-password
- Better Auth — security (CSRF, trusted origins, rate limiting) — https://www.better-auth.com/docs/reference/security
- Lucia — deprecation notice — https://lucia-auth.com/
- `@sidebase/nuxt-auth` introduction (NextAuth v4.21.1 pin) — https://auth.sidebase.io/guide/getting-started/introduction
- `@nuxtjs/supabase` docs — https://supabase.nuxtjs.org/

**Database / ORM**

- Drizzle — connect to Neon (http vs websocket vs node-postgres) — https://orm.drizzle.team/docs/connect-neon
- Drizzle — transactions — https://orm.drizzle.team/docs/transactions
- Drizzle — `drizzle-kit generate` — https://orm.drizzle.team/docs/drizzle-kit-generate
- Drizzle releases — https://github.com/drizzle-team/drizzle-orm/releases
- Prisma — deploy to Vercel — https://www.prisma.io/docs/orm/prisma-client/deployment/serverless/deploy-to-vercel
- Prisma — database connections — https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections
- Prisma — upgrading to v7 — https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7
- Prisma releases (v8 RC line) — https://github.com/prisma/prisma/releases
- PostgreSQL — explicit locking / `FOR UPDATE` — https://www.postgresql.org/docs/current/explicit-locking.html

**Postgres hosting**

- Neon regions — https://neon.com/docs/introduction/regions
- Neon connection pooling — https://neon.com/docs/connect/connection-pooling
- Neon serverless driver (HTTP vs WebSocket, no interactive transactions over HTTP) — https://neon.com/docs/serverless/serverless-driver
- Neon pricing — https://neon.com/pricing
- Supabase regions — https://supabase.com/docs/guides/platform/regions
- Supabase connecting to Postgres (Supavisor modes, prepared statements) — https://supabase.com/docs/guides/database/connecting-to-postgres
- Supabase pricing — https://supabase.com/pricing

**Platforms**

- Vercel — CDN cache & cacheable-response criteria — https://vercel.com/docs/caching/cdn-cache
- Vercel — cache status & bypass reasons — https://vercel.com/docs/caching/cache-status
- Vercel — ISR — https://vercel.com/docs/incremental-static-regeneration
- Vercel — Nuxt framework guide (`routeRules` ISR, single bundled function) — https://vercel.com/docs/frameworks/full-stack/nuxt
- Vercel — Cron Jobs — https://vercel.com/docs/cron-jobs
- Vercel — Cron usage & pricing (Hobby = once/day) — https://vercel.com/docs/cron-jobs/usage-and-pricing
- Vercel — function limits (duration, memory, body size) — https://vercel.com/docs/functions/limitations
- Vercel — function regions (Hobby = single region, default `iad1`) — https://vercel.com/docs/functions/configuring-functions/region
- Cloudflare — Cron Triggers — https://developers.cloudflare.com/workers/configuration/cron-triggers/
- Cloudflare — Workers limits (10 ms cron CPU on free) — https://developers.cloudflare.com/workers/platform/limits/

**Testing**

- `@nuxt/test-utils` `TestOptions` type (`env`, `nuxtConfig`, …) — https://github.com/nuxt/test-utils/blob/main/src/e2e/types.ts
- `@nuxt/test-utils` server spawn / env passing — https://github.com/nuxt/test-utils/blob/main/src/e2e/server.ts
- Vitest `globalSetup` (`provide`/`inject`, `TestProject`) — https://vitest.dev/config/globalsetup
- Testcontainers for Node — PostgreSQL module — https://node.testcontainers.org/modules/postgresql/

**Version & date verification**

- npm registry metadata (`dist-tags`, `time`, `deprecated`, `peerDependencies`, `dist.unpackedSize`)
  fetched 2026-08-24 from `https://registry.npmjs.org/<pkg>` for: `nuxt`, `nitropack`,
  `nuxt-auth-utils`, `better-auth`, `@better-auth/cli`, `@better-auth/redis-storage`,
  `@sidebase/nuxt-auth`, `lucia`, `@nuxtjs/supabase`, `@clerk/nuxt`, `drizzle-orm`, `drizzle-kit`,
  `prisma`, `@prisma/client`, `@nuxt/test-utils`, `vitest`, `testcontainers`,
  `@testcontainers/postgresql`.

### Secondary

None used. Every claim above traces to a first-party doc, a first-party repo, npm registry metadata,
or source code read directly out of `node_modules` in this repo.

### Explicitly not verified

- Vercel Pro seat price (quoted from memory as ~$20/user/mo — **check vercel.com/pricing**).
- Clerk pricing and its Nuxt integration details.
- Netlify Scheduled Functions (mentioned only as an option; not researched).
- The exact header Vercel Cron sends for `CRON_SECRET` authentication — read
  https://vercel.com/docs/cron-jobs/manage-cron-jobs before implementing.
- Any actual latency measurement from Tbilisi to Frankfurt, or Neon/Supabase cold-start durations.
  **Measure these before committing.**
- Real bundle size / cold-start delta between Drizzle and Prisma 7 in a built Nitro Vercel function.
  The install-size figures quoted are unpacked package size, not deployed bundle size.
