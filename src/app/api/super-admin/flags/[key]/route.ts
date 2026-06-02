import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/super-admin-auth";
import { withRoute } from "@/lib/with-route";
import { parseJsonBody } from "@/lib/api-response";
import {
  invalidateFlagCache,
  enableFlagForWorkspace,
  disableFlagForWorkspace,
  clearWorkspaceOverride,
} from "@/lib/feature-flags";

interface RouteParams {
  params: Promise<{ key: string }>;
}

/** PATCH /api/super-admin/flags/[key] — update a flag */
export const PATCH = withRoute(
  "/api/super-admin/flags/[key]",
  "PATCH",
  async (req, context) => {
    const guard = await requireSuperAdmin();
    if (guard) return guard;

    const { key } = await (context as RouteParams).params;
    const _json = await parseJsonBody(req);
    if (!_json.ok) return _json.response;
    const body = _json.data as Record<string, unknown>;

    // Workspace-level override operations
    if (body.action === "enable_for" && typeof body.workspaceId === "string") {
      await enableFlagForWorkspace(key, body.workspaceId);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "disable_for" && typeof body.workspaceId === "string") {
      await disableFlagForWorkspace(key, body.workspaceId);
      return NextResponse.json({ ok: true });
    }
    if (
      body.action === "clear_override" &&
      typeof body.workspaceId === "string"
    ) {
      await clearWorkspaceOverride(key, body.workspaceId);
      return NextResponse.json({ ok: true });
    }

    // Global flag update
    const flag = await prisma.featureFlag.update({
      where: { key },
      data: {
        ...(typeof body.enabled === "boolean" && { enabled: body.enabled }),
        ...(typeof body.rolloutPercent === "number" && {
          rolloutPercent: Math.max(0, Math.min(100, body.rolloutPercent)),
        }),
        ...(body.description !== undefined && {
          description: body.description ? String(body.description) : null,
        }),
        updatedAt: new Date(),
      },
    });

    await invalidateFlagCache(key);
    return NextResponse.json(flag);
  },
);

/** DELETE /api/super-admin/flags/[key] — remove a flag */
export const DELETE = withRoute(
  "/api/super-admin/flags/[key]",
  "DELETE",
  async (_req, context) => {
    const guard = await requireSuperAdmin();
    if (guard) return guard;

    const { key } = await (context as RouteParams).params;

    await prisma.featureFlag.delete({ where: { key } });
    await invalidateFlagCache(key);

    return NextResponse.json({ ok: true });
  },
);
