import { sql } from "drizzle-orm";
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

/**
 * Makes an existing account an admin.
 *
 * Word for word the `update` the README tells a human to run, because that is
 * the only way to become an admin: no route grants the role, so a test that
 * arranged one any other way would be arranging something that cannot happen.
 */
export async function grantAdmin(email: string): Promise<void> {
  await testDatabase().execute(
    sql`update users set role = 'admin' where lower(email) = lower(${email})`,
  );
}

/** Takes the admin role away again, the same way. */
export async function revokeAdmin(email: string): Promise<void> {
  await testDatabase().execute(
    sql`update users set role = 'fan' where lower(email) = lower(${email})`,
  );
}
