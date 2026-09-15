---
status: accepted
---

# Every deploy is a GitHub Actions run, and the schema moves first

Two long-lived branches. `dev` is deployed to Vercel's preview target and reads a
database of its own; `main` is deployed to production and reads the production
database. Work reaches `dev` by pull request, and `main` by pull request from
`dev`. Neither is pushed to directly.

Vercel's own Git integration is off — `git.deploymentEnabled: false` in
`vercel.json` — and `.github/workflows/deploy.yml` is the only thing that
deploys. That is the whole point of the arrangement. Vercel's integration builds
and publishes on a push and has nowhere to put a migration, so the schema and the
code that needs it arrive in an order nobody chose. A run that owns both can put
them in order, and can refuse to publish the code when the migration fails.

The order inside a run is build, then migrate, then deploy. Migrating after the
build means a build that fails leaves the database untouched. Migrating before
the deploy means the schema is always there before the code that reads it is
serving.

That ordering only protects migrations the *currently running* code can survive,
because the old deployment is still serving while the migration runs. An additive
migration is safe. A destructive one — a dropped or renamed column — is not, and
has to be split across two deploys: add the new shape and write both, deploy,
then drop the old shape in a second migration once nothing reads it. A [[coin]]
[[ledger]] is not a thing to be quick about ([[adr-0003]]).

`DATABASE_URL` is a GitHub *environment* secret rather than a repository one,
which is what makes the branch-to-database mapping something GitHub enforces
rather than something the workflow remembers: a run off `dev` is given the
`preview` environment, and cannot read production's connection string at all.

The build runs on Node 24 (`.node-version`), not the 26 this repo is developed
on. `vercel build` runs on the runner rather than on Vercel, and the Nitro preset
writes the running major version into each function's runtime — Vercel Functions
do not offer 26, so building on 26 produces an artifact Vercel refuses.

Every preview deployment gets its own URL, and every link TFC emails is built
from one fixed origin. So a `dev` deploy also moves a stable alias onto itself,
and `BETTER_AUTH_URL` in the preview environment names that alias. Preview leaves
`RESEND_API_KEY` unset, which writes those emails to the server log instead of
sending them: a preview must not be able to mail a fan.

None of this changes what the deployed app is. One connection per process
([[adr-0010]]) and the cache boundary ([[adr-0008]]) are decisions about the
running server, and they hold the same whoever pressed deploy.
