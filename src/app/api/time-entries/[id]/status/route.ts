import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";

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
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const { id } = await params;
    const user = session.user as SessionUser;
    const workspaceId = user.workspaceId;

    const entry = await prisma.timeEntry.findFirst({
      where: { id, workspaceId: workspaceId ?? undefined },
      include: { employee: true },
    });

    if (!entry) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
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
        { error: "Nur Manager können diese Aktion durchführen" },
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

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating time entry status:", error);
    return NextResponse.json(
      { error: "Fehler beim Statuswechsel" },
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
      recipientQuery: "managers" | "employee";
    }
  > = {
    submit: {
      type: "TIME_ENTRY_SUBMITTED",
      title: "Neuer Zeiteintrag eingereicht",
      message: `${employeeName} hat einen Zeiteintrag zur Prüfung eingereicht.`,
      recipientQuery: "managers",
    },
    approve: {
      type: "TIME_ENTRY_APPROVED",
      title: "Zeiteintrag genehmigt",
      message: `Ihr Zeiteintrag wurde von ${performer.name ?? "einem Manager"} genehmigt.`,
      recipientQuery: "employee",
    },
    reject: {
      type: "TIME_ENTRY_REJECTED",
      title: "Zeiteintrag abgelehnt",
      message: `Ihr Zeiteintrag wurde von ${performer.name ?? "einem Manager"} abgelehnt.`,
      recipientQuery: "employee",
    },
    correct: {
      type: "TIME_ENTRY_CORRECTED",
      title: "Korrektur angefordert",
      message: `${performer.name ?? "Ein Manager"} hat eine Korrektur für Ihren Zeiteintrag angefordert.`,
      recipientQuery: "employee",
    },
    confirm: {
      type: "TIME_ENTRY_CONFIRMED",
      title: "Zeiteintrag bestätigt",
      message: `Ihr Zeiteintrag wurde endgültig bestätigt.`,
      recipientQuery: "employee",
    },
  };

  const info = notificationMap[action];
  if (!info) return;

  if (info.recipientQuery === "managers") {
    // Notify all managers/admins/owners in the workspace
    const managers = await prisma.user.findMany({
      where: {
        workspaceId,
        role: { in: ["OWNER", "ADMIN", "MANAGER"] },
      },
      select: { id: true },
    });

    for (const mgr of managers) {
      await prisma.notification.create({
        data: {
          type: info.type,
          title: info.title,
          message: info.message,
          userId: mgr.id,
          workspaceId,
          link: `/zeiterfassung?entry=${entry.id}`,
        },
      });
    }
  } else {
    // Notify the employee (find their User account by email)
    if (entry.employee.email) {
      const employeeUser = await prisma.user.findUnique({
        where: { email: entry.employee.email },
        select: { id: true },
      });
      if (employeeUser) {
        await prisma.notification.create({
          data: {
            type: info.type,
            title: info.title,
            message: info.message,
            userId: employeeUser.id,
            workspaceId,
            link: `/zeiterfassung?entry=${entry.id}`,
          },
        });
      }
    }
  }
}
