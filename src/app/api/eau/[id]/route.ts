import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { updateEauRequestSchema, validateBody } from "@/lib/validations";
import { withRoute } from "@/lib/with-route";
import { requireAuth, parseJsonBody, notFound } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";

/**
 * PATCH /api/eau/[id]
 * Record or correct eAU details (used for the manual flow and corrections).
 * With applyToAbsence=true the incapacity period is copied onto the linked
 * absence record.
 */
export const PATCH = withRoute(
  "/api/eau/[id]",
  "PATCH",
  async (req, context) => {
    const { id } = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "absences", "update");
    if (forbidden) return forbidden;

    const existing = await prisma.eauRequest.findFirst({
      where: { id, workspaceId },
      select: { id: true, absenceRequestId: true },
    });
    if (!existing) return notFound("eAU-Eintrag nicht gefunden");

    const _json = await parseJsonBody(req);
    if (!_json.ok) return _json.response;
    const parsed = validateBody(updateEauRequestSchema, _json.data);
    if (!parsed.success) return parsed.response;
    const {
      status,
      auFrom,
      auTo,
      isInitial,
      issuedDate,
      krankenkasse,
      reference,
      message,
      applyToAbsence,
    } = parsed.data;

    const toDate = (v: string | null | undefined) => (v ? new Date(v) : null);

    const updated = await prisma.eauRequest.update({
      where: { id },
      data: {
        status: status ?? undefined,
        auFrom: toDate(auFrom),
        auTo: toDate(auTo),
        isInitial: isInitial ?? null,
        issuedDate: toDate(issuedDate),
        krankenkasse: krankenkasse || null,
        reference: reference || null,
        message: message || null,
        retrievedAt: status === "RETRIEVED" ? new Date() : undefined,
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Optionally sync the incapacity period onto the linked absence record.
    if (applyToAbsence && existing.absenceRequestId && auFrom && auTo) {
      await prisma.absenceRequest.updateMany({
        where: { id: existing.absenceRequestId, workspaceId },
        data: { startDate: new Date(auFrom), endDate: new Date(auTo) },
      });
    }

    createAuditLog({
      action: "UPDATE",
      entityType: "EauRequest",
      entityId: id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: { status, auFrom, auTo, applyToAbsence },
    });

    return NextResponse.json(updated);
  },
  { idempotent: true },
);

/**
 * DELETE /api/eau/[id] — remove an eAU record.
 */
export const DELETE = withRoute(
  "/api/eau/[id]",
  "DELETE",
  async (_req, context) => {
    const { id } = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "absences", "update");
    if (forbidden) return forbidden;

    const existing = await prisma.eauRequest.findFirst({
      where: { id, workspaceId },
      select: { id: true },
    });
    if (!existing) return notFound("eAU-Eintrag nicht gefunden");

    await prisma.eauRequest.delete({ where: { id } });

    createAuditLog({
      action: "DELETE",
      entityType: "EauRequest",
      entityId: id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
    });

    return NextResponse.json({ success: true });
  },
);
