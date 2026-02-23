/* ═══════════════════════════════════════════════════════════════
   Runtime environment validation
   ═══════════════════════════════════════════════════════════════
   Import this module early (e.g. in instrumentation.ts) to
   fail fast if critical env vars are missing. Build-time env
   vars (NEXT_PUBLIC_*) are NOT validated here because they are
   inlined by Next.js at build time.
   ═══════════════════════════════════════════════════════════════ */

/** Env vars that MUST be set for the app to function. */
const REQUIRED = ["DATABASE_URL", "NEXTAUTH_SECRET", "NEXTAUTH_URL"] as const;

/**
 * Env vars that are optional but recommended for full
 * functionality. A warning is logged if they are missing.
 */
const RECOMMENDED = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "RESEND_API_KEY",
] as const;

/**
 * Validate all environment variables. Call once at startup.
 * Throws if any required variable is missing.
 */
export function validateEnv(): void {
  const missing: string[] = [];

  for (const key of REQUIRED) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `[env] Missing required environment variables:\n` +
        missing.map((k) => `  - ${k}`).join("\n") +
        `\nSee .env.example for reference.`,
    );
  }

  // Warn about optional-but-recommended vars
  for (const key of RECOMMENDED) {
    if (!process.env[key]) {
      console.warn(`[env] ⚠ ${key} is not set — related features disabled`);
    }
  }
}
