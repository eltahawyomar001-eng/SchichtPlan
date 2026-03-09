import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission, isEmployee } from "@/lib/authorization";
import { checkOutVisitSchema, validateBody } from "@/lib/validations";
import { createAuditLog } from "@/lib/audit";
import { createVisitAuditEntry } from "@/lib/visit-audit";
import { log } from "@/lib/logger";

// ─── POST  /api/service-visits/[id]/check-out ──────────────────
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
    const parsed = validateBody(checkOutVisitSchema, body);
    if (!parsed.success) return parsed.response;

    const { notes, deviceId, clientTimestamp } = parsed.data;

    const visit = await prisma.serviceVisit.findFirst({
      where: { id, workspaceId },
      include: { signature: true },
    });

    if (!visit) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // EMPLOYEE can only check out their own visits
    if (isEmployee(user) && user.employeeId !== visit.employeeId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (visit.status !== "EINGECHECKT") {
      return NextResponse.json(
        { error: "Besuch muss zuerst eingecheckt sein" },
        { status: 400 },
      );
    }

    // Determine final status:
    // ABGESCHLOSSEN only if signature already captured
    const newStatus = visit.signature ? "ABGESCHLOSSEN" : "EINGECHECKT";

    const data: Record<string, unknown> = {
      checkOutAt: new Date(),
    };

    if (newStatus === "ABGESCHLOSSEN") {
      data.status = "ABGESCHLOSSEN";
    }

    if (notes !== undefined) {
      data.notes = visit.notes
        ? `${visit.notes}\n---\n${notes}`
        : notes || null;
    }

    const updated = await prisma.serviceVisit.update({
      where: { id },
      data,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        location: { select: { id: true, name: true, address: true } },
        signature: true,
      },
    });

    createAuditLog({
      action: "UPDATE",
      entityType: "service-visit",
      entityId: id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      metadata: { action: "check-out", status: updated.status },
    });

    // Revisionssicher audit trail entry
    createVisitAuditEntry(req, {
      eventType: "CHECK_OUT",
      visitId: id,
      userId: user.id,
      workspaceId,
      deviceId: deviceId ?? null,
      clientTimestamp: clientTimestamp ? new Date(clientTimestamp) : null,
      metadata: {
        finalStatus: updated.status,
        hasSignature: !!updated.signature,
        employeeId: visit.employeeId,
      },
    });

    log.info("[service-visits] Check-out completed", {
      visitId: id,
      status: updated.status,
    });

    return NextResponse.json(updated);
  } catch (error) {
    log.error("Error during check-out:", { error });
    return NextResponse.json({ error: "Error check-out" }, { status: 500 });
  }
}
