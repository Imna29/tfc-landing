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
 * `users` are ours, `role` among them — see {@link ROLES} for why it is not
 * one of its.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  pgTable,
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
 */
export const ROLES = ["fan", "admin"] as const;

export type Role = (typeof ROLES)[number];

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
