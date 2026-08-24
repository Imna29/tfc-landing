/**
 * A signed-in fan, as any page is allowed to see them.
 *
 * There is no first or last name here, and no endpoint that would provide one:
 * the columns exist so TFC can match a Prize to a person, and never leave the
 * database (ADR-0007). See `server/utils/auth.ts`.
 */
export interface Fan {
  /** The only identifier TFC ever shows publicly. */
  username: string;
  email: string;
  /** Confirming this is what unlocks a first Entry. */
  emailVerified: boolean;
}
