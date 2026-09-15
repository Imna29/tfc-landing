---
status: accepted
---

# Bouts lock individually, advanced manually by an admin during the card

The first Bout locks automatically at its scheduled start time (with an admin override to
lock early). Every later Bout stays open and is locked by an admin as the card progresses,
so a user can still predict Bout 6 while Bout 2 is being fought.

The rejected alternative was locking the whole card at first bell, which needs no live
operator at all. We took the operational cost because keeping later Bouts open is the
engagement case for the whole product: users watch the stream with predictions still live.

## Consequences

- **This requires a human at a keyboard for the duration of every event.** An admin who
  forgets to lock a Bout leaves it predictable while it is being fought, which is the one
  failure mode that lets a user win with certainty. Automatic backstops are not optional
  extras here; they are what makes the decision survivable.
- Cancellation windows become per-Entry rather than per-card: an Entry can be cancelled
  only while every Bout in it is still open.
- A Chained Entry can span Bouts that settle hours apart, so an Entry may be decided long
  before its last Bout is fought.
