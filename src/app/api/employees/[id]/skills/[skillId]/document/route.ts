/**
 * §34a certificate document — upload (POST) / remove (DELETE).
 *
 * Stores the scanned Sachkunde/certificate file in Supabase Storage and
 * records its public URL on the EmployeeSkill row so the §34a compliance
 * report can prove the certificate is on file (not just a label).
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { log } from "@/lib/logger";
import { captureRouteError } from "@/lib/sentry";
import {
  requireAuth,
  notFound,
  badRequest,
  serverError,
} from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import {
  uploadToBlob,
  deleteBlob,
  validateFile,
} from "@/lib/ticket-attachments";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

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
    select: { id: true, documentUrl: true },
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; skillId: string }> },
) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const perm = requirePermission(user, "employees", "update");
    if (perm) return perm;

    const { id, skillId } = await params;
    const existing = await loadEmployeeSkill(id, skillId, workspaceId);
    if (!existing) return notFound("Zertifikat nicht gefunden");

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return badRequest("Anfrage muss multipart/form-data sein");
    }
    const file = formData.get("file");
    if (!(file instanceof File)) return badRequest("Keine Datei hochgeladen");

    const v = validateFile({
      name: file.name,
      type: file.type,
      size: file.size,
    });
    if (!v.ok) {
      return NextResponse.json(
        { error: v.code ?? "INVALID_FILE", message: v.message },
        { status: 400 },
      );
    }

    // Replace any previous document for this certificate.
    if (existing.documentUrl) {
      await deleteBlob(existing.documentUrl);
    }

    const blob = await uploadToBlob({
      workspaceId,
      ticketId: `cert-${id}`,
      fileName: file.name,
      contentType: file.type,
      body: await file.arrayBuffer(),
    });

    const updated = await prisma.employeeSkill.update({
      where: { employeeId_skillId: { employeeId: id, skillId } },
      data: { documentUrl: blob.url, documentName: file.name },
      include: { skill: true },
    });

    createAuditLog({
      action: "UPDATE",
      entityType: "EmployeeSkill",
      entityId: updated.id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: { employeeId: id, skillId, documentUploaded: file.name },
    });

    return NextResponse.json(updated, { status: 201 });
  } catch (error) {
    captureRouteError(error, {
      route: "/api/employees/[id]/skills/[skillId]/document",
      method: "POST",
    });
    const msg = error instanceof Error ? error.message : String(error);
    if (msg === "SUPABASE_STORAGE_UNCONFIGURED") {
      return NextResponse.json(
        {
          error: "STORAGE_NOT_CONFIGURED",
          message:
            "Datei-Upload ist derzeit nicht konfiguriert. Bitte Administrator kontaktieren.",
        },
        { status: 500 },
      );
    }
    log.error("[cert document POST] upload error", { msg });
    return serverError("Zertifikat konnte nicht hochgeladen werden");
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; skillId: string }> },
) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const perm = requirePermission(user, "employees", "update");
    if (perm) return perm;

    const { id, skillId } = await params;
    const existing = await loadEmployeeSkill(id, skillId, workspaceId);
    if (!existing) return notFound("Zertifikat nicht gefunden");

    if (existing.documentUrl) {
      await deleteBlob(existing.documentUrl);
    }

    await prisma.employeeSkill.update({
      where: { employeeId_skillId: { employeeId: id, skillId } },
      data: { documentUrl: null, documentName: null },
    });

    createAuditLog({
      action: "UPDATE",
      entityType: "EmployeeSkill",
      entityId: existing.id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: { employeeId: id, skillId, documentRemoved: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    captureRouteError(error, {
      route: "/api/employees/[id]/skills/[skillId]/document",
      method: "DELETE",
    });
    return serverError("Dokument konnte nicht entfernt werden");
  }
}
