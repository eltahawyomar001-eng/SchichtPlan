/**
 * Ticket Attachments — upload (POST) and list (GET).
 *
 * POST  /api/tickets/[id]/attachments
 *   Multipart form-data with one or more "file" fields.
 *   Optional "commentId" field to associate with a specific comment.
 *
 * GET   /api/tickets/[id]/attachments
 *   Returns all attachments for the ticket the caller has access to.
 *
 * RBAC:
 *   • Management (OWNER/ADMIN/MANAGER) can read/upload on any workspace ticket.
 *   • Employees can read/upload only on tickets they created or are assigned to.
 *
 * Quota:
 *   • Per-file size limited to MAX_ATTACHMENT_BYTES.
 *   • Total per-ticket count capped at MAX_ATTACHMENTS_PER_TICKET.
 *   • Workspace storage quota (WorkspaceUsage.ticketStorageBytesLimit) enforced
 *     atomically; usage counter incremented after successful blob upload.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isEmployee, requirePermission } from "@/lib/authorization";
import { log } from "@/lib/logger";
import { captureRouteError } from "@/lib/sentry";
import {
  requireAuth,
  serverError,
  notFound,
  forbidden,
  badRequest,
} from "@/lib/api-response";
import { requireTicketingAddon } from "@/lib/ticketing-addon";
import { logAttachmentAdded } from "@/lib/ticket-events";
import {
  MAX_ATTACHMENTS_PER_TICKET,
  validateFile,
  requireStorageQuota,
  recordStorageUsage,
  uploadToBlob,
  deleteBlob,
} from "@/lib/ticket-attachments";

// ─── POST  /api/tickets/[id]/attachments ───────────────────────
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const perm = requirePermission(user, "tickets", "update");
    if (perm) return perm;

    const addonRequired = await requireTicketingAddon(workspaceId);
    if (addonRequired) return addonRequired;

    const { id } = await params;

    // Verify ticket exists in this workspace
    const ticket = await prisma.ticket.findFirst({
      where: { id, workspaceId },
      select: {
        id: true,
        createdById: true,
        assignedToId: true,
      },
    });
    if (!ticket) return notFound("Ticket nicht gefunden");

    // EMPLOYEE: only own / assigned tickets
    if (
      isEmployee(user) &&
      ticket.createdById !== user.id &&
      ticket.assignedToId !== user.id
    ) {
      return forbidden("Kein Zugriff auf dieses Ticket");
    }

    // Parse multipart body
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return badRequest("Anfrage muss multipart/form-data sein");
    }

    const files = formData
      .getAll("file")
      .filter((v): v is File => v instanceof File);
    const commentIdRaw = formData.get("commentId");
    const commentId =
      typeof commentIdRaw === "string" && commentIdRaw.length > 0
        ? commentIdRaw
        : null;

    if (files.length === 0) {
      return badRequest("Keine Datei hochgeladen");
    }

    // If commentId provided, ensure it belongs to the same ticket
    if (commentId) {
      const comment = await prisma.ticketComment.findFirst({
        where: { id: commentId, ticketId: id },
        select: { id: true },
      });
      if (!comment) return badRequest("Kommentar nicht gefunden");
    }

    // Enforce per-ticket attachment cap
    const existingCount = await prisma.ticketAttachment.count({
      where: { ticketId: id },
    });
    if (existingCount + files.length > MAX_ATTACHMENTS_PER_TICKET) {
      return NextResponse.json(
        {
          error: "TOO_MANY_ATTACHMENTS",
          message: `Maximal ${MAX_ATTACHMENTS_PER_TICKET} Anhänge pro Ticket erlaubt.`,
        },
        { status: 400 },
      );
    }

    // Validate each file before any side-effects
    let totalBytes = 0;
    for (const file of files) {
      const v = validateFile({
        name: file.name,
        type: file.type,
        size: file.size,
      });
      if (!v.ok) {
        return NextResponse.json(
          { error: v.code, message: v.message },
          { status: 400 },
        );
      }
      totalBytes += file.size;
    }

    // Quota check (single shot for the whole batch)
    const quotaErr = await requireStorageQuota(workspaceId, totalBytes);
    if (quotaErr) return quotaErr;

    // Upload + persist
    const created: Array<{
      id: string;
      fileName: string;
      fileUrl: string;
      fileType: string;
      fileSize: string;
      uploadedById: string | null;
      uploaderName: string | null;
      createdAt: Date;
      commentId: string | null;
    }> = [];

    const uploadedUrls: string[] = []; // for rollback if DB fails

    try {
      for (const file of files) {
        const arrayBuf = await file.arrayBuffer();
        const blob = await uploadToBlob({
          workspaceId,
          ticketId: id,
          fileName: file.name,
          contentType: file.type,
          body: arrayBuf,
        });
        uploadedUrls.push(blob.url);

        const row = await prisma.ticketAttachment.create({
          data: {
            ticketId: id,
            commentId,
            fileName: file.name,
            fileUrl: blob.url,
            fileType: file.type,
            fileSize: BigInt(file.size),
            uploadedById: user.id,
            uploaderName: user.name ?? null,
            workspaceId,
          },
        });

        created.push({
          id: row.id,
          fileName: row.fileName,
          fileUrl: row.fileUrl,
          fileType: row.fileType,
          fileSize: row.fileSize.toString(),
          uploadedById: row.uploadedById,
          uploaderName: row.uploaderName,
          createdAt: row.createdAt,
          commentId: row.commentId,
        });

        logAttachmentAdded(
          id,
          { id: user.id, name: user.name ?? "System" },
          {
            fileName: row.fileName,
            fileSize: row.fileSize,
            fileType: row.fileType,
            commentId: row.commentId,
          },
        );
      }

      await recordStorageUsage(workspaceId, totalBytes);
    } catch (err) {
      // Best-effort rollback of any uploaded blobs
      for (const url of uploadedUrls) {
        await deleteBlob(url);
      }
      throw err;
    }

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    log.error("[ticket attachments POST] failed", { error });
    captureRouteError(error, {
      route: "/api/tickets/[id]/attachments",
      method: "POST",
    });
    return serverError("Anhang konnte nicht hochgeladen werden");
  }
}

// ─── GET  /api/tickets/[id]/attachments ────────────────────────
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const perm = requirePermission(user, "tickets", "read");
    if (perm) return perm;

    const addonRequired = await requireTicketingAddon(workspaceId);
    if (addonRequired) return addonRequired;

    const { id } = await params;

    const ticket = await prisma.ticket.findFirst({
      where: { id, workspaceId },
      select: { id: true, createdById: true, assignedToId: true },
    });
    if (!ticket) return notFound("Ticket nicht gefunden");

    if (
      isEmployee(user) &&
      ticket.createdById !== user.id &&
      ticket.assignedToId !== user.id
    ) {
      return forbidden("Kein Zugriff auf dieses Ticket");
    }

    const attachments = await prisma.ticketAttachment.findMany({
      where: { ticketId: id },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      data: attachments.map((a) => ({
        id: a.id,
        fileName: a.fileName,
        fileUrl: a.fileUrl,
        fileType: a.fileType,
        fileSize: a.fileSize.toString(),
        uploadedById: a.uploadedById,
        uploaderName: a.uploaderName,
        createdAt: a.createdAt,
        commentId: a.commentId,
      })),
    });
  } catch (error) {
    log.error("[ticket attachments GET] failed", { error });
    captureRouteError(error, {
      route: "/api/tickets/[id]/attachments",
      method: "GET",
    });
    return serverError("Anhänge konnten nicht geladen werden");
  }
}
