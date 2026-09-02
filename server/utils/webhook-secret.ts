import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Whether a Prismic webhook carried the secret configured for this deployment.
 *
 * The endpoint behind this re-renders every page on the site, so an unguarded
 * one is a free way to make the deployment do arbitrary work; Prismic's own
 * shared secret in the request body is the only thing standing in front of it.
 * Prismic sends it in the JSON body rather than as a signature, so there is
 * nothing to verify against — only a comparison to get right.
 *
 * Both sides are hashed first so the comparison is over two 32-byte digests
 * whatever the inputs were: `timingSafeEqual` throws on a length mismatch, and
 * bailing out early on length is itself a signal about the secret.
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
