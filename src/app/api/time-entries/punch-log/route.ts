import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-response";
import { requirePermission } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { withRoute } from "@/lib/with-route";

export const GET = withRoute(
  "/api/time-entries/punch-log",
  "GET",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "time-entries", "read");
    if (forbidden) return forbidden;

    const url = new URL(req.url);
    const take = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);

    const entries = await prisma.timeEntry.findMany({
      where: {
        workspaceId,
        isLiveClock: true,
        deletedAt: null,
      },
      orderBy: { clockInAt: "desc" },
      take,
      select: {
        id: true,
        clockInAt: true,
        clockOutAt: true,
        date: true,
        employee: { select: { firstName: true, lastName: true } },
      },
    });

    return NextResponse.json({ entries });
  },
);
