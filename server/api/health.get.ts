import { count } from "drizzle-orm";
import { users } from "../db/schema";

/**
 * Proves the deployed server can reach Postgres, and is the route the tests
 * use to prove the API is never served from a cache.
 *
 * It answers with a number that changes, rather than a fixed `ok`, because a
 * fixed answer is identical whether it came from the database or from a cache.
 * The count is not sensitive: no user is identified by it.
 */
export default defineEventHandler(async () => {
  const [row] = await useDatabase().select({ total: count() }).from(users);

  return { status: "ok", users: row?.total ?? 0 };
});
