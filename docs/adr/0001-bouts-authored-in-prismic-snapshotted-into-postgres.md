---
status: accepted
---

# Bouts are authored in Prismic but snapshotted into Postgres before a card opens

Fighters are already Prismic documents and the content team works there, so a new `event`
custom type with a repeatable `bouts` group linking to `fighter` is the natural authoring
surface — and the marketing site needs structured events regardless, since today an event
is only loose text fields inside `UpcomingEventsGrid` and `EventArchiveTable` slices.

But Prismic must never be the source of truth once Coins are at risk: it has no
transactional guarantees, no audit trail, a 10-minute ISR cache lag, and any editor can
silently rewrite a Bout after Entries are submitted. So when an admin opens a card, the Event
and its Bouts are **copied into Postgres**, and from that moment settlement reads only
Postgres. Editing the Prismic document afterwards changes marketing copy, never a Bout a fan
has predicted on.

## Consequences

- A Bout exists in two places with two different jobs. The Prismic copy is display; the
  Postgres copy is the one a Prediction references by ID.
- Fixing a genuine authoring mistake after a card is open is deliberately awkward: it needs
  an explicit re-import while the card is closed, not a quiet CMS edit.
