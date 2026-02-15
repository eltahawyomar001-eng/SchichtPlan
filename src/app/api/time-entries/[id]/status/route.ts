import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import {
  recalculateTimeAccount,
  isMonthLocked,
  createSystemNotification,
} from "@/lib/automations";

type TimeEntryStatusValue =
  | "ENTWURF"
  | "EINGEREICHT"
  | "KORREKTUR"
  | "ZURUECKGEWIESEN"
  | "GEPRUEFT"
  | "BESTAETIGT";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/time-entries/:id/status
 *
 * Body: { action: "submit"|"approve"|"reject"|"correct"|"confirm", comment?: string }
 *
 * Workflow:  ENTWURF → EINGEREICHT → GEPRUEFT → BESTAETIGT
 *                          ↓  ↑ (correction loop)
 *                       KORREKTUR
 *                          ↓
 *                    ZURUECKGEWIESEN
 */
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const user = session.user as SessionUser;
    const workspaceId = user.workspaceId;

    const entry = await prisma.timeEntry.findFirst({
      where: { id, workspaceId: workspaceId ?? undefined },
      include: { employee: true },
    });

    if (!entry) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // ── Automation: Payroll lock — prevent edits on locked months ──
    if (isMonthLocked(entry.date)) {
      return NextResponse.json(
        {
          error:
            "Dieser Monat ist für Änderungen gesperrt (Gehaltsabrechnung abgeschlossen).",
        },
        { status: 403 },
      );
    }

    const body = await req.json();
    const action: string = body.action;
    const comment: string | undefined = body.comment;

    // State machine
    const transitions: Record<
      string,
      {
        from: TimeEntryStatusValue[];
        to: TimeEntryStatusValue;
        auditAction: string;
      }
    > = {
      submit: {
        from: ["ENTWURF", "KORREKTUR"],
        to: "EINGEREICHT",
        auditAction: "SUBMITTED",
      },
      approve: {
        from: ["EINGEREICHT"],
        to: "GEPRUEFT",
        auditAction: "APPROVED",
      },
      reject: {
        from: ["EINGEREICHT", "GEPRUEFT"],
        to: "ZURUECKGEWIESEN",
        auditAction: "REJECTED",
      },
      correct: {
        from: ["EINGEREICHT"],
        to: "KORREKTUR",
        auditAction: "CORRECTION_REQUESTED",
      },
      confirm: {
        from: ["GEPRUEFT"],
        to: "BESTAETIGT",
        auditAction: "CONFIRMED",
      },
    };

    const transition = transitions[action];
    if (!transition) {
      return NextResponse.json(
        { error: `Ungültige Aktion: ${action}` },
        { status: 400 },
      );
    }

    if (!transition.from.includes(entry.status)) {
      return NextResponse.json(
        {
          error: `Aktion "${action}" ist im Status "${entry.status}" nicht erlaubt`,
        },
        { status: 400 },
      );
    }

    // Role checks
    const managerActions = ["approve", "reject", "correct", "confirm"];
    if (
      managerActions.includes(action) &&
      !["OWNER", "ADMIN", "MANAGER"].includes(user.role ?? "")
    ) {
      return NextResponse.json(
        { error: "Only managers can perform this action" },
        { status: 403 },
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      status: transition.to,
    };

    if (action === "submit") {
      updateData.submittedAt = new Date();
    }
    if (action === "confirm") {
      updateData.confirmedAt = new Date();
      updateData.confirmedBy = user.id;
    }

    const updated = await prisma.timeEntry.update({
      where: { id },
      data: updateData,
      include: { employee: true, location: true },
    });

    // Audit log
    await prisma.timeEntryAudit.create({
      data: {
        action: transition.auditAction,
        comment: comment || null,
        performedBy: user.id,
        timeEntryId: id,
      },
    });

    // Create notification
    await createNotification(entry, action, user, workspaceId ?? "");

    // ── Automation: Recalculate time account on confirmation ──
    if (action === "confirm") {
      await recalculateTimeAccount(entry.employeeId);
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating time entry status:", error);
    return NextResponse.json(
      { error: "Error changing status" },
      { status: 500 },
    );
  }
}

// ─── Notification helper ────────────────────────────────────────

async function createNotification(
  entry: {
    id: string;
    employee: { firstName: string; lastName: string; email?: string | null };
    employeeId: string;
  },
  action: string,
  performer: SessionUser,
  workspaceId: string,
) {
  const employeeName = `${entry.employee.firstName} ${entry.employee.lastName}`;

  const notificationMap: Record<
    string,
    {
      type: string;
      title: string;
      message: string;
      recipientType: "managers" | "employee";
    }
  > = {
    submit: {
      type: "TIME_ENTRY_SUBMITTED",
      title: "Neuer Zeiteintrag eingereicht",
      message: `${employeeName} hat einen Zeiteintrag zur Prüfung eingereicht.`,
      recipientType: "managers",
    },
    approve: {
      type: "TIME_ENTRY_APPROVED",
      title: "Zeiteintrag genehmigt",
      message: `Ihr Zeiteintrag wurde von ${performer.name ?? "einem Manager"} genehmigt.`,
      recipientType: "employee",
    },
    reject: {
      type: "TIME_ENTRY_REJECTED",
      title: "Zeiteintrag abgelehnt",
      message: `Ihr Zeiteintrag wurde von ${performer.name ?? "einem Manager"} abgelehnt.`,
      recipientType: "employee",
    },
    correct: {
      type: "TIME_ENTRY_CORRECTED",
      title: "Korrektur angefordert",
      message: `${performer.name ?? "Ein Manager"} hat eine Korrektur für Ihren Zeiteintrag angefordert.`,
      recipientType: "employee",
    },
    confirm: {
      type: "TIME_ENTRY_CONFIRMED",
      title: "Zeiteintrag bestätigt",
      message: `Ihr Zeiteintrag wurde endgültig bestätigt.`,
      recipientType: "employee",
    },
  };

  const info = notificationMap[action];
  if (!info) return;

  await createSystemNotification({
    type: info.type,
    title: info.title,
    message: info.message,
    link: `/zeiterfassung?entry=${entry.id}`,
    workspaceId,
    recipientType: info.recipientType,
    employeeEmail:
      info.recipientType === "employee"
        ? (entry.employee.email ?? undefined)
        : undefined,
  });
}
