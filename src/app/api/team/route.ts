import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";

/**
 * GET /api/team — list all workspace members
 */
export const GET = withRoute("/api/team", "GET", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  const { take, skip } = parsePagination(req);
  const where = { workspaceId: user.workspaceId };

  const [members, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
      take,
      skip,
    }),
    prisma.user.count({ where }),
  ]);

  return paginatedResponse(members, total, take, skip);
});
