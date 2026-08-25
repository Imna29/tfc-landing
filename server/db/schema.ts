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

/**
 * Where a Bout is: not yet taking Predictions, or taking them.
 *
 * `closed` is where a Bout starts. An admin prices its Outcomes and opens it
 * (#9), and from that moment it is a Bout fans hold Coins against — which is
 * what {@link bouts} is careful about below.
 *
 * `locked` arrives with #12 and `settled` with #14, each added by that
 * ticket's own migration, for the reason given on {@link CoinTransactionKind}:
 * a state permitted before anything writes it is a state nobody has thought
 * about. Everything here that asks whether a Bout is still untouched asks
 * whether it is `closed`, so those two land without changing what this ticket
 * decided.
 */
export type BoutStatus = "closed" | "open";

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
 * from one query rather than from Postgres and a CMS together.
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
    blueName: text("blue_name").notNull(),
    blueFighterId: text("blue_fighter_id"),
    blueFighterUid: text("blue_fighter_uid"),
    blueImageUrl: text("blue_image_url"),
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
    check("bouts_status_known", sql`${table.status} in ('closed', 'open')`),
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
