/**
 * The database schema. One table per exported const; migrations are generated
 * from this file with `pnpm db:generate` and reviewed as SQL before they run.
 *
 * Column names are written out rather than inferred from a `casing` option,
 * because that option is one of the things changing in Drizzle 1.0.
 *
 * `users`, `sessions`, `accounts` and `verifications` are the four tables
 * `better-auth` requires. Their columns are its columns and are named the way
 * it names them — see `server/utils/auth.ts`, which is where the mapping from
 * its vocabulary to this one is written down. The four extra columns on
 * `users` are ours, `role` among them — see {@link Role} for why it is not
 * one of its.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * What a user is allowed to do: play, or also run the game.
 *
 * An admin is a fan with a role, not a second kind of account — they hold
 * Coins and can play like anyone else. Deliberately not a `better-auth`
 * field: nothing it serves may read or write this column, so no route can
 * grant it and no sign-up can ask for it. The only way to become an admin is
 * the `update` in the README, run by hand against the database.
 *
 * Spelled out here and again in the `users_role_known` check constraint
 * below, rather than both derived from one array: a constraint built from an
 * array renders as `in ($1, $2)` in the generated migration, which is not a
 * constraint at all.
 */
export type Role = "fan" | "admin";

/**
 * A person with an account.
 *
 * `username` is the only column any public page may show. First and last name
 * exist solely so TFC can match a Prize winner to a person, and are never
 * returned by the API at all; `date_of_birth` is the only evidence of the 18+
 * gate, and is stored as the date it is rather than as an age that would be
 * wrong the morning after a birthday. See ADR-0007.
 *
 * There is deliberately no avatar column: fans are identified by username
 * (ADR-0009), so `better-auth`'s optional `image` field has nowhere to be
 * written and is never asked for.
 *
 * `role` is what the admin area checks on every request. It defaults to `fan`,
 * so an account is only ever an admin because someone said so in SQL.
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    username: text("username").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    dateOfBirth: date("date_of_birth", { mode: "string" }).notNull(),
    role: text("role").$type<Role>().notNull().default("fan"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Case-insensitive, because a username is how one fan tells another apart
    // on a leaderboard and `ironmike` beside `IronMike` is not two people
    // anyone can tell apart.
    uniqueIndex("users_username_unique").on(sql`lower(${table.username})`),
    // Granting the admin role is a hand-written `update` (see the README), and
    // a hand-written `update` can be misspelled. Postgres refuses `'Admin'`
    // here rather than storing a role that quietly matches nothing.
    check("users_role_known", sql`${table.role} in ('fan', 'admin')`),
  ],
);

/** One signed-in device. `better-auth` reads a session by its token cookie. */
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  token: text("token").notNull().unique(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * How a user proves who they are. One row per credential: today that is only
 * ever the hashed password from signing up.
 *
 * `better-auth` calls this an account; a fan calls their whole login an
 * account. Nothing outside `server/utils/auth.ts` should need to read this table.
 */
export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerId: text("provider_id").notNull(),
    issuer: text("issuer").notNull(),
    accountId: text("account_id").notNull(),
    password: text("password"),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("accounts_issuer_account_id_unique").on(table.issuer, table.accountId)],
);

/**
 * A short-lived token sent to an email address: address verification now,
 * password reset when #5 lands. Rows are consumed on use and expire on their
 * own.
 */
export const verifications = pgTable("verifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Whether a Season is being played, or is over.
 *
 * Closing one freezes its final standings and is #19's work; what this ticket
 * needs from it is the `seasons_one_open` index below, which is what makes
 * "the current Season" a fact rather than whichever row happens to sort last.
 *
 * Spelled out here and again in `seasons_status_known`, for the reason given
 * on {@link Role}.
 */
export type SeasonStatus = "open" | "closed";

/**
 * An admin-declared block of Events, and the scope of every Balance and
 * leaderboard.
 *
 * Every fan starts a Season with the same hundred Coins and there are no
 * top-ups: a fan who reaches zero waits for the next Season. That rule is only
 * as good as the Coin ledger's constraints — see {@link coinTransactions}.
 *
 * `openedBy` is which admin opened it. Nothing reads it yet; it is recorded
 * because "who did this, and when" is the question a Season nobody remembers
 * opening will be asked, and it cannot be answered later if it was not
 * written down at the time.
 */
export const seasons = pgTable(
  "seasons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    status: text("status").$type<SeasonStatus>().notNull().default("open"),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
    openedBy: uuid("opened_by")
      .notNull()
      .references(() => users.id),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (table) => [
    // A Season's name is how a fan tells last year's standings from this
    // year's, so two Seasons called "Season 2" would make the history
    // unreadable. Case-insensitive for the same reason usernames are.
    uniqueIndex("seasons_name_unique").on(sql`lower(${table.name})`),
    // At most one Season open at a time. Postgres holds this rather than a
    // route checking first and inserting after, because two admins opening a
    // Season in the same moment would both find nothing open and both be
    // right — and the second Season would grant everybody another hundred
    // Coins.
    uniqueIndex("seasons_one_open")
      .on(table.status)
      .where(sql`${table.status} = 'open'`),
    check("seasons_status_known", sql`${table.status} in ('open', 'closed')`),
    // A closed Season without the date it closed on is a frozen standing
    // nobody can date, and an open one carrying a closing date is a row two
    // columns disagree about.
    check(
      "seasons_closed_is_dated",
      sql`(${table.status} = 'closed') = (${table.closedAt} is not null)`,
    ),
  ],
);

/**
 * What moved Coins. One kind per ticket that can move them, added by that
 * ticket's own migration.
 *
 * Today there is exactly one, and that is the point: a Season grant is the
 * only way Coins come into existence, `coin_transactions_kind_known` is what
 * says so, and the ticket that adds a commitment or a Reward has to say so
 * again in SQL that somebody reads. A kind permitted before anything writes it
 * is a kind nobody has thought about.
 */
export type CoinTransactionKind = "season_grant";

/** What a Coin Transaction points at as the thing that caused it. */
export type CoinTransactionCause = "season";

/**
 * The Coin ledger: one append-only row per movement of Coins, and the source
 * of truth for every Balance (ADR-0003).
 *
 * There is no mutable balance column anywhere in this schema. {@link balanceCache}
 * is a materialised copy of what these rows add up to, and can be thrown away
 * and rebuilt from them at any time.
 *
 * **Append-only is enforced by the database.** The migration that creates this
 * table also creates a trigger that refuses every `update` and `delete`, so a
 * mistake is corrected by writing a reversing row rather than by rewriting
 * what happened — which is the whole reason ADR-0003 chose a ledger.
 *
 * `seasonId` is the scope: which Season's Balance this row moves. `cause` and
 * `causeId` are the provenance: what caused it to be written. Today they are
 * the same Season, and they will not be for long — an Entry's commitment is
 * scoped to a Season and caused by an Entry. They are here from the first row
 * rather than added with the second kind because provenance cannot be
 * back-filled: rows written before anyone recorded what caused them can never
 * be made to explain themselves.
 *
 * Neither foreign key cascades, unlike the ones on `sessions` and `accounts`:
 * deleting a fan who holds Coins is refused rather than quietly taking their
 * ledger with them. Nothing deletes a fan today, and when something needs to,
 * what happens to their rows is a decision somebody makes then.
 *
 * The constraints are what make the Season rules' "no mid-Season top-ups"
 * (`CONTEXT.md`) true rather than merely intended. A fan gets one grant per Season and it is worth
 * exactly the hundred Coins `STARTING_BALANCE` names in `shared/coins.ts`,
 * whatever code asks for — including code nobody has written yet, and a
 * hand-typed `insert` at three in the morning.
 */
export const coinTransactions = pgTable(
  "coin_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    kind: text("kind").$type<CoinTransactionKind>().notNull(),
    /** Signed: Coins arriving are positive, Coins leaving are negative. */
    amount: integer("amount").notNull(),
    /** Why, in a sentence, for whoever has to explain a Balance to a fan. */
    reason: text("reason").notNull(),
    cause: text("cause").$type<CoinTransactionCause>().notNull(),
    causeId: uuid("cause_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // The whole Coin printer, shut. One grant per fan per Season, refused by
    // Postgres rather than by whoever remembers to check first.
    uniqueIndex("coin_transactions_one_grant_per_fan")
      .on(table.userId, table.seasonId)
      .where(sql`${table.kind} = 'season_grant'`),
    // Every Balance read and every rebuild groups by these two.
    index("coin_transactions_by_fan").on(table.seasonId, table.userId),
    check("coin_transactions_kind_known", sql`${table.kind} in ('season_grant')`),
    check("coin_transactions_cause_known", sql`${table.cause} in ('season')`),
    // A row that moves nothing is not a movement; it is a row somebody wrote
    // by accident, and it makes the ledger longer without making it say more.
    check("coin_transactions_moves_coins", sql`${table.amount} <> 0`),
    check("coin_transactions_reason_is_written", sql`length(trim(${table.reason})) > 0`),
    // Hard-coded rather than read from a setting, and so a migration to
    // change. Everyone starting a Season on the same number is the level field
    // the whole competition rests on; changing it is a decision somebody
    // should have to write down and have reviewed.
    check(
      "coin_transactions_grant_is_the_starting_balance",
      sql`${table.kind} <> 'season_grant' or (${table.amount} = 100
        and ${table.cause} = 'season' and ${table.causeId} = ${table.seasonId})`,
    ),
  ],
);

/**
 * The materialised Balance: what one fan's Coin Transactions add up to in one
 * Season.
 *
 * Named a cache on purpose. ADR-0003 forbids a mutable balance column, and
 * this looks exactly like one at a glance — so it says at every call site that
 * it is derived data, safe to delete, and rebuildable from
 * {@link coinTransactions} by `rebuildBalanceCache` in `server/utils/coins.ts`. It exists because a
 * leaderboard and a site header cannot aggregate the whole ledger on every
 * request (ADR-0009 rules out putting Redis in front of that).
 *
 * `balance` is deliberately not constrained to be positive. Reversing a Reward
 * a fan has already committed elsewhere takes them below zero, and that is a
 * correction working (ADR-0003), not a bug to be refused.
 */
export const balanceCache = pgTable(
  "balance_cache",
  {
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    balance: integer("balance").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.seasonId, table.userId] })],
);
