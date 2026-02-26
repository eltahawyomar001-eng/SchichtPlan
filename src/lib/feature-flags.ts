/* ═══════════════════════════════════════════════════════════════
   Feature Flags
   ═══════════════════════════════════════════════════════════════
   Environment-based feature flag system.

   Flags are defined with a default value and can be overridden
   via environment variables prefixed with `FF_`.

   Usage:
     import { isEnabled, flags } from "@/lib/feature-flags";

     if (isEnabled("SHIFT_SWAP"))   { ... }
     if (isEnabled("CHAT"))         { ... }
     if (isEnabled("TIME_ACCOUNTS")){ ... }

   Environment override:
     FF_SHIFT_SWAP=false       # disable shift swaps
     FF_CHAT=true              # enable chat
   ═══════════════════════════════════════════════════════════════ */

/** All known feature flags and their defaults. */
const FLAG_DEFAULTS: Record<string, boolean> = {
  // ── Core features (enabled by default) ────────────
  SHIFT_SWAP: true,
  ABSENCE_REQUESTS: true,
  TIME_TRACKING: true,
  REPORTS: true,

  // ── Newer features (enabled by default) ───────────
  CHAT: true,
  AUTOMATION_RULES: true,
  PROJECTS: true,
  WEBHOOKS: true,
  WELLNESS: true,
  TIME_ACCOUNTS: true,
  PAYROLL_EXPORT: true,

  // ── Experimental (disabled by default) ────────────
  AI_SCHEDULING: false,
  BULK_IMPORT: false,
  PUBLIC_API: false,
};

/**
 * Check if a feature flag is enabled.
 *
 * Resolution order:
 * 1. Environment variable `FF_<FLAG_NAME>` (e.g. `FF_CHAT=false`)
 * 2. Default value from `FLAG_DEFAULTS`
 * 3. `false` if unknown flag
 */
export function isEnabled(flag: string): boolean {
  const envKey = `FF_${flag}`;
  const envVal = process.env[envKey];

  if (envVal !== undefined) {
    return envVal === "true" || envVal === "1";
  }

  return FLAG_DEFAULTS[flag] ?? false;
}

/**
 * Return all flags with their current resolved values.
 * Useful for debugging / admin dashboard.
 */
export function getAllFlags(): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const flag of Object.keys(FLAG_DEFAULTS)) {
    result[flag] = isEnabled(flag);
  }
  return result;
}

/**
 * Type-safe flag names (for autocomplete in editors).
 */
export type FeatureFlag = keyof typeof FLAG_DEFAULTS;
