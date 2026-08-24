---
status: accepted
---

# No Redis and no object storage in v1, despite both running locally

The local development stack runs `redis:8-alpine` and MinIO alongside Postgres, so a reader
would reasonably assume this feature uses them. It does not, deliberately.

The plausible uses were caching the leaderboard, rate-limiting submissions, and avatar
uploads. Instead: the materialised Balance lives in Postgres (needed anyway under
[[adr-0003]]), rate limiting is done at the route level, and users are identified by
username with no avatar. Neither service exists on Vercel, so adopting them would mean two
managed services to provision, two more sets of production credentials, and two more
failure modes to debug during the first live event.

## Consequences

- If avatars are wanted later, that is an S3-compatible storage decision to be made then,
  not a gap to be quietly filled with the local MinIO container.
- Leaderboard reads hit Postgres. If that becomes slow, the fix is an index or a
  materialised view before it is a cache.
