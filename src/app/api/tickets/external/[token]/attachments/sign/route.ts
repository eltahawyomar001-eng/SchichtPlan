/**
 * External Ticket Attachments — signed-URL minting (no auth, token-based).
 *
 * POST /api/tickets/external/[token]/attachments/sign
 *   Body: { files: [{ fileName, fileType, fileSize }] }
 *
 * Issues short-lived signed upload URLs so the public ticket-status page can
 * upload attachments directly to Supabase Storage, bypassing Vercel's ~4.5 MB
 * Serverless request-body limit. The companion finalize endpoint
 * (POST /api/tickets/external/[token]/attachments) re-verifies the objects.
 *
 * Same public-endpoint hardening as the finalize route: EXTERN + open ticket,
 * stricter per-file size, per-request file count, per-ticket cap, storage
 * quota, and a per-token sliding-window rate limit.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import { captureRouteError } from "@/lib/sentry";
import { notFound, badRequest } from "@/lib/api-response";
import {
  MAX_ATTACHMENTS_PER_TICKET,
  MAX_EXTERNAL_FILE_BYTES,
  MAX_EXTERNAL_FILES_PER_REQUEST,
  validateFile,
  requireStorageQuota,
  createSignedUploadUrls,
} from "@/lib/ticket-attachments";
import { externalUploadRateLimit } from "@/lib/external-upload-ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface FileMeta {
  fileName: string;
  fileType: string;
  fileSize: number;
}

function parseFiles(input: unknown): FileMeta[] | null {
  if (!Array.isArray(input)) return null;
  const out: FileMeta[] = [];
  for (const f of input) {
    if (
      !f ||
      typeof f !== "object" ||
      typeof (f as FileMeta).fileName !== "string" ||
      typeof (f as FileMeta).fileType !== "string" ||
      typeof (f as FileMeta).fileSize !== "number"
    ) {
      return null;
    }
    const { fileName, fileType, fileSize } = f as FileMeta;
    out.push({ fileName, fileType, fileSize });
  }
  return out;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    if (!token || token.length < 10) return notFound("Ticket nicht gefunden");

    if (!externalUploadRateLimit(token)) {
      return NextResponse.json(
        { error: "RATE_LIMITED", message: "Zu viele Anfragen. Bitte warten." },
        { status: 429 },
      );
    }

    const ticket = await prisma.ticket.findFirst({
      where: { externalToken: token, ticketType: "EXTERN" },
      select: { id: true, status: true, workspaceId: true },
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

    let parsed: { files?: unknown };
    try {
      parsed = await req.json();
    } catch {
      return badRequest("Ungültige Anfrage");
    }

    const files = parseFiles(parsed.files);
    if (!files || files.length === 0)
      return badRequest("Keine Dateien angegeben");
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

    // Validate metadata (stricter external size cap) and quota up front.
    let totalBytes = 0;
    for (const f of files) {
      if (f.fileSize > MAX_EXTERNAL_FILE_BYTES) {
        return NextResponse.json(
          {
            error: "FILE_TOO_LARGE",
            message: `Datei ist zu groß. Maximal ${MAX_EXTERNAL_FILE_BYTES / 1024 / 1024} MB für externe Uploads.`,
          },
          { status: 400 },
        );
      }
      const v = validateFile({
        name: f.fileName,
        type: f.fileType,
        size: f.fileSize,
      });
      if (!v.ok) {
        return NextResponse.json(
          { error: v.code, message: `${f.fileName}: ${v.message}` },
          { status: 400 },
        );
      }
      totalBytes += f.fileSize;
    }

    const quotaErr = await requireStorageQuota(ticket.workspaceId, totalBytes);
    if (quotaErr) return quotaErr;

    const uploads = await createSignedUploadUrls(ticket.workspaceId, files);
    return NextResponse.json({ uploads });
  } catch (error) {
    log.error("[external attachments sign POST] failed", { error });
    captureRouteError(error, {
      route: "/api/tickets/external/[token]/attachments/sign",
      method: "POST",
    });
    return NextResponse.json(
      {
        error: "SIGN_FAILED",
        message: "Upload konnte nicht vorbereitet werden.",
      },
      { status: 500 },
    );
  }
}
