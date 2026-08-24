---
status: accepted
---

# Balance is derived from an append-only Coin ledger, not stored in a column

Every movement of Coins — the commitment when an Entry is submitted, a Reward, a refund, a
Season grant, a reversal — is an append-only Coin Transaction row. Balance is derived from
those rows; there is no mutable `balance` column that anything `UPDATE`s.

The reason is corrections. Results get entered wrong, and when they do, hundreds of Entries
have already settled against them. With a ledger, the fix is to write reversing Coin
Transactions and re-grade, which leaves the original mistake and its correction both
visible. With a mutable column, the only fix is to silently rewrite balances, with no
record that it happened — which is indefensible the first time a user disputes their
Balance in public.

## Consequences

- Reading a Balance is an aggregate, so leaderboards and profile headers need a cached or
  materialised Balance per user per Season. That cache is derived data and can always be
  rebuilt from the ledger.
- Settlement must be transactional: grading an Entry and writing its Coin Transactions
  happen together or not at all.
- Every Coin Transaction needs a reason and a reference to what caused it, or the audit
  trail is unreadable when someone actually needs it.
