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
import { resolveAndPersistLocationGeo } from "@/lib/geocode";

/** Same ceiling as creation: fast enough for the common hit, never a spinner. */
const GEOCODE_BUDGET_MS = 3000;

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

    // Needed to tell an address EDIT from an unrelated field update. Stale
    // coordinates are worse than none: they point the geofence at the old site
    // and mark honest work "outside".
    const before = await prisma.location.findFirst({
      where: { id, workspaceId },
      select: { address: true, latitude: true, longitude: true },
    });
    if (!before) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {
      name: parsed.data.name,
      address: parsed.data.address || null,
    };

    // Geofence settings — only touched when the client actually sent them, so
    // a partial update from another surface cannot silently disable a fence.
    if (parsed.data.latitude !== undefined)
      data.latitude = parsed.data.latitude;
    if (parsed.data.longitude !== undefined)
      data.longitude = parsed.data.longitude;
    if (
      parsed.data.latitude !== undefined ||
      parsed.data.longitude !== undefined
    )
      data.geocodedAt = new Date();
    if (parsed.data.geofenceRadiusMeters !== undefined)
      data.geofenceRadiusMeters = parsed.data.geofenceRadiusMeters;
    if (parsed.data.geofenceEnforced !== undefined)
      data.geofenceEnforced = parsed.data.geofenceEnforced;
    if (parsed.data.certificationExempt !== undefined)
      data.certificationExempt = parsed.data.certificationExempt;

    const location = await prisma.location.updateMany({
      where: { id, workspaceId },
      data,
    });

    /**
     * Re-resolve when the address moved, fill in when it was never resolved.
     *
     * Skipped entirely when the client sent explicit coordinates: a manager who
     * has just dragged the pin or typed a correction outranks any geocoder, and
     * overwriting that would make the manual control useless. `force` is
     * correct on an address change for the same reason it is on the "Resolve
     * coordinates" button — the coordinates on the row describe a place the
     * object is no longer at.
     */
    const addressChanged = (parsed.data.address || null) !== before.address;
    const manualCoords =
      parsed.data.latitude !== undefined || parsed.data.longitude !== undefined;
    const missingCoords = before.latitude == null || before.longitude == null;

    if (!manualCoords && (addressChanged || missingCoords)) {
      await resolveAndPersistLocationGeo(id, {
        force: addressChanged,
        budgetMs: GEOCODE_BUDGET_MS,
      });
    }

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
