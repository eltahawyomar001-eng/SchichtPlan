import { prisma } from "@/lib/db";
import { cache } from "@/lib/cache";
import { log } from "@/lib/logger";

const FLAG_TTL = 30; // seconds — short enough to propagate changes quickly

/**
 * Deterministic hash of a string → 0-99.
 * Used for percentage rollouts: same workspace always gets the same bucket.
 */
function hashBucket(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(31, h) + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 100;
}

/**
 * Returns true if the feature flag is enabled for the given workspace.
 *
 * Resolution order (first match wins):
 *  1. workspace is in `disabledFor` → false
 *  2. workspace is in `enabledFor`  → true
 *  3. `rolloutPercent` > 0          → deterministic bucket check
 *  4. `enabled` (global)            → true/false
 *
 * Results are cached in Redis for FLAG_TTL seconds to avoid DB hits on every
 * request. Call `invalidateFlagCache(key)` after any flag mutation.
 */
export async function isFeatureEnabled(
  key: string,
  workspaceId?: string,
): Promise<boolean> {
  const cacheKey = `flag:${key}:${workspaceId ?? "_global"}`;
  const cached = await cache.get<boolean>(cacheKey);
  if (cached !== null && cached !== undefined) return cached;

  try {
    const flag = await prisma.featureFlag.findUnique({ where: { key } });
    if (!flag) {
      await cache.set(cacheKey, false, FLAG_TTL);
      return false;
    }

    let result: boolean;

    if (workspaceId) {
      const disabledFor: string[] = JSON.parse(flag.disabledFor);
      const enabledFor: string[] = JSON.parse(flag.enabledFor);

      if (disabledFor.includes(workspaceId)) {
        result = false;
      } else if (enabledFor.includes(workspaceId)) {
        result = true;
      } else if (flag.rolloutPercent > 0 && flag.rolloutPercent < 100) {
        result = hashBucket(workspaceId + key) < flag.rolloutPercent;
      } else {
        result = flag.enabled && flag.rolloutPercent !== 0;
      }
    } else {
      result = flag.enabled;
    }

    await cache.set(cacheKey, result, FLAG_TTL);
    return result;
  } catch (err) {
    log.warn("[feature-flags] flag check failed, defaulting to false", {
      key,
      workspaceId,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/** Invalidate all cache entries for a flag (global + all workspace variants). */
export async function invalidateFlagCache(key: string): Promise<void> {
  await cache.delPattern(`flag:${key}:*`).catch(() => {});
}

/** Toggle a flag globally and bust its cache. */
export async function setFlag(key: string, enabled: boolean): Promise<void> {
  await prisma.featureFlag.upsert({
    where: { key },
    update: { enabled, updatedAt: new Date() },
    create: { key, enabled },
  });
  await invalidateFlagCache(key);
}

/** Force-enable a flag for a specific workspace (overrides global + rollout). */
export async function enableFlagForWorkspace(
  key: string,
  workspaceId: string,
): Promise<void> {
  const flag = await prisma.featureFlag.findUnique({ where: { key } });
  const enabledFor: string[] = flag ? JSON.parse(flag.enabledFor) : [];
  const disabledFor: string[] = flag ? JSON.parse(flag.disabledFor) : [];

  if (!enabledFor.includes(workspaceId)) enabledFor.push(workspaceId);
  const newDisabledFor = disabledFor.filter((id) => id !== workspaceId);

  await prisma.featureFlag.upsert({
    where: { key },
    update: {
      enabledFor: JSON.stringify(enabledFor),
      disabledFor: JSON.stringify(newDisabledFor),
      updatedAt: new Date(),
    },
    create: {
      key,
      enabledFor: JSON.stringify([workspaceId]),
      disabledFor: "[]",
    },
  });
  await invalidateFlagCache(key);
}

/** Force-disable a flag for a specific workspace (overrides global + rollout). */
export async function disableFlagForWorkspace(
  key: string,
  workspaceId: string,
): Promise<void> {
  const flag = await prisma.featureFlag.findUnique({ where: { key } });
  const disabledFor: string[] = flag ? JSON.parse(flag.disabledFor) : [];
  const enabledFor: string[] = flag ? JSON.parse(flag.enabledFor) : [];

  if (!disabledFor.includes(workspaceId)) disabledFor.push(workspaceId);
  const newEnabledFor = enabledFor.filter((id) => id !== workspaceId);

  await prisma.featureFlag.upsert({
    where: { key },
    update: {
      disabledFor: JSON.stringify(disabledFor),
      enabledFor: JSON.stringify(newEnabledFor),
      updatedAt: new Date(),
    },
    create: {
      key,
      disabledFor: JSON.stringify([workspaceId]),
      enabledFor: "[]",
    },
  });
  await invalidateFlagCache(key);
}

/** Remove any workspace-specific override, falling back to global/rollout. */
export async function clearWorkspaceOverride(
  key: string,
  workspaceId: string,
): Promise<void> {
  const flag = await prisma.featureFlag.findUnique({ where: { key } });
  if (!flag) return;

  const enabledFor: string[] = JSON.parse(flag.enabledFor);
  const disabledFor: string[] = JSON.parse(flag.disabledFor);

  await prisma.featureFlag.update({
    where: { key },
    data: {
      enabledFor: JSON.stringify(enabledFor.filter((id) => id !== workspaceId)),
      disabledFor: JSON.stringify(
        disabledFor.filter((id) => id !== workspaceId),
      ),
      updatedAt: new Date(),
    },
  });
  await invalidateFlagCache(key);
}
