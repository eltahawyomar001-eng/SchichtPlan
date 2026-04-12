import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission, isEmployee } from "@/lib/authorization";
import { createAuditLog } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";
import { createVisitAuditEntry } from "@/lib/visit-audit";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { updateServiceVisitSchema, validateBody } from "@/lib/validations";

// ─── GET  /api/service-visits/[id] ─────────────────────────────
export const GET = withRoute(
  "/api/service-visits/[id]",
  "GET",
  async (req, context) => {
    const params = await context!.params;
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
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
  },
);

// ─── PATCH  /api/service-visits/[id] ────────────────────────────
export const PATCH = withRoute(
  "/api/service-visits/[id]",
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
    const parsed = validateBody(updateServiceVisitSchema, body);
    if (!parsed.success) return parsed.response;
    const { data: validData } = parsed;

    const data: Record<string, unknown> = {};
    if (validData.scheduledDate)
      data.scheduledDate = new Date(validData.scheduledDate);
    if (validData.employeeId) data.employeeId = validData.employeeId;
    if (validData.locationId) data.locationId = validData.locationId;
    if (validData.notes !== undefined) data.notes = validData.notes || null;

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

    dispatchWebhook(workspaceId, "service_visit.updated", {
      id: visit.id,
    }).catch(() => {});

    return NextResponse.json(visit);
  },
);

// ─── DELETE  /api/service-visits/[id] ───────────────────────────
export const DELETE = withRoute(
  "/api/service-visits/[id]",
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

    // Soft-delete the service visit (signature is preserved)
    await prisma.serviceVisit.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    createAuditLog({
      action: "DELETE",
      entityType: "service-visit",
      entityId: id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
    });

    dispatchWebhook(workspaceId, "service_visit.deleted", { id }).catch(
      () => {},
    );

    log.info("[service-visits] Visit deleted", { visitId: id });

    return NextResponse.json({ success: true });
  },
);
