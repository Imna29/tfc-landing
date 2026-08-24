import { users } from "../../server/db/schema";
import { testDatabase } from "./database";

let sequence = 0;

type NewUser = typeof users.$inferInsert;

/**
 * Creates a user, filling in anything the test does not care about.
 *
 * Tests should pass only the fields they are actually asserting on, so that
 * what a test is about stays visible in the test.
 */
export async function createUser(overrides: Partial<NewUser> = {}) {
  sequence += 1;

  const [user] = await testDatabase()
    .insert(users)
    .values({
      username: `fan-${sequence}`,
      email: `fan-${sequence}@example.com`,
      ...overrides,
    })
    .returning();

  if (!user) throw new Error("Failed to create a user.");

  return user;
}
