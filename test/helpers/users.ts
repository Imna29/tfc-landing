import { users } from "../../server/db/schema";
import { testDatabase } from "./database";

let sequence = 0;

/**
 * A number nothing else in this run has used.
 *
 * Shared with `test/helpers/accounts.ts`: two counters would each start at one
 * and mint the same `fan-1`, and a test that used both helpers would fail on a
 * unique index rather than on what it was about.
 */
export function nextFanNumber(): number {
  sequence += 1;
  return sequence;
}

type NewUser = typeof users.$inferInsert;

/**
 * Creates a user row directly, filling in anything the test does not care
 * about.
 *
 * The user has no password and cannot sign in — this is for tests that need a
 * row to exist, not an account to be usable. `test/helpers/accounts.ts` signs
 * fans up the way the form does.
 *
 * Tests should pass only the fields they are actually asserting on, so that
 * what a test is about stays visible in the test.
 */
export async function createUser(overrides: Partial<NewUser> = {}) {
  const sequence = nextFanNumber();

  const [user] = await testDatabase()
    .insert(users)
    .values({
      username: `fan-${sequence}`,
      email: `fan-${sequence}@example.com`,
      firstName: "Nino",
      lastName: "Beridze",
      dateOfBirth: "1994-03-02",
      ...overrides,
    })
    .returning();

  if (!user) throw new Error("Failed to create a user.");

  return user;
}
