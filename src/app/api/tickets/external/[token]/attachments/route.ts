/**
 * External Ticket Attachments — finalize upload (no auth, token-based).
 *
 * POST /api/tickets/external/[token]/attachments
 *   JSON { attachments: [{ path, fileName, fileType }] } referencing objects the
 *   browser already uploaded to storage via signed URLs (see the sibling
 *   /sign route). Direct uploads bypass Vercel's ~4.5 MB Serverless request-body
 *   limit, which otherwise silently breaks larger external uploads.
 *
 * Hardening for the public endpoint:
 *   • Rejects non-EXTERN tickets and tickets in a closed state.
 *   • Per-file size limited to MAX_EXTERNAL_FILE_BYTES (10 MB).
 *   • Per-request file count capped at MAX_EXTERNAL_FILES_PER_REQUEST (3).
 *   • Per-ticket cap MAX_ATTACHMENTS_PER_TICKET still applies.
 *   • Uploaded objects re-verified (workspace path, size, type, magic bytes).
 *   • Workspace storage quota enforced with authoritative sizes.
 *   • Shared in-memory sliding-window rate limit per token.
 *   • Uploader identity recorded as ticket.externalSubmitterName.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import { captureRouteError } from "@/lib/sentry";
import { serverError, notFound, badRequest } from "@/lib/api-response";
import { logAttachmentAdded } from "@/lib/ticket-events";
import {
  MAX_ATTACHMENTS_PER_TICKET,
  MAX_EXTERNAL_FILE_BYTES,
  MAX_EXTERNAL_FILES_PER_REQUEST,
  requireStorageQuota,
  recordStorageUsage,
  deleteBlob,
  finalizeDirectUploads,
} from "@/lib/ticket-attachments";
import { externalUploadRateLimit } from "@/lib/external-upload-ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;

    if (!token || token.length < 10) {
      return notFound("Ticket nicht gefunden");
    }

    if (!externalUploadRateLimit(token)) {
      return NextResponse.json(
        { error: "RATE_LIMITED", message: "Zu viele Anfragen. Bitte warten." },
        { status: 429 },
      );
    }

    const ticket = await prisma.ticket.findFirst({
      where: {
        externalToken: token,
        ticketType: "EXTERN",
      },
      select: {
        id: true,
        status: true,
        workspaceId: true,
        externalSubmitterName: true,
      },
    });
    if (!ticket) return notFound("Ticket nicht gefunden");

    if (ticket.status === "GESCHLOSSEN") {
      return NextResponse.json(
        {
          error: "TICKET_CLOSED",
          message: "Ticket ist geschlossen, keine Anhänge mehr möglich.",
        },
        { status: 400 },
      );
    }

    let parsed: {
      attachments?: Array<{ path: string; fileName: string; fileType: string }>;
    };
    try {
      parsed = await req.json();
    } catch {
      return badRequest("Ungültige Anfrage");
    }

    const claims = Array.isArray(parsed.attachments) ? parsed.attachments : [];
    if (claims.length === 0) {
      return badRequest("Keine Datei hochgeladen");
    }
    if (claims.length > MAX_EXTERNAL_FILES_PER_REQUEST) {
      return NextResponse.json(
        {
          error: "TOO_MANY_FILES",
          message: `Maximal ${MAX_EXTERNAL_FILES_PER_REQUEST} Dateien pro Upload.`,
        },
        { status: 400 },
      );
    }

    // Per-ticket cap
    const existingCount = await prisma.ticketAttachment.count({
      where: { ticketId: ticket.id },
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

    // Verify uploaded objects (workspace path, existence, size, type, magic).
    const { valid, rejections } = await finalizeDirectUploads(
      ticket.workspaceId,
      claims,
    );

    // Enforce the stricter external per-file size cap on top of validation.
    const accepted: typeof valid = [];
    for (const a of valid) {
      if (a.size > MAX_EXTERNAL_FILE_BYTES) {
        rejections.push({
          fileName: a.fileName,
          code: "FILE_TOO_LARGE",
          message: `Datei ist zu groß. Maximal ${MAX_EXTERNAL_FILE_BYTES / 1024 / 1024} MB für externe Uploads.`,
        });
        await deleteBlob(a.publicUrl);
        continue;
      }
      accepted.push(a);
    }

    if (accepted.length === 0) {
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
    for (const a of accepted) totalBytes += a.size;

    const quotaErr = await requireStorageQuota(ticket.workspaceId, totalBytes);
    if (quotaErr) {
      for (const a of accepted) await deleteBlob(a.publicUrl);
      return quotaErr;
    }

    const created: Array<{
      id: string;
      fileName: string;
      fileUrl: string;
      fileType: string;
      fileSize: string;
      uploaderName: string | null;
      createdAt: Date;
    }> = [];

    const persistedUrls: string[] = [];
    let recordedBytes = 0;

    try {
      for (const a of accepted) {
        const row = await prisma.ticketAttachment.create({
          data: {
            ticketId: ticket.id,
            fileName: a.fileName,
            fileUrl: a.publicUrl,
            fileType: a.fileType,
            fileSize: BigInt(a.size),
            uploadedById: null,
            uploaderName: ticket.externalSubmitterName ?? "Externer Absender",
            workspaceId: ticket.workspaceId,
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
          uploaderName: row.uploaderName,
          createdAt: row.createdAt,
        });

        logAttachmentAdded(
          ticket.id,
          {
            id: null,
            name: ticket.externalSubmitterName ?? "Externer Absender",
          },
          {
            fileName: row.fileName,
            fileSize: row.fileSize,
            fileType: row.fileType,
            commentId: null,
          },
        );
      }

      await recordStorageUsage(ticket.workspaceId, recordedBytes);
    } catch (err) {
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
    log.error("[external ticket attachments POST] failed", { error });
    captureRouteError(error, {
      route: "/api/tickets/external/[token]/attachments",
      method: "POST",
    });
    return serverError("Anhang konnte nicht hochgeladen werden");
  }
}
