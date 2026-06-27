/**
 * Credential normalization shared across all sign-in / sign-up surfaces.
 *
 * Historically the web `authorize()` and `pre-login` routes looked the user up
 * with the raw, un-normalized email and compared the raw password, while
 * registration / password-reset stored a *trimmed* password (Zod `.trim()`)
 * and the mobile-login endpoint already lowercased + trimmed the email. That
 * mismatch meant a password (or email) with stray leading/trailing whitespace
 * — e.g. from a password manager or copy-paste — would hash one way at signup
 * but compare a different way at login, locking the user out of an account
 * whose password was, to them, "exactly the same".
 *
 * Normalizing in one place keeps every surface byte-for-byte consistent:
 *   - email    → trimmed + lowercased (email local-parts are case-insensitive
 *                in practice and our registration de-dupes case-insensitively)
 *   - password → trimmed, matching how it was stored at registration / reset
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizePassword(password: string): string {
  return password.trim();
}
