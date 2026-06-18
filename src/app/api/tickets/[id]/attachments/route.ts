/**
 * Ticket Attachments — upload (POST) and list (GET).
 *
 * POST  /api/tickets/[id]/attachments
 *   JSON { attachments: [{ path, fileName, fileType }], commentId? } referencing
 *   objects already uploaded to storage via signed URLs (see
 *   /api/tickets/attachments/sign). Optional "commentId" associates the
 *   attachments with a specific comment.
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

// Attachments are uploaded directly to storage from the browser (signed URLs),
// so this route only handles small JSON metadata — but we keep the Node.js
// runtime for the Supabase service-role storage client used at finalize time.
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
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
  requireStorageQuota,
  recordStorageUsage,
  deleteBlob,
  finalizeDirectUploads,
} from "@/lib/ticket-attachments";

// ─── POST  /api/tickets/[id]/attachments ───────────────────────
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Pre-flight: detect missing Supabase storage config before touching DB or file data.
    const hasUrl = !!(
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.DATABASE_URL?.match(/postgres\.([a-z0-9]+)[.:]/)
    );
    const hasKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!hasUrl || !hasKey) {
      log.error("[ticket attachments POST] Supabase env vars not set");
      return NextResponse.json(
        {
          error: "STORAGE_NOT_CONFIGURED",
          message:
            "Datei-Upload ist derzeit nicht konfiguriert. Bitte Administrator kontaktieren.",
        },
        { status: 500 },
      );
    }

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

    // Body: JSON { attachments: [{ path, fileName, fileType }], commentId? }
    // referencing objects the browser already uploaded straight to storage via
    // signed URLs (see /api/tickets/attachments/sign). This bypasses Vercel's
    // ~4.5 MB Serverless request-body limit. Multipart bodies are no longer
    // accepted here since they fail at the platform edge for large files.
    let parsed: {
      attachments?: Array<{ path: string; fileName: string; fileType: string }>;
      commentId?: string | null;
    };
    try {
      parsed = await req.json();
    } catch {
      return badRequest("Ungültige Anfrage");
    }

    const claims = Array.isArray(parsed.attachments) ? parsed.attachments : [];
    const commentId =
      typeof parsed.commentId === "string" && parsed.commentId.length > 0
        ? parsed.commentId
        : null;

    if (claims.length === 0) {
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
    if (existingCount + claims.length > MAX_ATTACHMENTS_PER_TICKET) {
      return NextResponse.json(
        {
          error: "TOO_MANY_ATTACHMENTS",
          message: `Maximal ${MAX_ATTACHMENTS_PER_TICKET} Anhänge pro Ticket erlaubt.`,
        },
        { status: 400 },
      );
    }

    // Verify the uploaded objects exist, are in this workspace, and match their
    // declared size/type. Authoritative sizes come back from storage.
    const { valid, rejections } = await finalizeDirectUploads(
      workspaceId,
      claims,
    );

    if (valid.length === 0) {
      return NextResponse.json(
        {
          error: "ALL_FILES_REJECTED",
          message:
            rejections[0]?.message ??
            "Keine der Dateien konnte hochgeladen werden.",
          rejections,
        },
        { status: 400 },
      );
    }

    let totalBytes = 0;
    for (const a of valid) totalBytes += a.size;

    // Quota check (single shot for the whole batch) with authoritative sizes.
    const quotaErr = await requireStorageQuota(workspaceId, totalBytes);
    if (quotaErr) {
      for (const a of valid) await deleteBlob(a.publicUrl);
      return quotaErr;
    }

    // Persist rows for the verified objects.
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

    const persistedUrls: string[] = []; // for rollback if DB fails
    let recordedBytes = 0;

    try {
      for (const a of valid) {
        const row = await prisma.ticketAttachment.create({
          data: {
            ticketId: id,
            commentId,
            fileName: a.fileName,
            fileUrl: a.publicUrl,
            fileType: a.fileType,
            fileSize: BigInt(a.size),
            uploadedById: user.id,
            uploaderName: user.name ?? null,
            workspaceId,
          },
        });
        persistedUrls.push(a.publicUrl);
        recordedBytes += a.size;

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

      await recordStorageUsage(workspaceId, recordedBytes);
    } catch (err) {
      // Best-effort rollback of any objects we linked.
      for (const url of persistedUrls) {
        await deleteBlob(url);
      }
      throw err;
    }

    return NextResponse.json(
      { data: created, rejections: rejections.length ? rejections : undefined },
      { status: 201 },
    );
  } catch (error) {
    log.error("[ticket attachments POST] failed", { error });
    captureRouteError(error, {
      route: "/api/tickets/[id]/attachments",
      method: "POST",
    });
    const msg = error instanceof Error ? error.message : String(error);
    log.error("[ticket attachments POST] upload error detail", { msg });
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
    // Surface the actual Supabase rejection reason so it reaches the client
    // (stripped of the SUPABASE_UPLOAD_ERROR: prefix for readability).
    const clientMsg = msg.startsWith("SUPABASE_UPLOAD_ERROR: ")
      ? msg.slice("SUPABASE_UPLOAD_ERROR: ".length)
      : msg;
    return NextResponse.json(
      {
        error: "ATTACHMENT_UPLOAD_FAILED",
        message: `Anhang konnte nicht hochgeladen werden: ${clientMsg.slice(0, 200)}`,
      },
      { status: 500 },
    );
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
