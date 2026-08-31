import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission } from "@/lib/authorization";
import { withRoute } from "@/lib/with-route";
import { resolveAndPersistLocationGeo } from "@/lib/geocode";
import { createAuditLog } from "@/lib/audit";
import { log } from "@/lib/logger";

/**
 * POST /api/locations/[id]/geocode
 *
 * Resolve the object's address to coordinates and persist them. Backs the
 * "Resolve coordinates" button in the location editor: a geofence is
 * meaningless until the object has a reference point, and until now nothing
 * in the product ever wrote one.
 *
 * Always forces re-resolution — the manager pressed the button precisely
 * because the current value is missing or wrong.
 *
 * Requires: OWNER | ADMIN | MANAGER
 */
export const POST = withRoute(
  "/api/locations/[id]/geocode",
  "POST",
  async (_req, context) => {
    const { id } = await context!.params;
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const workspaceId = user.workspaceId;

    const forbidden = requirePermission(user, "locations", "update");
    if (forbidden) return forbidden;

    // Tenant check before touching the geocoder — never resolve an address
    // belonging to another workspace.
    const location = await prisma.location.findFirst({
      where: { id, workspaceId: workspaceId!, deletedAt: null },
      select: { id: true, name: true, address: true },
    });
    if (!location) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    if (!location.address || location.address.trim().length === 0) {
      return NextResponse.json(
        {
          error: "NO_ADDRESS",
          message:
            "Für diesen Standort ist keine Adresse hinterlegt. Bitte tragen Sie zuerst eine Adresse ein.",
        },
        { status: 422 },
      );
    }

    const geo = await resolveAndPersistLocationGeo(id, { force: true });

    if (!geo) {
      return NextResponse.json(
        {
          error: "GEOCODE_FAILED",
          message:
            "Die Adresse konnte nicht in Koordinaten aufgelöst werden. Bitte prüfen Sie die Schreibweise oder tragen Sie die Koordinaten manuell ein.",
        },
        { status: 422 },
      );
    }

    createAuditLog({
      action: "UPDATE",
      entityType: "Location",
      entityId: id,
      userId: user.id,
      userEmail: user.email,
      workspaceId: workspaceId!,
      changes: { latitude: geo.lat, longitude: geo.lon, source: "geocoder" },
    });

    log.info("location geocoded", { locationId: id, workspaceId });

    return NextResponse.json({
      latitude: geo.lat,
      longitude: geo.lon,
      geocodedAt: new Date().toISOString(),
    });
  },
);
