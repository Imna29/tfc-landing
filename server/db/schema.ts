/**
 * The database schema. One table per exported const; migrations are generated
 * from this file with `pnpm db:generate` and reviewed as SQL before they run.
 *
 * Column names are written out rather than inferred from a `casing` option,
 * because that option is one of the things changing in Drizzle 1.0.
 */
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * A person with an account.
 *
 * Only `username` is ever shown publicly — it exists so that doing well on the
 * leaderboard does not publish someone's real name. The columns signup
 * actually collects (password, real name, date of birth) arrive with the
 * accounts ticket.
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
