/**
 * POST /api/tickets/attachments/sign
 *
 * Issues short-lived signed upload URLs so the browser can upload ticket
 * attachments straight to Supabase Storage, bypassing the ~4.5 MB request-body
 * limit Vercel imposes on Serverless Functions. The actual ticket (or the
 * /api/tickets/[id]/attachments call) then receives only lightweight metadata
 * and verifies the uploaded objects via finalizeDirectUploads().
 *
 * Body: { files: [{ fileName, fileType, fileSize }], ticketId?: string }
 *   - ticketId omitted → signing for a *new* ticket (requires tickets.create)
 *   - ticketId present  → signing for an existing ticket (requires tickets.update
 *     and access to that ticket)
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isEmployee, requirePermission } from "@/lib/authorization";
import { withRoute } from "@/lib/with-route";
import {
  requireAuth,
  parseJsonBody,
  badRequest,
  notFound,
  forbidden,
} from "@/lib/api-response";
import { requireTicketingAddon } from "@/lib/ticketing-addon";
import {
  MAX_ATTACHMENTS_PER_TICKET,
  validateFile,
  requireStorageQuota,
  createSignedUploadUrls,
} from "@/lib/ticket-attachments";

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

export const POST = withRoute(
  "/api/tickets/attachments/sign",
  "POST",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const addonRequired = await requireTicketingAddon(workspaceId);
    if (addonRequired) return addonRequired;

    const _json = await parseJsonBody(req);
    if (!_json.ok) return _json.response;
    const data = _json.data as { files?: unknown; ticketId?: unknown };

    const ticketId =
      typeof data.ticketId === "string" && data.ticketId.length > 0
        ? data.ticketId
        : null;

    // Permission + (for existing tickets) access check.
    if (ticketId) {
      const perm = requirePermission(user, "tickets", "update");
      if (perm) return perm;
      const ticket = await prisma.ticket.findFirst({
        where: { id: ticketId, workspaceId },
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
    } else {
      const perm = requirePermission(user, "tickets", "create");
      if (perm) return perm;
    }

    const files = parseFiles(data.files);
    if (!files || files.length === 0) {
      return badRequest("Keine Dateien angegeben");
    }
    if (files.length > MAX_ATTACHMENTS_PER_TICKET) {
      return NextResponse.json(
        {
          error: "TOO_MANY_ATTACHMENTS",
          message: `Maximal ${MAX_ATTACHMENTS_PER_TICKET} Anhänge pro Ticket erlaubt.`,
        },
        { status: 400 },
      );
    }

    // Validate metadata up front (size/type/extension) and enforce quota
    // before handing out any upload URLs.
    let totalBytes = 0;
    for (const f of files) {
      const v = validateFile({
        name: f.fileName,
        type: f.fileType,
        size: f.fileSize,
      });
      if (!v.ok) {
        return NextResponse.json(
          {
            error: v.code ?? "INVALID_FILE",
            message: `${f.fileName}: ${v.message ?? "Datei abgelehnt."}`,
          },
          { status: 400 },
        );
      }
      totalBytes += f.fileSize;
    }

    const quotaErr = await requireStorageQuota(workspaceId, totalBytes);
    if (quotaErr) return quotaErr;

    const uploads = await createSignedUploadUrls(workspaceId, files);
    return NextResponse.json({ uploads });
  },
);
