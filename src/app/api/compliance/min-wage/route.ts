import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth, parseJsonBody } from "@/lib/api-response";
import { requireAdmin } from "@/lib/authorization";
import { withRoute } from "@/lib/with-route";
import { validateBody } from "@/lib/validations";
import { createAuditLog } from "@/lib/audit";

const minWageSchema = z.object({
  // €/h, accepted as a number, stored as cents. 1.00–100.00 €/h.
  hourlyWage: z.coerce.number().min(1).max(100),
});

/**
 * GET /api/compliance/min-wage — current applicable minimum wage (€/h).
 */
export const GET = withRoute("/api/compliance/min-wage", "GET", async () => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { workspaceId } = auth;

  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { minHourlyWageCents: true },
  });
  return NextResponse.json({
    minHourlyWageCents: ws?.minHourlyWageCents ?? 1390,
  });
});

/**
 * PATCH /api/compliance/min-wage — set the applicable minimum wage. Admin only.
 * Body: { hourlyWage: number }  (€/h)
 */
export const PATCH = withRoute(
  "/api/compliance/min-wage",
  "PATCH",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const adminErr = requireAdmin(user);
    if (adminErr) return adminErr;

    const _json = await parseJsonBody(req);
    if (!_json.ok) return _json.response;
    const parsed = validateBody(minWageSchema, _json.data);
    if (!parsed.success) return parsed.response;

    const minHourlyWageCents = Math.round(parsed.data.hourlyWage * 100);
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { minHourlyWageCents },
    });

    createAuditLog({
      action: "UPDATE",
      entityType: "Workspace",
      entityId: workspaceId,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: { minHourlyWageCents },
    });

    return NextResponse.json({ minHourlyWageCents });
  },
  { idempotent: true },
);
