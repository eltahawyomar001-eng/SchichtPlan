import { randomBytes, createHash } from "crypto";

/**
 * Invitation token hashing — defence-in-depth for invitation links.
 *
 * The raw token is what ships in the email link (`/einladung/<raw>`). Only a
 * SHA-256 *hash* of it is ever persisted in the DB, so a leaked database dump
 * (or read-only SQL access) does not hand an attacker working invitation
 * links — they would still need to reverse SHA-256 of a 256-bit random value.
 *
 * Stored form is `sha256:<hex>` (71 chars). The prefix makes two things
 * unambiguous:
 *   1. lookups can tell a hash from a legacy plaintext row, and
 *   2. the one-time backfill (scripts/hash-invitation-tokens.ts) is idempotent
 *      because already-prefixed rows are skipped.
 *
 * SHA-256 (not bcrypt/argon2) is correct here: the input is high-entropy
 * (256 bits), so there is nothing to brute-force and we need a fast,
 * deterministic value we can index and look up by equality.
 */

const HASH_PREFIX = "sha256:";

/** Hash a raw invitation token into its at-rest storage form. */
export function hashInvitationToken(rawToken: string): string {
  return (
    HASH_PREFIX + createHash("sha256").update(rawToken, "utf8").digest("hex")
  );
}

/**
 * Generate a new invitation token.
 * @returns `raw` — put this in the email link; `stored` — persist this in DB.
 */
export function generateInvitationToken(): { raw: string; stored: string } {
  const raw = randomBytes(32).toString("hex");
  return { raw, stored: hashInvitationToken(raw) };
}

/**
 * Candidate stored values to match an incoming raw token against.
 *
 * Always includes the hash. Also includes the raw value itself so that any
 * legacy plaintext row not yet migrated by the backfill still resolves during
 * the transition window. Because the `token` column is unique, at most one row
 * can match, so this never widens the result set.
 */
export function invitationTokenLookups(rawToken: string): string[] {
  return [hashInvitationToken(rawToken), rawToken];
}
