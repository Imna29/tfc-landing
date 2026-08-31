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
  foreignKey,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
// Relative rather than `#shared/…`, unlike every other server module: this
// file is also compiled by `drizzle-kit generate`, which knows nothing of the
// alias Nuxt provides. Type-only, so the import is erased before either sees
// it — the values these name are spelled out again in the check constraints
// below, where Postgres can hold them.
import type { EntryStatus } from "../../shared/entries";
import type { BoutStatus, Corner } from "../../shared/events";
import type { LockKind } from "../../shared/locks";
import type { Method, Question } from "../../shared/pricing";
import type { NoResultReason, RecordedMethod } from "../../shared/results";

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
 * Four of them, and the discipline is the point: Coins come into existence as
 * a Season grant, leave a Balance as an Entry's commitment, come back as the
 * Reward a winning Entry earned, and come back untouched as the refund a
 * cancelled Entry returns. `coin_transactions_kind_known` is what says so, and
 * the ticket that adds the reversal a corrected result writes (#16) has to say
 * so again in SQL that somebody reads. A kind permitted before anything writes
 * it is a kind nobody has thought about.
 *
 * `entry_refund` is the row a cancellation writes and, when #15 lands, the row
 * an Entry of nothing but No Results writes as well: the same movement for the
 * same reason, the Amount back in full. What has to widen for that is
 * `cancelled_entries_are_refunded`, which today ties a refund to a cancelled
 * Entry and only to one.
 *
 * Each of them is also held to a direction and a cause, because a Reward that
 * took Coins away or pointed at a Season would be a Balance nobody could
 * explain from the row that moved it. See the check constraints below.
 */
export type CoinTransactionKind =
  | "season_grant"
  | "entry_commitment"
  | "entry_reward"
  | "entry_refund";

/** What a Coin Transaction points at as the thing that caused it. */
export type CoinTransactionCause = "season" | "entry";

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
 * `causeId` are the provenance: what caused it to be written. A Season grant is
 * scoped to and caused by the same Season; an Entry's commitment is scoped to
 * the Season being played and caused by the Entry. They were here from the
 * first row rather than added with the second kind because provenance cannot be
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
    // One commitment per Entry, so that a submission retried after a dropped
    // connection cannot charge a fan twice for the Entry it already wrote.
    uniqueIndex("coin_transactions_one_commitment_per_entry")
      .on(table.causeId)
      .where(sql`${table.kind} = 'entry_commitment'`),
    // And one Reward per Entry, which is the last line of "settling the same
    // Bout twice does not pay anybody twice". Settlement asks first — it grades
    // only Entries still Open, and a Bout carries one Result — but the Coins
    // this guards are the ones nobody would notice going out, so it is held
    // here as well as asked about there.
    uniqueIndex("coin_transactions_one_reward_per_entry")
      .on(table.causeId)
      .where(sql`${table.kind} = 'entry_reward'`),
    // And one refund per Entry, which is what makes "a cancelled Entry cannot
    // be double-refunded under concurrent requests" true of something other
    // than the order two requests happened to arrive in. The row lock in
    // `cancelEntry` is what they actually queue behind; this is what holds if
    // anything ever asks without taking it.
    uniqueIndex("coin_transactions_one_refund_per_entry")
      .on(table.causeId)
      .where(sql`${table.kind} = 'entry_refund'`),
    // Every Balance read and every rebuild groups by these two.
    index("coin_transactions_by_fan").on(table.seasonId, table.userId),
    check(
      "coin_transactions_kind_known",
      sql`${table.kind} in ('season_grant', 'entry_commitment', 'entry_reward', 'entry_refund')`,
    ),
    check("coin_transactions_cause_known", sql`${table.cause} in ('season', 'entry')`),
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
    // Coins committed to an Entry leave the Balance, and they leave it for
    // that Entry: a commitment that added Coins, or that pointed at anything
    // else, would be a Balance nobody could explain from the row that moved
    // it. How many is the Entry's own business — the Amount is checked
    // against what the fan holds by `entry_commitments_are_within_the_balance`.
    check(
      "coin_transactions_commitment_leaves_the_balance",
      sql`${table.kind} <> 'entry_commitment'
        or (${table.amount} < 0 and ${table.cause} = 'entry')`,
    ),
    // And a Reward returns Coins to it, for the Entry that earned them. The
    // mirror of the rule above, and worth stating separately: these are the
    // only two rows the ledger writes about an Entry, and a sign typed the
    // wrong way round on either is Coins created or destroyed with no error
    // anywhere.
    check(
      "coin_transactions_reward_returns_coins",
      sql`${table.kind} <> 'entry_reward'
        or (${table.amount} > 0 and ${table.cause} = 'entry')`,
    ),
    // And so does a refund, for the Entry that was cancelled. It is a third
    // row about an Entry rather than a reversal of the commitment, because the
    // ledger records what happened rather than unwriting it (ADR-0003): the
    // Coins were committed, and then they came back. How many is not something
    // a check can see — that the refund is the whole Amount and nothing else
    // is `cancelled_entries_are_refunded`'s to say.
    check(
      "coin_transactions_refund_returns_coins",
      sql`${table.kind} <> 'entry_refund'
        or (${table.amount} > 0 and ${table.cause} = 'entry')`,
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

/**
 * One TFC fight card, copied out of Prismic (ADR-0001).
 *
 * Prismic is where a card is authored and the marketing site reads it from.
 * This is the copy the game runs on: once a Bout here is open, a Prediction
 * points at a row in {@link bouts} by id, and a later edit in Prismic changes
 * the poster on the website and nothing a fan has committed Coins to.
 *
 * `prismicId` is the document the card came from, and is unique: one Prismic
 * document is one Event, however many times it is re-imported. It is a `text`
 * column rather than a `uuid` because a Prismic id (`adYU6hEAACMAWIl9`) is
 * theirs, not ours.
 *
 * `seasonId` is which Season's Coins are committed on it. It is set on every
 * import rather than only the first: a card whose Bouts are all still closed
 * has nothing riding on it, so re-importing it into the Season actually being
 * played is right, and once anything is open re-import is refused entirely.
 *
 * `importedBy` and `importedAt` are who pulled this version of the card
 * through and when, which is the question asked when a lineup on the site
 * disagrees with the lineup in the game.
 */
export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id),
    prismicId: text("prismic_id").notNull(),
    title: text("title").notNull(),
    scheduledStart: timestamp("scheduled_start", { withTimezone: true }).notNull(),
    venue: text("venue").notNull(),
    posterUrl: text("poster_url"),
    importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
    importedBy: uuid("imported_by")
      .notNull()
      .references(() => users.id),
  },
  (table) => [
    // One Event per Prismic document. Importing the same card twice would put
    // the same fights on the game twice, with Coins split between two copies
    // of every Bout.
    uniqueIndex("events_one_per_prismic_document").on(table.prismicId),
    // "The upcoming Event" is the question the public card page asks (#10).
    index("events_by_scheduled_start").on(table.scheduledStart),
    check("events_title_is_written", sql`length(trim(${table.title})) > 0`),
    check("events_venue_is_written", sql`length(trim(${table.venue})) > 0`),
  ],
);

/**
 * One scheduled fight on a card: what a fan predicts against, and what a
 * Prediction will point at.
 *
 * Both corners are written out rather than kept in a table of their own,
 * because a Bout has exactly two and always will. A corner carries the name it
 * is fought under, and — only when that corner is a fighter with a document —
 * the Prismic id, the uid their profile page is reached by, and their image.
 * A corner with only a name is the late replacement ADR-0001's authoring
 * surface has to allow for: requiring a `fighter` document 48 hours out would
 * mean either a rushed half-empty document or a Bout that cannot be published,
 * and the second costs predictions on a fight that is actually happening.
 *
 * The images are URLs into Prismic's CDN rather than files of our own
 * (ADR-0009 rules out object storage), copied at import so the card renders
 * from one query rather than from Postgres and a CMS together. The records are
 * copied for that same reason, and are the one thing on a corner that a
 * published `fighter` document may still be missing — a gap on the card rather
 * than a card that cannot be imported.
 *
 * **A Bout that is no longer closed is never deleted.** The migration that
 * creates this table also creates a trigger refusing it, so re-importing a
 * card that has been opened is refused by Postgres and not merely by the route
 * that asks first — a replaced Bout is a Prediction pointing at a fight that
 * no longer exists.
 */
export const bouts = pgTable(
  "bouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    /** Where on the card it is fought: 1 is first. */
    cardOrder: integer("card_order").notNull(),
    status: text("status").$type<BoutStatus>().notNull().default("closed"),
    redName: text("red_name").notNull(),
    redFighterId: text("red_fighter_id"),
    redFighterUid: text("red_fighter_uid"),
    redImageUrl: text("red_image_url"),
    redRecord: text("red_record"),
    blueName: text("blue_name").notNull(),
    blueFighterId: text("blue_fighter_id"),
    blueFighterUid: text("blue_fighter_uid"),
    blueImageUrl: text("blue_image_url"),
    blueRecord: text("blue_record"),
    /** The weight class, as the `division` document names it. */
    division: text("division").notNull(),
    scheduledRounds: integer("scheduled_rounds").notNull(),
    mainEvent: boolean("main_event").notNull().default(false),
    titleFight: boolean("title_fight").notNull().default(false),
  },
  (table) => [
    // Card order is how the Bouts are told apart on the card and the order
    // they are locked in, so two Bouts cannot share a place.
    uniqueIndex("bouts_one_per_place_on_the_card").on(table.eventId, table.cardOrder),
    // One Bout closes a card.
    uniqueIndex("bouts_one_main_event")
      .on(table.eventId)
      .where(sql`${table.mainEvent}`),
    check("bouts_status_known", sql`${table.status} in ('closed', 'open', 'locked', 'settled')`),
    check("bouts_card_order_is_a_place", sql`${table.cardOrder} >= 1`),
    // Spelled out again in `SCHEDULED_ROUNDS` in `shared/events.ts`, which is
    // what the import refuses with and what the Prismic field is bounded by.
    check("bouts_rounds_are_scheduled", sql`${table.scheduledRounds} between 1 and 12`),
    check(
      "bouts_corners_are_named",
      sql`length(trim(${table.redName})) > 0 and length(trim(${table.blueName})) > 0`,
    ),
    // Nobody fights themselves. Two corners pointing at one `fighter`
    // document is a Bout somebody built by copying the row above it.
    check(
      "bouts_corners_are_two_fighters",
      sql`${table.redFighterId} is null or ${table.redFighterId} <> ${table.blueFighterId}`,
    ),
    check("bouts_division_is_written", sql`length(trim(${table.division})) > 0`),
  ],
);

/**
 * One selectable answer to one Question about a Bout — "Fighter A", "KO/TKO",
 * "Round 2" — carrying the Multiplier that answer pays.
 *
 * Every Bout is imported with its whole set: two winner Outcomes, three method
 * Outcomes, and one round Outcome for each round the Bout is scheduled for, so
 * a three-round Bout has no round 4 to offer. They are written by the import
 * that creates the Bout and by nothing else — see `defaultOutcomes` in
 * `shared/pricing.ts`, which is the one place that says what a Bout is asked.
 *
 * Exactly one of `corner`, `method` and `round` is set, and which one is
 * decided by `question`; `outcomes_answers_its_question` is what says so. The
 * three unique indexes are what stop a Bout being asked the same thing twice —
 * two "Round 2" Outcomes on one Bout would be two different Multipliers for
 * one answer, and no saying which a fan was shown.
 *
 * `pricedAt` and `pricedBy` are the difference between a seeded default and a
 * price. Import seeds a Multiplier on every Outcome so that pricing a card is
 * eight numbers adjusted rather than eight authored from blank (ADR-0002), and
 * those seeded numbers are deliberately not a price: they are null here until
 * an admin has saved the Bout, and a Bout with an unpriced Outcome cannot be
 * opened. The migration that creates this table holds that with a trigger, so
 * it is true of a hand-written `update` as well as of the route.
 *
 * A Multiplier is copied onto a Prediction when an Entry is submitted and
 * never read back (ADR-0002), which is why nothing here is frozen once a Bout
 * is open: correcting a mispriced Outcome changes what the next Entry is
 * offered and never an Entry that already exists.
 */
export const outcomes = pgTable(
  "outcomes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    boutId: uuid("bout_id")
      .notNull()
      .references(() => bouts.id, { onDelete: "cascade" }),
    question: text("question").$type<Question>().notNull(),
    /** Which corner wins, on a winner Outcome. Null on every other. */
    corner: text("corner").$type<Corner>(),
    /** How the Bout ends, on a method Outcome. Null on every other. */
    method: text("method").$type<Method>(),
    /** Which round it ends in, on a round Outcome. Null on every other. */
    round: integer("round"),
    /**
     * What this answer pays.
     *
     * `numeric(5, 2)` rather than a float, because Postgres stores and
     * compares it as the decimal it is: 1.90 typed by an admin is 1.90 in the
     * column, and every Multiplier in the table is a number somebody could
     * have typed. It is handed to JavaScript as a number, which is what a
     * Prediction copies and a Reward is computed from.
     */
    multiplier: numeric("multiplier", { precision: 5, scale: 2, mode: "number" }).notNull(),
    /** When an admin priced it, or null while it is still the seeded default. */
    pricedAt: timestamp("priced_at", { withTimezone: true }),
    /** Which admin priced it, for the "who set this?" a mispriced card asks. */
    pricedBy: uuid("priced_by").references(() => users.id),
  },
  (table) => [
    uniqueIndex("outcomes_one_per_corner").on(table.boutId, table.corner),
    uniqueIndex("outcomes_one_per_method").on(table.boutId, table.method),
    uniqueIndex("outcomes_one_per_round").on(table.boutId, table.round),
    check("outcomes_question_known", sql`${table.question} in ('winner', 'method', 'round')`),
    check(
      "outcomes_corner_known",
      sql`${table.corner} is null or ${table.corner} in ('red', 'blue')`,
    ),
    check(
      "outcomes_method_known",
      sql`${table.method} is null or ${table.method} in ('ko_tko', 'submission', 'decision')`,
    ),
    // The upper bound is the one `bouts_rounds_are_scheduled` puts on a Bout.
    // That a Bout offers exactly the rounds it is scheduled for is arithmetic
    // the import does, not something Postgres can check across the two tables.
    check(
      "outcomes_round_is_a_round",
      sql`${table.round} is null or ${table.round} between 1 and 12`,
    ),
    // One answer per Outcome, decided by the Question it answers. Without this
    // a row could carry a corner and a round at once, and nothing downstream
    // would know which of them a fan had picked.
    check(
      "outcomes_answers_its_question",
      sql`(${table.question} = 'winner' and ${table.corner} is not null
            and ${table.method} is null and ${table.round} is null)
        or (${table.question} = 'method' and ${table.method} is not null
            and ${table.corner} is null and ${table.round} is null)
        or (${table.question} = 'round' and ${table.round} is not null
            and ${table.corner} is null and ${table.method} is null)`,
    ),
    // A Multiplier at or below 1 pays a correct Prediction its own Coins back
    // or less, which is not a price anybody meant to type. The ceiling is the
    // stuck key: 190 where 1.90 was meant. Spelled out again in `MULTIPLIER`
    // in `shared/pricing.ts`, which is what the admin area refuses with.
    check("outcomes_multiplier_pays", sql`${table.multiplier} > 1 and ${table.multiplier} <= 100`),
    // A price nobody is recorded as having set is a price nobody can be asked
    // about.
    check(
      "outcomes_priced_is_attributed",
      sql`(${table.pricedAt} is null) = (${table.pricedBy} is null)`,
    ),
  ],
);

/**
 * The Lock audit log: one row per Bout that has locked, saying who locked it,
 * when, and how.
 *
 * "When a fan complains their Bout locked too early, that log is the answer" —
 * which is why `lockedAt` is the moment the Bout *stopped taking Predictions*
 * rather than the moment a row happened to be written. An automatic Lock falls
 * due at a moment the card decides (`automaticLock` in `shared/locks.ts`) and
 * is applied by whichever request arrives after it; dating it at the second of
 * those would be an answer nobody could give.
 *
 * One row per Bout, held by the primary key: a Bout locks once. There is no
 * unlocking and so no second row — `a_locked_bout_is_never_reopened` refuses
 * the status going back, and `bout_locks_are_append_only` refuses this row
 * being rewritten or removed, for the reason ADR-0003 gives about the Coin
 * ledger. A log that can be edited answers nothing.
 *
 * `lockedBy` is the admin whose action locked it: the one who pressed the
 * button, or the one who entered the result that locked it behind them. It is
 * null for the two Locks the clock performs, and `bout_locks_manual_is_attributed`
 * holds the two in step — a Lock somebody caused is attributed to them, and
 * one nobody caused is attributed to nobody. `AttributedLockKind` in
 * `shared/locks.ts` is the same rule in TypeScript, so the only writer that
 * can reach this table cannot break it.
 *
 * Attribution is not the same question as whether anybody decided to lock the
 * Bout: a `result` Lock has an admin against it and was still nobody's
 * decision to close that fight at that moment. What they decided to do was
 * enter a result.
 *
 * The foreign key deliberately does not cascade, like the ones on
 * {@link predictions}: a Bout that has locked is never deleted — the trigger
 * in `0004_event_import.sql` refuses to replace one that is not closed — and
 * this is that door locked from the other side.
 */
export const boutLocks = pgTable(
  "bout_locks",
  {
    boutId: uuid("bout_id")
      .primaryKey()
      .references(() => bouts.id),
    kind: text("kind").$type<LockKind>().notNull(),
    /** When the Bout stopped taking Predictions. */
    lockedAt: timestamp("locked_at", { withTimezone: true }).notNull().defaultNow(),
    /** Which admin locked it, or null where the clock did. */
    lockedBy: uuid("locked_by").references(() => users.id),
  },
  (table) => [
    check(
      "bout_locks_kind_known",
      sql`${table.kind} in ('manual', 'scheduled', 'sweep', 'result')`,
    ),
    // A Lock somebody performed and nobody is recorded as having performed is
    // a Lock nobody can be asked about; a Lock the clock performed with an
    // admin against it is a person blamed for the clock.
    check(
      "bout_locks_manual_is_attributed",
      sql`(${table.lockedBy} is not null) = (${table.kind} in ('manual', 'result'))`,
    ),
  ],
);

/**
 * What happened in a Bout: the Result an admin recorded, and the thing every
 * Prediction on it is graded against.
 *
 * One row per Bout, which is what the primary key on `boutId` says. That is
 * also the first of the three things standing between "settle this Bout" being
 * pressed twice and a fan being paid twice: the second insert is refused by
 * the key rather than by whichever route remembered to ask.
 *
 * **A Bout with a Result is `settled`, and a settled Bout has a Result.** The
 * migration that creates this table holds it with a deferred constraint
 * trigger, the same shape `locked_bouts_are_recorded` uses and for a sharper
 * reason: a Result recorded with the Bout still taking Predictions is Coins
 * moving on a fight whose ending is on the row beside it. Tying the two
 * together is what makes that unreachable, because a settled Bout is refused a
 * Prediction by `predictions_are_made_on_open_bouts`.
 *
 * There is no append-only trigger here, unlike {@link boutLocks}. A Lock is
 * never undone, so a record of one never needs correcting; a Result is entered
 * by a person watching a fight and can be entered wrong, which is the case
 * ADR-0003 built the whole ledger around. #16 corrects one by reversing what it
 * settled and grading again — and it needs this row to be the corrected
 * Result afterwards.
 *
 * `enteredBy` and `enteredAt` are who said this is what happened and when,
 * which is the question a corrected result asks first.
 *
 * **A Bout that produced nothing gradable is recorded here too**, as a row
 * naming the reason and no winner (ADR-0005). One table rather than two,
 * because the thing being recorded is the same thing — an admin saying how a
 * Bout ended — and everything that asks "has this Bout been settled?" asks it
 * of one row either way, `results_are_entered_on_settled_bouts` included. The
 * two shapes are held apart by `bout_results_is_a_result_or_no_result`: a row
 * names a winner and a method, or it names the reason there is neither.
 */
export const boutResults = pgTable(
  "bout_results",
  {
    boutId: uuid("bout_id")
      .primaryKey()
      .references(() => bouts.id),
    /**
     * The corner that won, which every winner answer is graded against, or
     * null on a Bout that decided none (ADR-0005).
     */
    winner: text("winner").$type<Corner>(),
    /**
     * How it ended, or null on a Bout that produced nothing gradable.
     *
     * `RecordedMethod` rather than `Method`: a disqualification is a way a
     * Bout ends and is not one of the three answers the game offers, so it
     * settles the winner Question and turns the other two into No Results.
     */
    method: text("method").$type<RecordedMethod>(),
    /** The round it ended in, or null where it did not end inside one. */
    round: integer("round"),
    /**
     * Why the Bout produced nothing gradable, or null where it produced a
     * Result. The four ADR-0005 names: cancelled, withdrawal, draw, no contest.
     */
    noResult: text("no_result").$type<NoResultReason>(),
    enteredAt: timestamp("entered_at", { withTimezone: true }).notNull().defaultNow(),
    enteredBy: uuid("entered_by")
      .notNull()
      .references(() => users.id),
  },
  (table) => [
    // The round it ended in is a round the Bout was offering, held by the same
    // key a Prediction's round is (`outcomes_one_per_round`). A result naming
    // round 4 of a three-round Bout is a fight that did not happen — and it
    // would be graded against round answers no fan was ever offered.
    foreignKey({
      columns: [table.boutId, table.round],
      foreignColumns: [outcomes.boutId, outcomes.round],
      name: "bout_results_round_was_offered",
    }),
    check(
      "bout_results_winner_known",
      sql`${table.winner} is null
        or ${table.winner} in ('red', 'blue')`,
    ),
    // One value wider than `outcomes_method_known` and `predictions_method_known`,
    // and that is ADR-0005's whole point: a Bout can end by disqualification,
    // and no fan was ever offered it as an answer.
    check(
      "bout_results_method_known",
      sql`${table.method} is null
        or ${table.method} in ('ko_tko', 'submission', 'decision', 'disqualification')`,
    ),
    check(
      "bout_results_no_result_known",
      sql`${table.noResult} is null
        or ${table.noResult} in ('cancelled', 'withdrawal', 'draw', 'no_contest')`,
    ),
    // A row records a Result or a No Result, and never half of either. A row
    // naming a reason and a winner would be two accounts of one Bout with
    // nothing to say which of them every Prediction on it is graded against,
    // and a row naming neither would settle a Bout while saying nothing at all.
    check(
      "bout_results_is_a_result_or_no_result",
      sql`(${table.noResult} is null) = (${table.winner} is not null
        and ${table.method} is not null)`,
    ),
    // The same impossibility `predictions_a_round_needs_a_finish` refuses, said
    // both ways round because a Result is a statement of fact rather than a
    // pick somebody may leave shallow: a KO/TKO and a Submission happened in a
    // round, and a Decision, a disqualification and a No Result did not.
    check(
      "bout_results_a_round_is_a_finish",
      sql`(${table.round} is not null) = (${table.method} is not null
        and ${table.method} in ('ko_tko', 'submission'))`,
    ),
  ],
);

/**
 * The committed unit: between one and ten Predictions and an Amount of Coins.
 *
 * An Entry is what a fan submits and what their history lists. Its Coins leave
 * the Balance the moment it is written — as a Coin Transaction, in the same
 * transaction as these rows (ADR-0003) — so there is no state anywhere in
 * which an Entry exists and its Amount has not been committed.
 *
 * `seasonId` is which Season's Balance it moves and which leaderboard it
 * counts towards. It is the Season being played when the Entry is submitted,
 * and never changes: an Entry belongs to the competition it was made in.
 *
 * Deliberately without a combined Multiplier column, and without the Reward
 * one. Both are the product of what is on {@link predictions}, and a stored
 * copy would be a second answer to a question that already has one — the shape
 * ADR-0003 refuses for a Balance, for the same reason. What is frozen is what
 * ADR-0002 says has to be: the Multiplier of each answer, on the Prediction
 * that answered it. `potentialReward` in `shared/entries.ts` is where the two
 * become a Reward, said once for the panel a fan confirms in, the answer the
 * server sends back, and the settlement that eventually pays it.
 *
 * How many Predictions an Entry may hold is not something a column can say, so
 * the migration that creates this table holds it with a deferred constraint
 * trigger: an Entry is between one and ten Predictions when the transaction
 * that wrote it commits, whatever wrote it.
 *
 * **Cancelling is three more rules a column cannot hold**, and
 * `0010_cancelling_an_entry.sql` holds each of them: an Entry reaches
 * `cancelled` out of `open` and never leaves it, only while every Bout in it
 * is still open (`entries_are_cancelled_while_every_bout_is_open`), and never
 * apart from the refund that returns its whole Amount. The first and the last
 * are named `an_entry_returns_its_coins_once_out_of_open` and
 * `entries_are_refunded_in_full`, and are dropped and rewritten under those
 * names by `0011_no_result_and_disqualification.sql`, which widens both to the
 * second status that returns an Amount. The last is the shape
 * `results_are_entered_on_settled_bouts` uses and the same kind of promise: a
 * status and a Coin movement that are only ever true together.
 *
 * **`refunded` is held by the first and the last of those as well**, because
 * an Entry of nothing but No Results returns exactly the same Amount by
 * exactly the same movement (ADR-0005) — the difference is whose decision it
 * was, not what the Coins did. What it is deliberately not held by is the
 * middle one: it is settlement that writes it, on a card that has not only
 * started but finished.
 */
export const entries = pgTable(
  "entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    /** The Coins committed to it, which have already left the Balance. */
    amount: integer("amount").notNull(),
    status: text("status").$type<EntryStatus>().notNull().default("open"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Every Entry a fan has in a Season, which is the profile history (#17)
    // and what settlement re-reads.
    index("entries_by_fan").on(table.seasonId, table.userId),
    check(
      "entries_status_known",
      sql`${table.status} in ('open', 'won', 'lost', 'cancelled', 'refunded')`,
    ),
    // Spelled out again in `AMOUNT` in `shared/entries.ts`, which is what the
    // page and the route refuse with. There is no ceiling here: the maximum is
    // the fan's whole Balance, and the ledger is the only thing that knows it.
    check("entries_amount_is_committed", sql`${table.amount} >= 1`),
  ],
);

/**
 * One compound answer for one Bout: a winner, and optionally how and when the
 * Bout ends.
 *
 * **An Entry holds at most one Prediction per Bout** (ADR-0004), and
 * `predictions_one_per_bout_in_an_entry` is what makes that true rather than
 * intended. Winner, method and round overlap heavily — "A wins" and "A wins by
 * KO" are nearly the same prediction — so chaining them as separate items
 * would pay as though a fan had predicted two things, which is a systematic
 * overpayment somebody would find and farm. Deepening is how a Prediction
 * grows; chaining is across Bouts.
 *
 * The answer is stored as what it says rather than as a reference to the
 * Outcome that offered it, and the three foreign keys are what keep the two
 * from ever disagreeing: `(bout_id, corner)`, `(bout_id, method)` and
 * `(bout_id, round)` each point at an Outcome row of that Bout, so an answer
 * exists here only if the Bout was actually offering it — a three-round Bout
 * has no round 4 to point at. Postgres does not check a foreign key whose
 * columns include a null, which is exactly right for the two optional answers.
 *
 * Each answer carries what it paid at the moment of submission (ADR-0002).
 * Three numbers rather than the one they multiply out to, because they are
 * graded separately: a disqualification settles the winner and leaves the
 * method and round with nothing to grade (#15).
 *
 * Neither foreign key cascades. A Bout fans hold Coins against is never
 * deleted — the trigger in `0004_event_import.sql` already refuses to replace
 * one that is not closed, and this is the same door locked from the other
 * side — and an Entry is not deleted either, for the reason ADR-0003 gives
 * about the ledger: what happened is not rewritten.
 */
export const predictions = pgTable(
  "predictions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id),
    boutId: uuid("bout_id")
      .notNull()
      .references(() => bouts.id),
    /** Which corner the fan says wins. A Prediction cannot do without one. */
    corner: text("corner").$type<Corner>().notNull(),
    /** How they say it ends, or null on a Prediction that does not say. */
    method: text("method").$type<Method>(),
    /** Which round they say it ends in, or null. */
    round: integer("round"),
    /**
     * What each answer paid when the Entry was submitted.
     *
     * `numeric(5, 2)` like the Outcome it was copied from, so that the number
     * a fan was shown is the number stored, to the place they saw it.
     */
    winnerMultiplier: numeric("winner_multiplier", {
      precision: 5,
      scale: 2,
      mode: "number",
    }).notNull(),
    methodMultiplier: numeric("method_multiplier", { precision: 5, scale: 2, mode: "number" }),
    roundMultiplier: numeric("round_multiplier", { precision: 5, scale: 2, mode: "number" }),
  },
  (table) => [
    // ADR-0004, held by Postgres rather than by whichever route remembers to
    // ask. A rule that lives only in a handler is one refactor away from
    // disappearing, and this one is what stops the correlation exploit.
    uniqueIndex("predictions_one_per_bout_in_an_entry").on(table.entryId, table.boutId),
    // Everything settlement reads: every Prediction on a Bout that just got a
    // result (#14).
    index("predictions_by_bout").on(table.boutId),
    // The answer was one the Bout was offering. Each of these points at the
    // Outcome row that priced it, through the unique indexes `outcomes` already
    // has — which is also what makes "that round does not exist in this Bout"
    // a refusal from the database rather than only from a route.
    foreignKey({
      name: "predictions_winner_is_offered",
      columns: [table.boutId, table.corner],
      foreignColumns: [outcomes.boutId, outcomes.corner],
    }),
    foreignKey({
      name: "predictions_method_is_offered",
      columns: [table.boutId, table.method],
      foreignColumns: [outcomes.boutId, outcomes.method],
    }),
    foreignKey({
      name: "predictions_round_is_offered",
      columns: [table.boutId, table.round],
      foreignColumns: [outcomes.boutId, outcomes.round],
    }),
    check("predictions_corner_known", sql`${table.corner} in ('red', 'blue')`),
    check(
      "predictions_method_known",
      sql`${table.method} is null or ${table.method} in ('ko_tko', 'submission', 'decision')`,
    ),
    // The bounds `bouts_rounds_are_scheduled` puts on a Bout, and `SCHEDULED_ROUNDS`
    // in `shared/events.ts` on an import. That the round is one *this* Bout is
    // scheduled for is `predictions_round_is_offered`'s to say, because only
    // the Outcome rows know it.
    check(
      "predictions_round_is_a_round",
      sql`${table.round} is null or ${table.round} between 1 and 12`,
    ),
    // ADR-0004's impossible Prediction: a Decision is the Bout going the
    // distance, so there is no round it ends in — and a round with no method
    // at all is a Prediction nothing could grade, because "it ended in round
    // 2" and "it went to a Decision" are not answers to the same question.
    check(
      "predictions_a_round_needs_a_finish",
      sql`${table.round} is null or ${table.method} in ('ko_tko', 'submission')`,
    ),
    // An answer nobody priced, or a price for an answer nobody gave. Either
    // way it is a Prediction whose Reward cannot be worked out.
    check(
      "predictions_answers_are_priced",
      sql`(${table.method} is null) = (${table.methodMultiplier} is null)
        and (${table.round} is null) = (${table.roundMultiplier} is null)`,
    ),
    // The same bounds an Outcome's Multiplier is held to, copied here because
    // this is a copy of one: a Prediction paying ×1 or less returns a fan who
    // was right their own Coins back or fewer.
    check(
      "predictions_multipliers_pay",
      sql`${table.winnerMultiplier} > 1 and ${table.winnerMultiplier} <= 100
        and (${table.methodMultiplier} is null
          or (${table.methodMultiplier} > 1 and ${table.methodMultiplier} <= 100))
        and (${table.roundMultiplier} is null
          or (${table.roundMultiplier} > 1 and ${table.roundMultiplier} <= 100))`,
    ),
  ],
);
