import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission, isEmployee } from "@/lib/authorization";
import { checkInVisitSchema, validateBody } from "@/lib/validations";
import { createAuditLog } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";
import { createVisitAuditEntry } from "@/lib/visit-audit";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";

// ─── POST  /api/service-visits/[id]/check-in ───────────────────
export const POST = withRoute(
  "/api/service-visits/[id]/check-in",
  "POST",
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

    const body = await req.json();
    const parsed = validateBody(checkInVisitSchema, body);
    if (!parsed.success) return parsed.response;

    const { deviceId, clientTimestamp } = parsed.data;

    const visit = await prisma.serviceVisit.findFirst({
      where: { id, workspaceId },
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

    const updated = await prisma.serviceVisit.update({
      where: { id },
      data: {
        status: "EINGECHECKT",
        checkInAt: new Date(),
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
      metadata: { action: "check-in" },
    });

    dispatchWebhook(workspaceId, "service_visit.checked_in", { id }).catch(
      () => {},
    );

    // Revisionssicher audit trail entry
    createVisitAuditEntry(req, {
      eventType: "CHECK_IN",
      visitId: id,
      userId: user.id,
      workspaceId,
      deviceId: deviceId ?? null,
      clientTimestamp: clientTimestamp ? new Date(clientTimestamp) : null,
      metadata: { employeeId: visit.employeeId },
    });

    log.info("[service-visits] Check-in completed", {
      visitId: id,
    });

    return NextResponse.json(updated);
  },
  { idempotent: true },
);
