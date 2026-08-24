---
status: accepted
---

# A process holds one connection, so nothing may query beside a transaction it holds

The deployment target is a serverless function, which handles one request at a time and
scales by cloning. It therefore opens a single Postgres connection ([[adr-0009]] rules out
anything in front of it), and `DATABASE_POOL_MAX` defaults to 1 in production for exactly
that reason.

The consequence is easy to miss and expensive to find: **while a transaction is open, that
connection is busy, and any other query issued from inside it waits for a connection that
cannot be freed until it returns.** The request does not fail. It hangs until something
times out, and it does so only where the pool is small — which is production, and not a
developer's machine.

This was not theoretical. `better-auth` wraps signing up in a transaction and calls a
`user.create.before` hook inside it. A hook that asked "is this username taken?" deadlocked
every sign-up.

So: code that runs inside a transaction reads and writes **through that transaction**. A
question that needs a separate query is asked before the transaction opens, in the route,
where the answer can also be turned into something a fan can read.

## Consequences

- Settlement ([[adr-0003]]) grades an Entry and writes its Coin Transactions inside one
  transaction. Every read it needs is part of that transaction, not beside it.
- A `before` hook may only use what it was handed. An `after` hook is safe: `better-auth`
  queues those until the transaction has committed.
- The server test suite runs with `DATABASE_POOL_MAX=1`, so this class of bug fails in
  tests instead of in production. A test about concurrency has to raise it deliberately,
  and say why: at a pool of one the driver does the queueing a row lock is supposed to do,
  which is how a race gets hidden rather than caught.
