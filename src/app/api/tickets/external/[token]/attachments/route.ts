/**
 * External Ticket Attachments — POST upload (no auth, token-based).
 *
 * POST /api/tickets/external/[token]/attachments
 *   Multipart form-data with one or more "file" fields.
 *
 * Hardening for the public endpoint:
 *   • Rejects non-EXTERN tickets and tickets in a closed state.
 *   • Per-file size limited to MAX_EXTERNAL_FILE_BYTES (10 MB, half the
 *     internal cap to discourage abuse).
 *   • Per-request file count capped at MAX_EXTERNAL_FILES_PER_REQUEST (3).
 *   • Per-ticket cap MAX_ATTACHMENTS_PER_TICKET still applies.
 *   • Workspace storage quota enforced.
 *   • In-memory sliding window rate limit per token (5 uploads / minute).
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
  validateFile,
  requireStorageQuota,
  recordStorageUsage,
  uploadToBlob,
  deleteBlob,
} from "@/lib/ticket-attachments";

const MAX_EXTERNAL_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_EXTERNAL_FILES_PER_REQUEST = 3;

// In-memory rate limit (best-effort; falls back to allow under restart).
// 5 uploads per token per 60 s.
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 5;
const rateBuckets = new Map<string, number[]>();

function rateLimit(token: string): boolean {
  const now = Date.now();
  const arr = (rateBuckets.get(token) ?? []).filter(
    (t) => now - t < RATE_WINDOW_MS,
  );
  if (arr.length >= RATE_LIMIT) {
    rateBuckets.set(token, arr);
    return false;
  }
  arr.push(now);
  rateBuckets.set(token, arr);
  return true;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;

    if (!token || token.length < 10) {
      return notFound("Ticket nicht gefunden");
    }

    if (!rateLimit(token)) {
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

    // Multipart parse
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return badRequest("Anfrage muss multipart/form-data sein");
    }

    const files = formData
      .getAll("file")
      .filter((v): v is File => v instanceof File);

    if (files.length === 0) {
      return badRequest("Keine Datei hochgeladen");
    }
    if (files.length > MAX_EXTERNAL_FILES_PER_REQUEST) {
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
    if (existingCount + files.length > MAX_ATTACHMENTS_PER_TICKET) {
      return NextResponse.json(
        {
          error: "TOO_MANY_ATTACHMENTS",
          message: `Maximal ${MAX_ATTACHMENTS_PER_TICKET} Anhänge pro Ticket erlaubt.`,
        },
        { status: 400 },
      );
    }

    // Validate each file (with stricter external size)
    let totalBytes = 0;
    for (const file of files) {
      if (file.size > MAX_EXTERNAL_FILE_BYTES) {
        return NextResponse.json(
          {
            error: "FILE_TOO_LARGE",
            message: `Datei ist zu groß. Maximal ${MAX_EXTERNAL_FILE_BYTES / 1024 / 1024} MB für externe Uploads.`,
          },
          { status: 400 },
        );
      }
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

    const quotaErr = await requireStorageQuota(ticket.workspaceId, totalBytes);
    if (quotaErr) return quotaErr;

    const created: Array<{
      id: string;
      fileName: string;
      fileUrl: string;
      fileType: string;
      fileSize: string;
      uploaderName: string | null;
      createdAt: Date;
    }> = [];

    const uploadedUrls: string[] = [];

    try {
      for (const file of files) {
        const arrayBuf = await file.arrayBuffer();
        const blob = await uploadToBlob({
          workspaceId: ticket.workspaceId,
          ticketId: ticket.id,
          fileName: file.name,
          contentType: file.type,
          body: arrayBuf,
        });
        uploadedUrls.push(blob.url);

        const row = await prisma.ticketAttachment.create({
          data: {
            ticketId: ticket.id,
            fileName: file.name,
            fileUrl: blob.url,
            fileType: file.type,
            fileSize: BigInt(file.size),
            uploadedById: null,
            uploaderName: ticket.externalSubmitterName ?? "Externer Absender",
            workspaceId: ticket.workspaceId,
          },
        });

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

      await recordStorageUsage(ticket.workspaceId, totalBytes);
    } catch (err) {
      for (const url of uploadedUrls) {
        await deleteBlob(url);
      }
      throw err;
    }

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    log.error("[external ticket attachments POST] failed", { error });
    captureRouteError(error, {
      route: "/api/tickets/external/[token]/attachments",
      method: "POST",
    });
    return serverError("Anhang konnte nicht hochgeladen werden");
  }
}
