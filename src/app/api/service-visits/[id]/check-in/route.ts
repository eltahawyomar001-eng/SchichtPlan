import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission, isEmployee } from "@/lib/authorization";
import { checkInVisitSchema, validateBody } from "@/lib/validations";
import { checkGeofence } from "@/lib/geofence";
import { createAuditLog } from "@/lib/audit";
import { createVisitAuditEntry } from "@/lib/visit-audit";
import { log } from "@/lib/logger";

// ─── POST  /api/service-visits/[id]/check-in ───────────────────
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const user = session.user as SessionUser;
    const workspaceId = user.workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const forbidden = requirePermission(user, "service-visits", "update");
    if (forbidden) return forbidden;

    const body = await req.json();
    const parsed = validateBody(checkInVisitSchema, body);
    if (!parsed.success) return parsed.response;

    const { lat, lng, deviceId, clientTimestamp, gpsAccuracy } = parsed.data;

    const visit = await prisma.serviceVisit.findFirst({
      where: { id, workspaceId },
      include: {
        location: {
          select: {
            latitude: true,
            longitude: true,
            geofenceRadius: true,
          },
        },
      },
    });

    if (!visit) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // EMPLOYEE can only check in their own visits
    if (isEmployee(user) && user.employeeId !== visit.employeeId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (visit.status !== "GEPLANT") {
      return NextResponse.json(
        { error: "Besuch ist nicht im Status GEPLANT" },
        { status: 400 },
      );
    }

    // Geofence check
    let withinFence = true;
    if (visit.location.latitude && visit.location.longitude) {
      const geo = checkGeofence(
        lat,
        lng,
        visit.location.latitude,
        visit.location.longitude,
        visit.location.geofenceRadius,
      );
      withinFence = geo.withinFence;
      log.info("[service-visits] Geofence check", {
        visitId: id,
        withinFence,
        distanceMetres: Math.round(geo.distanceMetres),
      });
    }

    const updated = await prisma.serviceVisit.update({
      where: { id },
      data: {
        status: "EINGECHECKT",
        checkInAt: new Date(),
        checkInLat: lat,
        checkInLng: lng,
        checkInWithinFence: withinFence,
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        location: { select: { id: true, name: true, address: true } },
      },
    });

    createAuditLog({
      action: "UPDATE",
      entityType: "service-visit",
      entityId: id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      metadata: { action: "check-in", withinFence },
    });

    // Revisionssicher audit trail entry
    createVisitAuditEntry(req, {
      eventType: "CHECK_IN",
      visitId: id,
      userId: user.id,
      workspaceId,
      gpsLat: lat,
      gpsLng: lng,
      gpsAccuracy: gpsAccuracy ?? null,
      deviceId: deviceId ?? null,
      clientTimestamp: clientTimestamp ? new Date(clientTimestamp) : null,
      metadata: { withinFence, employeeId: visit.employeeId },
    });

    log.info("[service-visits] Check-in completed", {
      visitId: id,
      withinFence,
    });

    return NextResponse.json(updated);
  } catch (error) {
    log.error("Error during check-in:", { error });
    return NextResponse.json({ error: "Error check-in" }, { status: 500 });
  }
}
