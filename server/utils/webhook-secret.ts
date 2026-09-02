import { createHash, timingSafeEqual } from "node:crypto";

/**
 * The only guard on an endpoint that re-renders the whole site. Prismic sends
 * the shared secret in the body, so there is no signature to verify.
 *
 * Both sides are hashed first: `timingSafeEqual` throws on a length mismatch,
 * and returning early on length is itself a signal.
 */
export function webhookSecretMatches(provided: unknown, expected: string): boolean {
  if (typeof provided !== "string" || expected.length === 0) {
    return false;
  }

  return timingSafeEqual(sha256(provided), sha256(expected));
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}
