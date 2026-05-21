import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-response";
import { requirePermission } from "@/lib/authorization";
import { withRoute } from "@/lib/with-route";
import type { RouteContext } from "@/lib/with-route";
import { emitSosEvent } from "@/lib/sos-events";
import { log } from "@/lib/logger";

/**
 * GET /api/sos/[id]
 * Real-time status for the manager live board (poll every 3s).
 */
export const GET = withRoute(
  "/api/sos/[id]",
  "GET",
  async (_req, context?: RouteContext) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user } = auth;

    const forbidden = requirePermission(user, "shifts", "read");
    if (forbidden) return forbidden;

    const { id } = await context!.params;

    const sos = await prisma.sosRequest.findFirst({
      where: { id, workspaceId: user.workspaceId },
      include: {
        shift: {
          include: {
            location: { select: { name: true } },
            employee: { select: { firstName: true, lastName: true } },
          },
        },
        notifications: {
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                color: true,
              },
            },
          },
          orderBy: [{ tier: "asc" }, { notifiedAt: "asc" }],
        },
        events: {
          orderBy: { createdAt: "asc" },
        },
        filledBy: {
          select: { id: true, firstName: true, lastName: true, color: true },
        },
        createdBy: { select: { name: true, email: true } },
      },
    });

    if (!sos) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ sos });
  },
);

/**
 * DELETE /api/sos/[id]
 * Manager cancels the SOS request.
 */
export const DELETE = withRoute(
  "/api/sos/[id]",
  "DELETE",
  async (_req, context?: RouteContext) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user } = auth;

    const forbidden = requirePermission(user, "shifts", "update");
    if (forbidden) return forbidden;

    const { id } = await context!.params;

    const sos = await prisma.sosRequest.findFirst({
      where: { id, workspaceId: user.workspaceId },
    });

    if (!sos) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (sos.status !== "OPEN")
      return NextResponse.json({ error: "SOS is not open" }, { status: 409 });

    await prisma.sosRequest.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    await emitSosEvent({
      sosRequestId: id,
      type: "CANCELLED",
      actorType: "USER",
      actorId: user.id,
      actorName: user.name ?? user.email ?? "Manager",
    });

    log.info(`[SOS] Cancelled ${id} by user ${user.id}`);
    return NextResponse.json({ ok: true });
  },
);
