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

    const body = await req.json();
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
    }).catch(() => {});

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

    await prisma.location.deleteMany({
      where: { id, workspaceId },
    });

    createAuditLog({
      action: "DELETE",
      entityType: "Location",
      entityId: id,
      userId: user.id,
      userEmail: user.email,
      workspaceId: workspaceId!,
    });

    dispatchWebhook(workspaceId!, "location.deleted", { id }).catch(() => {});

    return NextResponse.json({ message: "Location deleted" });
  },
);
