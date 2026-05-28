import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { updateEmployeeSkillSchema, validateBody } from "@/lib/validations";
import { withRoute } from "@/lib/with-route";
import { requireAuth, parseJsonBody, notFound } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import { deleteBlob } from "@/lib/ticket-attachments";

/** Confirm the employee + skill pairing exists in the caller's workspace. */
async function loadEmployeeSkill(
  employeeId: string,
  skillId: string,
  workspaceId: string,
) {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, workspaceId },
    select: { id: true },
  });
  if (!employee) return null;
  return prisma.employeeSkill.findUnique({
    where: { employeeId_skillId: { employeeId, skillId } },
    include: { skill: true },
  });
}

/**
 * PATCH /api/employees/[id]/skills/[skillId]
 * Update certificate details (number, authority, issued/expiry dates).
 */
export const PATCH = withRoute(
  "/api/employees/[id]/skills/[skillId]",
  "PATCH",
  async (req, context) => {
    const { id, skillId } = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "employees", "update");
    if (forbidden) return forbidden;

    const existing = await loadEmployeeSkill(id, skillId, workspaceId);
    if (!existing) return notFound("Zertifikat nicht gefunden");

    const _json = await parseJsonBody(req);
    if (!_json.ok) return _json.response;
    const parsed = validateBody(updateEmployeeSkillSchema, _json.data);
    if (!parsed.success) return parsed.response;
    const { expiresAt, certificateNumber, issuingAuthority, issuedAt } =
      parsed.data;

    const toDate = (v: string | null | undefined) => (v ? new Date(v) : null);

    const updated = await prisma.employeeSkill.update({
      where: { employeeId_skillId: { employeeId: id, skillId } },
      data: {
        expiresAt: toDate(expiresAt),
        issuedAt: toDate(issuedAt),
        certificateNumber: certificateNumber || null,
        issuingAuthority: issuingAuthority || null,
      },
      include: { skill: true },
    });

    createAuditLog({
      action: "UPDATE",
      entityType: "EmployeeSkill",
      entityId: updated.id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: { employeeId: id, skillId, certificateNumber, issuingAuthority },
    });

    return NextResponse.json(updated);
  },
  { idempotent: true },
);

/**
 * DELETE /api/employees/[id]/skills/[skillId]
 * Remove a certificate assignment (and its uploaded document, if any).
 */
export const DELETE = withRoute(
  "/api/employees/[id]/skills/[skillId]",
  "DELETE",
  async (_req, context) => {
    const { id, skillId } = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "employees", "update");
    if (forbidden) return forbidden;

    const existing = await loadEmployeeSkill(id, skillId, workspaceId);
    if (!existing) return notFound("Zertifikat nicht gefunden");

    if (existing.documentUrl) {
      await deleteBlob(existing.documentUrl);
    }

    await prisma.employeeSkill.delete({
      where: { employeeId_skillId: { employeeId: id, skillId } },
    });

    createAuditLog({
      action: "DELETE",
      entityType: "EmployeeSkill",
      entityId: existing.id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: { employeeId: id, skillId },
    });

    return NextResponse.json({ success: true });
  },
);
