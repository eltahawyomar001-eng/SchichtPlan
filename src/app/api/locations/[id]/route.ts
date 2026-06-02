import { parseJsonBody } from "@/lib/api-response";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission } from "@/lib/authorization";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { updateLocationSchema, validateBody } from "@/lib/validations";
import { createAuditLog } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";

export const PATCH = withRoute(
  "/api/locations/[id]",
  "PATCH",
  async (req, context) => {
    const params = await context!.params;
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const user = session.user as SessionUser;
    const workspaceId = user.workspaceId;

    // Only OWNER, ADMIN, MANAGER can update locations
    const forbidden = requirePermission(user, "locations", "update");
    if (forbidden) return forbidden;

    const _json = await parseJsonBody(req);
    if (!_json.ok) return _json.response;
    const body = _json.data;
    const parsed = validateBody(updateLocationSchema, body);
    if (!parsed.success) return parsed.response;

    const data: Record<string, unknown> = {
      name: parsed.data.name,
      address: parsed.data.address || null,
    };

    const location = await prisma.location.updateMany({
      where: { id, workspaceId },
      data,
    });

    createAuditLog({
      action: "UPDATE",
      entityType: "Location",
      entityId: id,
      userId: user.id,
      userEmail: user.email,
      workspaceId: workspaceId!,
      changes: { name: parsed.data.name, address: parsed.data.address },
    });

    dispatchWebhook(workspaceId!, "location.updated", {
      id,
      name: parsed.data.name,
      address: parsed.data.address,
    }).catch((err) => log.warn("[dispatch] fire-and-forget failed", { err }));

    return NextResponse.json(location);
  },
);

export const DELETE = withRoute(
  "/api/locations/[id]",
  "DELETE",
  async (req, context) => {
    const params = await context!.params;
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const user = session.user as SessionUser;
    const workspaceId = user.workspaceId;

    // Only OWNER, ADMIN, MANAGER can delete locations
    const forbidden = requirePermission(user, "locations", "delete");
    if (forbidden) return forbidden;

    await prisma.location.updateMany({
      where: { id, workspaceId, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    createAuditLog({
      action: "DELETE",
      entityType: "Location",
      entityId: id,
      userId: user.id,
      userEmail: user.email,
      workspaceId: workspaceId!,
    });

    dispatchWebhook(workspaceId!, "location.deleted", { id }).catch((err) =>
      log.warn("[dispatch] fire-and-forget failed", { err }),
    );

    return NextResponse.json({ message: "Location deleted" });
  },
);
