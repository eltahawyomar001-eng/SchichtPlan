import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import {
  requirePermission,
  isEmployee,
  isManagement,
} from "@/lib/authorization";
import {
  checkShiftConflicts,
  createSystemNotification,
} from "@/lib/automations";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ─── PATCH  /api/shift-change-requests/[id] ─────────────────────
// Actions:
//   - approve:  Manager approves and applies the requested changes to the shift
//   - reject:   Manager rejects with an optional note
//   - cancel:   Employee cancels their own pending request
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const { id } = await params;
    const workspaceId = user.workspaceId;

    const changeRequest = await prisma.shiftChangeRequest.findFirst({
      where: { id, workspaceId: workspaceId ?? undefined },
      include: {
        shift: { include: { employee: true } },
        requester: true,
      },
    });

    if (!changeRequest) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const action: string = body.action; // "approve" | "reject" | "cancel"
    const reviewNote: string | undefined = body.reviewNote;

    if (!action || !["approve", "reject", "cancel"].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve", "reject", or "cancel".' },
        { status: 400 },
      );
    }

    // Only pending requests can be acted upon
    if (changeRequest.status !== "AUSSTEHEND") {
      return NextResponse.json(
        {
          error: "Request already processed",
          message: `Diese Anfrage hat bereits den Status: ${changeRequest.status}`,
        },
        { status: 400 },
      );
    }

    // ── Cancel: Employee cancels their own request ──
    if (action === "cancel") {
      if (isEmployee(user)) {
        const linkedEmployee = await prisma.employee.findFirst({
          where: {
            workspaceId: workspaceId ?? undefined,
            email: user.email ?? undefined,
          },
        });
        if (
          !linkedEmployee ||
          changeRequest.requesterId !== linkedEmployee.id
        ) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }

      const updated = await prisma.shiftChangeRequest.update({
        where: { id },
        data: { status: "STORNIERT" },
      });

      return NextResponse.json(updated);
    }

    // ── Approve / Reject: Only management ──
    const forbidden = requirePermission(
      user,
      "shift-change-requests",
      "approve",
    );
    if (forbidden) return forbidden;

    if (action === "reject") {
      const updated = await prisma.shiftChangeRequest.update({
        where: { id },
        data: {
          status: "ABGELEHNT",
          reviewedBy: user.id,
          reviewedAt: new Date(),
          reviewNote: reviewNote || null,
        },
        include: { requester: true, shift: true },
      });

      // Notify the employee
      if (updated.requester.email) {
        try {
          await createSystemNotification({
            type: "SHIFT_CHANGE_REJECTED",
            title: "Schichtänderung abgelehnt",
            message: `Ihre Änderungsanfrage für die Schicht am ${updated.shift.date.toISOString().split("T")[0]} wurde abgelehnt.${reviewNote ? ` Grund: ${reviewNote}` : ""}`,
            link: "/schichtplan",
            workspaceId: workspaceId!,
            recipientType: "employee",
            employeeEmail: updated.requester.email,
          });
        } catch {
          console.error("Failed to send rejection notification");
        }
      }

      return NextResponse.json(updated);
    }

    // ── Approve: Apply changes to the shift ──
    if (action === "approve") {
      // Build the update data from requested changes
      const shiftUpdate: Record<string, unknown> = {};

      if (changeRequest.newDate) {
        shiftUpdate.date = changeRequest.newDate;
      }
      if (changeRequest.newStartTime) {
        shiftUpdate.startTime = changeRequest.newStartTime;
      }
      if (changeRequest.newEndTime) {
        shiftUpdate.endTime = changeRequest.newEndTime;
      }
      if (changeRequest.newNotes !== null) {
        shiftUpdate.notes = changeRequest.newNotes;
      }

      // Run conflict detection if date/time changed (skip for open shifts)
      if (
        changeRequest.shift.employeeId &&
        (shiftUpdate.date || shiftUpdate.startTime || shiftUpdate.endTime)
      ) {
        const conflicts = await checkShiftConflicts({
          employeeId: changeRequest.shift.employeeId,
          date:
            (shiftUpdate.date as Date)?.toISOString().split("T")[0] ||
            changeRequest.shift.date.toISOString().split("T")[0],
          startTime:
            (shiftUpdate.startTime as string) || changeRequest.shift.startTime,
          endTime:
            (shiftUpdate.endTime as string) || changeRequest.shift.endTime,
          workspaceId: workspaceId!,
          excludeShiftId: changeRequest.shiftId,
        });

        if (conflicts.length > 0) {
          return NextResponse.json(
            {
              error: "Conflicts detected",
              message:
                "Die gewünschten Änderungen verursachen einen Schichtkonflikt. Bitte prüfen Sie die Zeiten.",
              conflicts,
            },
            { status: 409 },
          );
        }
      }

      // Apply changes to the shift and approve the request in a transaction
      const [updatedShift, updatedRequest] = await prisma.$transaction([
        prisma.shift.update({
          where: { id: changeRequest.shiftId },
          data: shiftUpdate,
        }),
        prisma.shiftChangeRequest.update({
          where: { id },
          data: {
            status: "GENEHMIGT",
            reviewedBy: user.id,
            reviewedAt: new Date(),
            reviewNote: reviewNote || null,
          },
        }),
      ]);

      // Notify the employee
      if (changeRequest.requester.email) {
        try {
          await createSystemNotification({
            type: "SHIFT_CHANGE_APPROVED",
            title: "Schichtänderung genehmigt",
            message: `Ihre Änderungsanfrage für die Schicht am ${changeRequest.shift.date.toISOString().split("T")[0]} wurde genehmigt und die Schicht aktualisiert.`,
            link: "/schichtplan",
            workspaceId: workspaceId!,
            recipientType: "employee",
            employeeEmail: changeRequest.requester.email,
          });
        } catch {
          console.error("Failed to send approval notification");
        }
      }

      return NextResponse.json({
        request: updatedRequest,
        shift: updatedShift,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Error processing shift change request:", error);
    return NextResponse.json(
      { error: "Error processing request" },
      { status: 500 },
    );
  }
}
