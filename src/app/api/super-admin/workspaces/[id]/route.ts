import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/super-admin-auth";
import { runUnscoped } from "@/lib/workspace-scope";
import { withRoute, type RouteContext } from "@/lib/with-route";

/**
 * GET /api/super-admin/workspaces/[id]
 * Per-workspace drill-down for the super-admin console: members (with roles
 * and 2FA/verification status), subscription, entity counts, and the most
 * recent audit entries. Wrapped in runUnscoped() because this is an
 * intentionally cross-tenant read.
 */
export const GET = withRoute(
  "/api/super-admin/workspaces/[id]",
  "GET",
  async (_req: Request, context?: RouteContext) => {
    const denied = await requireSuperAdmin();
    if (denied) return denied;

    const { id: workspaceId } = await context!.params;

    const data = await runUnscoped(async () => {
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        include: {
          subscription: true,
          _count: {
            select: {
              members: true,
              employees: true,
              shifts: true,
              tickets: true,
            },
          },
        },
      });
      if (!workspace) return null;

      const [members, auditLogs] = await Promise.all([
        prisma.user.findMany({
          where: { workspaceId },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            twoFactorEnabled: true,
            emailVerified: true,
            createdAt: true,
          },
          orderBy: { createdAt: "asc" },
        }),
        prisma.auditLog.findMany({
          where: { workspaceId },
          select: {
            id: true,
            action: true,
            entityType: true,
            userEmail: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
      ]);

      return { workspace, members, auditLogs };
    });

    if (!data) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(data);
  },
);
