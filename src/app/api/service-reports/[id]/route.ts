import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission } from "@/lib/authorization";
import { createAuditLog } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { updateServiceReportSchema, validateBody } from "@/lib/validations";

// ─── GET  /api/service-reports/[id] ─────────────────────────────
export const GET = withRoute(
  "/api/service-reports/[id]",
  "GET",
  async (req, context) => {
    const params = await context!.params;
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const user = session.user as SessionUser;
    const workspaceId = user.workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const forbidden = requirePermission(user, "service-reports", "read");
    if (forbidden) return forbidden;

    const report = await prisma.serviceReport.findFirst({
      where: { id, workspaceId },
      include: {
        visits: {
          include: {
            employee: {
              select: { id: true, firstName: true, lastName: true },
            },
            location: { select: { id: true, name: true, address: true } },
            signature: {
              select: {
                id: true,
                signerName: true,
                signerRole: true,
                signedAt: true,
                signatureHash: true,
              },
            },
          },
          orderBy: { scheduledDate: "asc" },
        },
      },
    });

    if (!report) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(report);
  },
);

// ─── PATCH  /api/service-reports/[id] ───────────────────────────
export const PATCH = withRoute(
  "/api/service-reports/[id]",
  "PATCH",
  async (req, context) => {
    const params = await context!.params;
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const user = session.user as SessionUser;
    const workspaceId = user.workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const forbidden = requirePermission(user, "service-reports", "update");
    if (forbidden) return forbidden;

    const existing = await prisma.serviceReport.findFirst({
      where: { id, workspaceId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = validateBody(updateServiceReportSchema, body);
    if (!parsed.success) return parsed.response;
    const { data: validData } = parsed;

    const data: Record<string, unknown> = {};
    if (validData.title) data.title = validData.title;
    if (validData.status) data.status = validData.status;
    if (validData.pdfUrl !== undefined) data.pdfUrl = validData.pdfUrl || null;

    // If status is ERSTELLT, set generatedAt
    if (validData.status === "ERSTELLT" && !existing.generatedAt) {
      data.generatedAt = new Date();
    }

    const report = await prisma.serviceReport.update({
      where: { id },
      data,
    });

    createAuditLog({
      action: "UPDATE",
      entityType: "service-report",
      entityId: id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
    });

    dispatchWebhook(workspaceId, "service_report.updated", { id }).catch(
      () => {},
    );

    return NextResponse.json(report);
  },
);

// ─── DELETE  /api/service-reports/[id] ──────────────────────────
export const DELETE = withRoute(
  "/api/service-reports/[id]",
  "DELETE",
  async (req, context) => {
    const params = await context!.params;
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const user = session.user as SessionUser;
    const workspaceId = user.workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const forbidden = requirePermission(user, "service-reports", "delete");
    if (forbidden) return forbidden;

    const existing = await prisma.serviceReport.findFirst({
      where: { id, workspaceId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Unlink visits from this report first
    await prisma.serviceVisit.updateMany({
      where: { reportId: id },
      data: { reportId: null },
    });

    await prisma.serviceReport.delete({ where: { id } });

    createAuditLog({
      action: "DELETE",
      entityType: "service-report",
      entityId: id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
    });

    log.info("[service-reports] Report deleted", { reportId: id });

    dispatchWebhook(workspaceId, "service_report.deleted", { id }).catch(
      () => {},
    );

    return NextResponse.json({ success: true });
  },
);
