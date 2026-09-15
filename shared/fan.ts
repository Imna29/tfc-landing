/**
 * A signed-in fan, as any page is allowed to see them.
 *
 * Two fields, and that is the whole of what an account is now. ADR-0018
 * retired the real names and the date of birth this used to sit beside, and
 * the phone number that replaced them is deliberately not here: it is
 * `returned: false` in `server/utils/auth.ts`, so no endpoint could put it
 * here even if one wanted to.
 */
export interface Fan {
  /** The only identifier TFC ever shows publicly. */
  username: string;
  email: string;
}
