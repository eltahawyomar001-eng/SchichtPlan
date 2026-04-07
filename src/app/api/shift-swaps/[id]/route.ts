import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, isEmployee } from "@/lib/authorization";
import {
  tryAutoApproveSwap,
  createSystemNotification,
} from "@/lib/automations";
import { createESignature, getClientIp } from "@/lib/e-signature";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { updateShiftSwapSchema, validateBody } from "@/lib/validations";
import { createAuditLog } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ─── PATCH  /api/shift-swaps/[id] ───────────────────────────────
export const PATCH = withRoute(
  "/api/shift-swaps/[id]",
  "PATCH",
  async (req, context) => {
    const params = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const { id } = params;
    const body = await req.json();
    const parsed = validateBody(updateShiftSwapSchema, body);
    if (!parsed.success) return parsed.response;
    const { data: validData } = parsed;

    const existing = await prisma.shiftSwapRequest.findUnique({
      where: { id },
      include: { shift: true, targetShift: true },
    });

    if (!existing || existing.workspaceId !== user.workspaceId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};

    // Accept (by target employee only)
    if (validData.status === "ANGENOMMEN") {
      if (existing.status !== "ANGEFRAGT") {
        return NextResponse.json(
          { error: "Nur offene Anfragen können angenommen werden." },
          { status: 400 },
        );
      }

      // If swap has a named target, only that employee can accept
      if (existing.targetId && user.employeeId !== existing.targetId) {
        return NextResponse.json(
          {
            error:
              "Nur der benannte Tauschpartner kann diese Anfrage annehmen.",
          },
          { status: 403 },
        );
      }

      // Requester cannot accept their own request
      if (user.employeeId === existing.requesterId) {
        return NextResponse.json(
          { error: "Sie können Ihre eigene Anfrage nicht annehmen." },
          { status: 400 },
        );
      }

      data.status = "ANGENOMMEN";
      data.targetId = validData.targetId || user.employeeId;
      if (validData.targetShiftId) data.targetShiftId = validData.targetShiftId;
    }

    // Approve / Reject (by manager — allowed from both ANGEFRAGT and ANGENOMMEN)
    if (validData.status === "GENEHMIGT" || validData.status === "ABGELEHNT") {
      const forbidden = requirePermission(
        user,
        "shift-swap-requests",
        "approve",
      );
      if (forbidden) return forbidden;

      if (!["ANGEFRAGT", "ANGENOMMEN"].includes(existing.status)) {
        return NextResponse.json(
          {
            error:
              "Diese Anfrage kann nicht mehr genehmigt oder abgelehnt werden.",
          },
          { status: 400 },
        );
      }

      data.status = validData.status;
      data.reviewedBy = user.id;
      data.reviewedAt = new Date();
      data.reviewNote = validData.reviewNote || null;
    }

    // Cancel (by requester only, or by management)
    if (validData.status === "STORNIERT") {
      if (existing.status !== "ANGEFRAGT" && existing.status !== "ANGENOMMEN") {
        return NextResponse.json(
          { error: "Diese Anfrage kann nicht mehr storniert werden." },
          { status: 400 },
        );
      }

      // Employees can only cancel their own requests
      if (isEmployee(user) && user.employeeId !== existing.requesterId) {
        return NextResponse.json(
          { error: "Nur der Antragsteller kann die Anfrage stornieren." },
          { status: 403 },
        );
      }

      data.status = "STORNIERT";
    }

    const updated = await prisma.shiftSwapRequest.update({
      where: { id },
      data,
      include: {
        requester: true,
        target: true,
        shift: { include: { location: true } },
        targetShift: { include: { location: true } },
      },
    });

    // ── Automation: Auto-approve swap if no conflicts ──
    if (validData.status === "ANGENOMMEN") {
      const autoApproved = await tryAutoApproveSwap(id);

      if (autoApproved) {
        // Notify both parties
        const shiftDate =
          existing.shift.date instanceof Date
            ? existing.shift.date.toLocaleDateString("de-DE")
            : new Date(existing.shift.date).toLocaleDateString("de-DE");

        await createSystemNotification({
          type: "SWAP_AUTO_APPROVED",
          title: "Schichttausch automatisch genehmigt",
          message: `Der Schichttausch am ${shiftDate} wurde automatisch genehmigt (keine Konflikte).`,
          link: "/schichttausch",
          workspaceId: user.workspaceId!,
          recipientType: "managers",
        });

        // Re-fetch final state
        const finalSwap = await prisma.shiftSwapRequest.findUnique({
          where: { id },
          include: {
            requester: true,
            target: true,
            shift: { include: { location: true } },
            targetShift: { include: { location: true } },
          },
        });

        return NextResponse.json({ ...finalSwap, autoApproved: true });
      }
    }

    // If approved, actually swap the employee assignments
    if (
      validData.status === "GENEHMIGT" &&
      existing.targetId &&
      existing.targetShiftId
    ) {
      await prisma.$transaction([
        prisma.shift.update({
          where: { id: existing.shiftId },
          data: { employeeId: existing.targetId },
        }),
        prisma.shift.update({
          where: { id: existing.targetShiftId },
          data: { employeeId: existing.requesterId },
        }),
        prisma.shiftSwapRequest.update({
          where: { id },
          data: { status: "ABGESCHLOSSEN" },
        }),
      ]);
    } else if (
      validData.status === "GENEHMIGT" &&
      existing.targetId &&
      !existing.targetShiftId
    ) {
      // One-way swap: just reassign the shift
      await prisma.$transaction([
        prisma.shift.update({
          where: { id: existing.shiftId },
          data: { employeeId: existing.targetId },
        }),
        prisma.shiftSwapRequest.update({
          where: { id },
          data: { status: "ABGESCHLOSSEN" },
        }),
      ]);
    }

    // ── Automation: Notify on manual approval/rejection ──
    if (validData.status === "GENEHMIGT" || validData.status === "ABGELEHNT") {
      // ── E-Signature: Record signed approval/rejection ──
      createESignature({
        action:
          validData.status === "GENEHMIGT"
            ? "shift-swap.approve"
            : "shift-swap.reject",
        entityType: "ShiftSwapRequest",
        entityId: id,
        signer: {
          id: user.id,
          name: user.name || user.email,
          email: user.email,
          role: user.role,
        },
        workspaceId: user.workspaceId!,
        ipAddress: getClientIp(req),
        userAgent: req.headers.get("user-agent") || undefined,
      }).catch((err) => log.error("E-signature failed", { error: err }));

      const statusText =
        validData.status === "GENEHMIGT" ? "genehmigt" : "abgelehnt";

      // Notify requester
      if (updated.requester?.email) {
        await createSystemNotification({
          type: `SWAP_${validData.status}`,
          title: `Schichttausch ${statusText}`,
          message: `Ihr Schichttausch-Antrag wurde ${statusText}.${validData.reviewNote ? ` Grund: ${validData.reviewNote}` : ""}`,
          link: "/schichttausch",
          workspaceId: user.workspaceId!,
          recipientType: "employee",
          employeeEmail: updated.requester.email,
        });
      }

      // Notify target
      if (updated.target?.email) {
        await createSystemNotification({
          type: `SWAP_${validData.status}`,
          title: `Schichttausch ${statusText}`,
          message: `Ein Schichttausch, an dem Sie beteiligt sind, wurde ${statusText}.`,
          link: "/schichttausch",
          workspaceId: user.workspaceId!,
          recipientType: "employee",
          employeeEmail: updated.target.email,
        });
      }
    }

    createAuditLog({
      action:
        validData.status === "GENEHMIGT"
          ? "APPROVE"
          : validData.status === "ABGELEHNT"
            ? "REJECT"
            : "UPDATE",
      entityType: "ShiftSwapRequest",
      entityId: id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: { status: validData.status, reviewNote: validData.reviewNote },
    });

    const eventName =
      validData.status === "GENEHMIGT"
        ? "shift_swap.approved"
        : validData.status === "ABGELEHNT"
          ? "shift_swap.rejected"
          : "shift_swap.updated";
    dispatchWebhook(workspaceId, eventName, {
      id,
      status: validData.status,
    }).catch(() => {});

    return NextResponse.json(updated);
  },
);
