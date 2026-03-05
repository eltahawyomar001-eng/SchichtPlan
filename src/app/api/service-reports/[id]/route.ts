import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission } from "@/lib/authorization";
import { createAuditLog } from "@/lib/audit";
import { log } from "@/lib/logger";

// ─── GET  /api/service-reports/[id] ─────────────────────────────
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
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
  } catch (error) {
    log.error("Error fetching service report:", { error });
    return NextResponse.json({ error: "Error loading" }, { status: 500 });
  }
}

// ─── PATCH  /api/service-reports/[id] ───────────────────────────
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
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
    const data: Record<string, unknown> = {};
    if (body.title) data.title = body.title;
    if (body.status) data.status = body.status;
    if (body.pdfUrl !== undefined) data.pdfUrl = body.pdfUrl || null;

    // If status is ERSTELLT, set generatedAt
    if (body.status === "ERSTELLT" && !existing.generatedAt) {
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

    return NextResponse.json(report);
  } catch (error) {
    log.error("Error updating service report:", { error });
    return NextResponse.json({ error: "Error updating" }, { status: 500 });
  }
}

// ─── DELETE  /api/service-reports/[id] ──────────────────────────
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
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

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("Error deleting service report:", { error });
    return NextResponse.json({ error: "Error deleting" }, { status: 500 });
  }
}
