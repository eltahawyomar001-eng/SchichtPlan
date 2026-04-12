import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isOwner } from "@/lib/authorization";
import { log } from "@/lib/logger";
import { captureRouteError } from "@/lib/sentry";
import { withRoute } from "@/lib/with-route";
import { requireAuth, forbidden } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";

const RESTORABLE_TYPES = ["Employee", "Shift", "TimeEntry"] as const;

type RestorableType = (typeof RESTORABLE_TYPES)[number];

/**
 * POST /api/admin/restore
 * Restore a soft-deleted record. OWNER only.
 * Body: { type: "Employee" | "Shift" | ..., id: string }
 */
export const POST = withRoute("/api/admin/restore", "POST", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  if (!isOwner(user)) return forbidden();

  const body = await req.json();
  const { type, id } = body as { type: string; id: string };

  if (!type || !id) {
    return NextResponse.json(
      { error: "type and id are required" },
      { status: 400 },
    );
  }

  if (!RESTORABLE_TYPES.includes(type as RestorableType)) {
    return NextResponse.json(
      { error: `Invalid type. Allowed: ${RESTORABLE_TYPES.join(", ")}` },
      { status: 400 },
    );
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const model = (prisma as any)[type.charAt(0).toLowerCase() + type.slice(1)];
    const record = await model.findFirst({
      where: { id, workspaceId, deletedAt: { not: null } },
    });

    if (!record) {
      return NextResponse.json(
        { error: "Record not found or not deleted" },
        { status: 404 },
      );
    }

    await model.update({
      where: { id },
      data: { deletedAt: null },
    });

    log.info("[admin/restore] Record restored", {
      type,
      id,
      userId: user.id,
    });

    createAuditLog({
      action: "UPDATE",
      entityType: type,
      entityId: id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      metadata: { action: "RESTORE" },
    });

    dispatchWebhook(workspaceId, `${type.toLowerCase()}.restored`, {
      id,
      type,
    }).catch(() => {});

    return NextResponse.json({ success: true, type, id });
  } catch (error) {
    log.error("[admin/restore] Failed", { type, id, error });
    captureRouteError(error, { route: "/api/admin/restore", method: "POST" });
    return NextResponse.json(
      { error: "Failed to restore record" },
      { status: 500 },
    );
  }
});
