import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import {
  cascadeAbsenceApproval,
  createSystemNotification,
} from "@/lib/automations";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ─── PATCH  /api/absences/[id] ──────────────────────────────────
// Used for approve / reject / cancel
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.absenceRequest.findUnique({
      where: { id },
    });

    if (!existing || existing.workspaceId !== user.workspaceId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};

    if (body.status) {
      data.status = body.status;
      if (body.status === "GENEHMIGT" || body.status === "ABGELEHNT") {
        data.reviewedBy = user.id;
        data.reviewedAt = new Date();
        data.reviewNote = body.reviewNote || null;
      }
    }

    const updated = await prisma.absenceRequest.update({
      where: { id },
      data,
      include: { employee: true },
    });

    // ── Automation: Cascade on approval ──
    if (body.status === "GENEHMIGT") {
      const cascadeResult = await cascadeAbsenceApproval({
        absenceId: id,
        employeeId: existing.employeeId,
        startDate: existing.startDate,
        endDate: existing.endDate,
        workspaceId: user.workspaceId!,
        reviewerId: user.id,
      });

      // Notify employee
      if (updated.employee.email) {
        await createSystemNotification({
          type: "ABSENCE_APPROVED",
          title: "Abwesenheit genehmigt",
          message: `Ihr Abwesenheitsantrag wurde genehmigt.${cascadeResult.cancelledShifts > 0 ? ` ${cascadeResult.cancelledShifts} betroffene Schicht(en) wurden abgesagt.` : ""}`,
          link: "/abwesenheiten",
          workspaceId: user.workspaceId!,
          recipientType: "employee",
          employeeEmail: updated.employee.email,
        });
      }
    }

    // ── Automation: Notify on rejection ──
    if (body.status === "ABGELEHNT" && updated.employee.email) {
      await createSystemNotification({
        type: "ABSENCE_REJECTED",
        title: "Abwesenheit abgelehnt",
        message: `Ihr Abwesenheitsantrag wurde abgelehnt.${body.reviewNote ? ` Grund: ${body.reviewNote}` : ""}`,
        link: "/abwesenheiten",
        workspaceId: user.workspaceId!,
        recipientType: "employee",
        employeeEmail: updated.employee.email,
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating absence:", error);
    return NextResponse.json({ error: "Error updating" }, { status: 500 });
  }
}

// ─── DELETE  /api/absences/[id] ─────────────────────────────────
export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const { id } = await params;

    const existing = await prisma.absenceRequest.findUnique({
      where: { id },
    });

    if (!existing || existing.workspaceId !== user.workspaceId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.absenceRequest.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting absence:", error);
    return NextResponse.json({ error: "Error deleting" }, { status: 500 });
  }
}
