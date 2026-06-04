import { randomBytes, createHash } from "crypto";

/**
 * iCal feed token hashing — defence-in-depth for calendar subscription links.
 *
 * The raw token ships in the feed URL (`/api/ical?token=<raw>`) that lives in
 * external calendar apps. Only a SHA-256 hash (`sha256:<hex>`) is persisted, so
 * a leaked DB dump does not hand an attacker working feeds onto employees'
 * schedules. Mirrors src/lib/invitation-token.ts.
 *
 * SHA-256 (not bcrypt/argon2) is correct: the input is a 384-bit random value,
 * so there is nothing to brute-force and we need a fast value we can index and
 * look up by equality.
 */

const HASH_PREFIX = "sha256:";

/** Hash a raw iCal token into its at-rest storage form. */
export function hashICalToken(rawToken: string): string {
  return (
    HASH_PREFIX + createHash("sha256").update(rawToken, "utf8").digest("hex")
  );
}

/**
 * Generate a new iCal token.
 * @returns `raw` — put this in the feed URL; `stored` — persist this in DB.
 */
export function generateICalToken(): { raw: string; stored: string } {
  const raw = randomBytes(48).toString("hex");
  return { raw, stored: hashICalToken(raw) };
}

/**
 * Candidate stored values to match an incoming raw token against. Includes the
 * raw value too so any legacy plaintext row still resolves during transition;
 * the `token` column is unique, so at most one row matches.
 */
export function icalTokenLookups(rawToken: string): string[] {
  return [hashICalToken(rawToken), rawToken];
}
