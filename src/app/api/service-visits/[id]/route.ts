import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission, isEmployee } from "@/lib/authorization";
import { createAuditLog } from "@/lib/audit";
import { createVisitAuditEntry } from "@/lib/visit-audit";
import { log } from "@/lib/logger";

// ─── GET  /api/service-visits/[id] ─────────────────────────────
export async function GET(
  _req: Request,
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

    const forbidden = requirePermission(user, "service-visits", "read");
    if (forbidden) return forbidden;

    const where: Record<string, unknown> = { id, workspaceId };
    // EMPLOYEE scoping
    if (isEmployee(user) && user.employeeId) {
      where.employeeId = user.employeeId;
    }

    const visit = await prisma.serviceVisit.findFirst({
      where,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        location: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
        signature: true,
        report: { select: { id: true, title: true, status: true } },
      },
    });

    if (!visit) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(visit);
  } catch (error) {
    log.error("Error fetching service visit:", { error });
    return NextResponse.json({ error: "Error loading" }, { status: 500 });
  }
}

// ─── PATCH  /api/service-visits/[id] ────────────────────────────
export async function PATCH(
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

    const existing = await prisma.serviceVisit.findFirst({
      where: { id, workspaceId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Only GEPLANT visits can be updated via this endpoint
    if (existing.status !== "GEPLANT") {
      return NextResponse.json(
        { error: "Nur geplante Besuche können bearbeitet werden" },
        { status: 400 },
      );
    }

    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.scheduledDate) data.scheduledDate = new Date(body.scheduledDate);
    if (body.employeeId) data.employeeId = body.employeeId;
    if (body.locationId) data.locationId = body.locationId;
    if (body.notes !== undefined) data.notes = body.notes || null;

    const visit = await prisma.serviceVisit.update({
      where: { id },
      data,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        location: { select: { id: true, name: true, address: true } },
      },
    });

    createAuditLog({
      action: "UPDATE",
      entityType: "service-visit",
      entityId: visit.id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
    });

    return NextResponse.json(visit);
  } catch (error) {
    log.error("Error updating service visit:", { error });
    return NextResponse.json({ error: "Error updating" }, { status: 500 });
  }
}

// ─── DELETE  /api/service-visits/[id] ───────────────────────────
export async function DELETE(
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

    const forbidden = requirePermission(user, "service-visits", "delete");
    if (forbidden) return forbidden;

    const existing = await prisma.serviceVisit.findFirst({
      where: { id, workspaceId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Write cancellation audit entry BEFORE delete
    // (the visit-specific audit log cascades on delete, but the generic
    //  auditLog table preserves the record for Revisionssicherheit)
    createVisitAuditEntry(req, {
      eventType: "VISIT_CANCELLED",
      visitId: id,
      userId: user.id,
      workspaceId,
      metadata: {
        previousStatus: existing.status,
        employeeId: existing.employeeId,
        locationId: existing.locationId,
      },
    });

    // Delete signature first (if any), then visit
    await prisma.visitSignature.deleteMany({
      where: { visitId: id },
    });
    await prisma.serviceVisit.delete({ where: { id } });

    createAuditLog({
      action: "DELETE",
      entityType: "service-visit",
      entityId: id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
    });

    log.info("[service-visits] Visit deleted", { visitId: id });

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("Error deleting service visit:", { error });
    return NextResponse.json({ error: "Error deleting" }, { status: 500 });
  }
}
