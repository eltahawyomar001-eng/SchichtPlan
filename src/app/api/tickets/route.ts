import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isEmployee, requirePermission } from "@/lib/authorization";
import type { TicketCategory, TicketPriority } from "@prisma/client";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { log } from "@/lib/logger";
import { createTicketSchema, validateBody } from "@/lib/validations";
import { captureRouteError } from "@/lib/sentry";
import { requireAuth, serverError, parseJsonBody } from "@/lib/api-response";
import { logTicketCreated, logAttachmentAdded } from "@/lib/ticket-events";
import {
  notifyNewTicket,
  notifyTicketAssigned,
} from "@/lib/ticket-notifications";
import { createTicketWithNumber } from "@/lib/ticket-number";
import {
  recordTicketCreation,
  requireTicketingAddon,
  requireTicketQuota,
} from "@/lib/ticketing-addon";
import {
  MAX_ATTACHMENTS_PER_TICKET,
  validateFile,
  checkMagicBytes,
  requireStorageQuota,
  recordStorageUsage,
  uploadToBlob,
  deleteBlob,
} from "@/lib/ticket-attachments";

// Multi-file upload at creation can push past the default body parser size.
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// ─── GET  /api/tickets ──────────────────────────────────────────
export async function GET(req: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "tickets", "read");
    if (forbidden) return forbidden;

    const addonRequired = await requireTicketingAddon(workspaceId);
    if (addonRequired) return addonRequired;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const priority = searchParams.get("priority");
    const assignedToId = searchParams.get("assignedToId");
    const ticketType = searchParams.get("ticketType");
    const search = searchParams.get("search");
    // Trash-bin filter: ?trash=true → only soft-deleted, default → only active.
    const trashOnly = searchParams.get("trash") === "true";

    const where: Record<string, unknown> = {
      workspaceId,
      deletedAt: trashOnly ? { not: null } : null,
    };

    if (status) where.status = status;
    if (category) where.category = category;
    if (priority) where.priority = priority;
    if (assignedToId) where.assignedToId = assignedToId;
    if (ticketType) where.ticketType = ticketType;

    // EMPLOYEE can see their own tickets + tickets assigned to them
    if (isEmployee(user)) {
      where.OR = [{ createdById: user.id }, { assignedToId: user.id }];
    }

    // Text search on subject and ticketNumber
    if (search) {
      const searchConditions = [
        { subject: { contains: search, mode: "insensitive" } },
        { ticketNumber: { contains: search, mode: "insensitive" } },
      ];

      // Combine with existing OR (employee filter) using AND
      if (where.OR) {
        const employeeFilter = where.OR;
        delete where.OR;
        where.AND = [{ OR: employeeFilter }, { OR: searchConditions }];
      } else {
        where.OR = searchConditions;
      }
    }

    const { take, skip } = parsePagination(req);

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
          _count: { select: { comments: true } },
        },
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      prisma.ticket.count({ where }),
    ]);

    return paginatedResponse(tickets, total, take, skip);
  } catch (error) {
    log.error("Error fetching tickets:", { error });
    captureRouteError(error, { route: "/api/tickets", method: "GET" });
    return serverError("Fehler beim Laden der Tickets");
  }
}

// ─── POST  /api/tickets ─────────────────────────────────────────
// Accepts either JSON or multipart/form-data. Multipart bodies may include
// any number of `file` parts which are uploaded to blob storage and linked
// to the new ticket in the same request — saves the user a second round-trip.
export async function POST(req: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "tickets", "create");
    if (forbidden) return forbidden;

    const quotaCheck = await requireTicketQuota(workspaceId);
    if (quotaCheck) return quotaCheck;

    // ── Parse body (JSON or multipart) ──
    const contentType = req.headers.get("content-type") ?? "";
    type TicketBody = {
      subject: string;
      description: string;
      category: string;
      categoryDefId?: string | null;
      priority?: string;
      location?: string | null;
      objectAddress?: string | null;
      assignedToId?: string | null;
    };
    let rawBody: Record<string, unknown> = {};
    let files: File[] = [];

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const payloadStr = form.get("payload");
      if (typeof payloadStr === "string" && payloadStr.length > 0) {
        try {
          rawBody = JSON.parse(payloadStr);
        } catch {
          return NextResponse.json(
            {
              error: "INVALID_PAYLOAD",
              message: "Formulardaten konnten nicht gelesen werden.",
            },
            { status: 400 },
          );
        }
      } else {
        // Fallback: read flat form fields
        for (const [k, v] of form.entries()) {
          if (k === "file") continue;
          if (typeof v === "string") rawBody[k] = v;
        }
      }
      files = form.getAll("file").filter((v): v is File => v instanceof File);
    } else {
      const _json = await parseJsonBody(req);
      if (!_json.ok) return _json.response;
      rawBody = _json.data as Record<string, unknown>;
    }

    const parsed = validateBody(createTicketSchema, rawBody);
    if (!parsed.success) return parsed.response;
    const body = parsed.data as TicketBody;

    // ── Validate optional assignee belongs to this workspace ──
    let assignedToId: string | null = null;
    if (body.assignedToId) {
      const target = await prisma.user.findFirst({
        where: { id: body.assignedToId, workspaceId },
        select: { id: true },
      });
      if (!target) {
        return NextResponse.json(
          {
            error: "ASSIGNEE_NOT_IN_WORKSPACE",
            message: "Empfänger gehört nicht zu diesem Workspace.",
          },
          { status: 400 },
        );
      }
      assignedToId = target.id;
    }

    // ── Resolve / validate optional categoryDefId ──
    let categoryDefId: string | null = null;
    if (body.categoryDefId) {
      const cat = await prisma.ticketCategoryDef.findFirst({
        where: { id: body.categoryDefId, workspaceId, isActive: true },
        select: { id: true },
      });
      if (!cat) {
        return NextResponse.json(
          {
            error: "CATEGORY_NOT_FOUND",
            message: "Kategorie nicht gefunden.",
          },
          { status: 400 },
        );
      }
      categoryDefId = cat.id;
    }

    // ── Pre-validate files BEFORE creating the ticket so we don't end up
    //    with a ghost ticket if uploads are about to fail. ──
    const rejections: Array<{
      fileName: string;
      code: string;
      message: string;
    }> = [];
    const validFiles: File[] = [];
    let totalBytes = 0;
    if (files.length > MAX_ATTACHMENTS_PER_TICKET) {
      return NextResponse.json(
        {
          error: "TOO_MANY_ATTACHMENTS",
          message: `Maximal ${MAX_ATTACHMENTS_PER_TICKET} Anhänge pro Ticket erlaubt.`,
        },
        { status: 400 },
      );
    }
    for (const file of files) {
      const v = validateFile({
        name: file.name,
        type: file.type,
        size: file.size,
      });
      if (!v.ok) {
        rejections.push({
          fileName: file.name,
          code: v.code ?? "INVALID_FILE",
          message: v.message ?? "Datei abgelehnt.",
        });
        continue;
      }
      validFiles.push(file);
      totalBytes += file.size;
    }
    if (totalBytes > 0) {
      const quotaErr = await requireStorageQuota(workspaceId, totalBytes);
      if (quotaErr) return quotaErr;
    }

    // ── Create the ticket row ──
    const ticket = await createTicketWithNumber<{
      id: string;
      ticketNumber: string;
      subject: string;
      status: string;
      createdBy: { id: string; name: string | null; email: string } | null;
      assignedTo: { id: string; name: string | null; email: string } | null;
    }>(
      workspaceId,
      {
        subject: body.subject,
        description: body.description,
        category: body.category as TicketCategory,
        categoryDefId,
        priority: (body.priority ?? "MITTEL") as TicketPriority,
        ticketType: "INTERN",
        location: body.location || null,
        objectAddress: body.objectAddress || null,
        createdById: user.id,
        assignedToId,
      },
      {
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
        },
      },
    );

    // ── Upload attachments (after the ticket exists) ──
    const uploadedUrls: string[] = [];
    if (validFiles.length > 0) {
      try {
        for (const file of validFiles) {
          const arrayBuf = await file.arrayBuffer();

          // Verify file content matches declared MIME (prevents polyglot files)
          if (!checkMagicBytes(new Uint8Array(arrayBuf), file.type)) {
            rejections.push({
              fileName: file.name,
              code: "MAGIC_BYTES_MISMATCH",
              message: `Der Inhalt von "${file.name}" stimmt nicht mit dem deklarierten Dateityp überein.`,
            });
            continue;
          }

          const blob = await uploadToBlob({
            workspaceId,
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
              uploadedById: user.id,
              uploaderName: user.name ?? null,
              workspaceId,
            },
          });
          logAttachmentAdded(
            ticket.id,
            { id: user.id, name: user.name ?? "System" },
            {
              fileName: row.fileName,
              fileSize: row.fileSize,
              fileType: row.fileType,
              commentId: null,
            },
          );
        }
        await recordStorageUsage(workspaceId, totalBytes);
      } catch (err) {
        // Best-effort rollback of any uploaded blobs.
        for (const url of uploadedUrls) await deleteBlob(url);
        log.error("[tickets POST] attachment upload failed", {
          err,
          ticketId: ticket.id,
        });
        // Ticket stays alive but we surface the partial-failure so the UI can
        // tell the user which files didn't make it through.
        rejections.push({
          fileName: "",
          code: "ATTACHMENT_UPLOAD_FAILED",
          message:
            err instanceof Error
              ? err.message
              : "Anhang konnte nicht hochgeladen werden.",
        });
      }
    }

    // Fire-and-forget: audit trail
    logTicketCreated(
      ticket.id,
      { id: user.id, name: user.name ?? "System" },
      {
        ticketNumber: ticket.ticketNumber,
        ticketType: "INTERN",
      },
    );

    log.info("Ticket created", {
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      userId: user.id,
      workspaceId,
      attachmentCount: validFiles.length,
    });

    recordTicketCreation(workspaceId).catch((err) =>
      log.error("[ticketing-addon] recordTicketCreation failed", {
        err,
        workspaceId,
      }),
    );

    notifyNewTicket({
      creatorId: user.id,
      workspaceId,
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      creatorName: user.name ?? "Mitarbeiter",
    });

    if (assignedToId && assignedToId !== user.id) {
      notifyTicketAssigned({
        assigneeId: assignedToId,
        workspaceId,
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
        assignedByName: user.name ?? "System",
      });
    }

    return NextResponse.json(
      {
        ...ticket,
        rejections: rejections.length ? rejections : undefined,
      },
      { status: 201 },
    );
  } catch (error) {
    log.error("Error creating ticket:", { error });
    captureRouteError(error, { route: "/api/tickets", method: "POST" });
    return serverError("Fehler beim Erstellen des Tickets");
  }
}
