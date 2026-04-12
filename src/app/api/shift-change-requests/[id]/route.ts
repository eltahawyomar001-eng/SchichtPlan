import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, isEmployee } from "@/lib/authorization";
import {
  checkShiftConflicts,
  createSystemNotification,
} from "@/lib/automations";
import { createESignature, getClientIp } from "@/lib/e-signature";
import {
  updateShiftChangeRequestSchema,
  validateBody,
} from "@/lib/validations";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ─── PATCH  /api/shift-change-requests/[id] ─────────────────────
// Actions:
//   - approve:  Manager approves and applies the requested changes to the shift
//   - reject:   Manager rejects with an optional note
//   - cancel:   Employee cancels their own pending request
export const PATCH = withRoute(
  "/api/shift-change-requests/[id]",
  "PATCH",
  async (req, context) => {
    const params = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const { id } = params;
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

    const parsed = validateBody(
      updateShiftChangeRequestSchema,
      await req.json(),
    );
    if (!parsed.success) return parsed.response;
    const action = parsed.data.action;
    const reviewNote = parsed.data.reviewNote;

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

      // ── E-Signature: Record signed rejection ──
      createESignature({
        action: "shift-change.reject",
        entityType: "ShiftChangeRequest",
        entityId: id,
        signer: {
          id: user.id,
          name: user.name || user.email,
          email: user.email,
          role: user.role,
        },
        workspaceId: workspaceId!,
        ipAddress: getClientIp(req),
        userAgent: req.headers.get("user-agent") || undefined,
      }).catch((err) => log.error("E-signature failed", { error: err }));

      // Notify the employee
      if (updated.requester.email) {
        try {
          await createSystemNotification({
            type: "SHIFT_CHANGE_REJECTED",
            title: "Schichtänderung abgelehnt",
            message: `Ihre Änderungsanfrage für die Schicht am ${new Date(updated.shift.date).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })} wurde abgelehnt.${reviewNote ? ` Grund: ${reviewNote}` : ""}`,
            link: "/schichtplan",
            workspaceId: workspaceId!,
            recipientType: "employee",
            employeeEmail: updated.requester.email,
          });
        } catch {
          log.error("Failed to send rejection notification");
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
          date: (shiftUpdate.date as Date)
            ? new Date(shiftUpdate.date as Date).toLocaleDateString("en-CA", {
                timeZone: "Europe/Berlin",
              })
            : new Date(changeRequest.shift.date).toLocaleDateString("en-CA", {
                timeZone: "Europe/Berlin",
              }),
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

      // ── E-Signature: Record signed approval ──
      createESignature({
        action: "shift-change.approve",
        entityType: "ShiftChangeRequest",
        entityId: id,
        signer: {
          id: user.id,
          name: user.name || user.email,
          email: user.email,
          role: user.role,
        },
        workspaceId: workspaceId!,
        ipAddress: getClientIp(req),
        userAgent: req.headers.get("user-agent") || undefined,
      }).catch((err) => log.error("E-signature failed", { error: err }));

      // Notify the employee
      if (changeRequest.requester.email) {
        try {
          await createSystemNotification({
            type: "SHIFT_CHANGE_APPROVED",
            title: "Schichtänderung genehmigt",
            message: `Ihre Änderungsanfrage für die Schicht am ${new Date(changeRequest.shift.date).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })} wurde genehmigt und die Schicht aktualisiert.`,
            link: "/schichtplan",
            workspaceId: workspaceId!,
            recipientType: "employee",
            employeeEmail: changeRequest.requester.email,
          });
        } catch {
          log.error("Failed to send approval notification");
        }
      }

      return NextResponse.json({
        request: updatedRequest,
        shift: updatedShift,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  },
);
