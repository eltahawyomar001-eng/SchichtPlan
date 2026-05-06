import { NextResponse } from "next/server";
import { withRoute } from "@/lib/with-route";
import { verifyQrToken } from "@/lib/qr-token";
import { prisma } from "@/lib/db";

/**
 * GET /api/qr-clock/employees?t={token}
 *
 * Public endpoint (no session required).
 * Validates the QR token, then returns a minimal employee list for the
 * workspace so the fast-punch page can render the employee selector.
 */
export const GET = withRoute("/api/qr-clock/employees", "GET", async (req) => {
  const token = new URL(req.url).searchParams.get("t");
  if (!token) {
    return NextResponse.json({ error: "MISSING_TOKEN" }, { status: 400 });
  }

  const workspaceId = verifyQrToken(token);
  if (!workspaceId) {
    return NextResponse.json(
      { error: "INVALID_OR_EXPIRED_TOKEN" },
      { status: 401 },
    );
  }

  const employees = await prisma.employee.findMany({
    where: { workspaceId, isActive: true, deletedAt: null },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      color: true,
      position: true,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { name: true },
  });

  return NextResponse.json({
    workspaceName: workspace?.name ?? "",
    employees,
  });
});
