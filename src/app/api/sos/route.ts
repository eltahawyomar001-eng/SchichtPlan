import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-response";
import { requirePermission } from "@/lib/authorization";
import { withRoute } from "@/lib/with-route";
import {
  rankEmployeesForSos,
  notifyEmployeeTier,
  getTierSlice,
} from "@/lib/sos-ranking";
import { log } from "@/lib/logger";

/**
 * POST /api/sos
 * Launch an SOS emergency fill request for a shift.
 * Body: { shiftId, bonusAmount?, bonusCurrency?, bonusNote? }
 */
export const POST = withRoute("/api/sos", "POST", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const forbidden = requirePermission(user, "shifts", "update");
  if (forbidden) return forbidden;

  const body = await req.json();
  const {
    shiftId,
    bonusAmount,
    bonusCurrency = "EUR",
    bonusNote,
  } = body as {
    shiftId: string;
    bonusAmount?: number | null;
    bonusCurrency?: string;
    bonusNote?: string | null;
  };

  if (!shiftId)
    return NextResponse.json({ error: "shiftId required" }, { status: 400 });

  const shift = await prisma.shift.findFirst({
    where: { id: shiftId, workspaceId: user.workspaceId, deletedAt: null },
    include: { location: { select: { name: true } } },
  });

  if (!shift)
    return NextResponse.json({ error: "Shift not found" }, { status: 404 });

  const existing = await prisma.sosRequest.findFirst({
    where: { shiftId, status: "OPEN" },
  });
  if (existing) {
    return NextResponse.json(
      { error: "ALREADY_OPEN", sosRequestId: existing.id },
      { status: 409 },
    );
  }

  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const nextEscalationAt = new Date(Date.now() + 15 * 60 * 1000);

  const sos = await prisma.sosRequest.create({
    data: {
      workspaceId: user.workspaceId,
      shiftId,
      createdById: user.id,
      bonusAmount: bonusAmount ?? null,
      bonusCurrency,
      bonusNote: bonusNote ?? null,
      expiresAt,
      nextEscalationAt,
      escalationTier: 1,
    },
  });

  const ranked = await rankEmployeesForSos(
    shift,
    user.workspaceId,
    shift.employeeId,
  );
  const tier1 = getTierSlice(ranked, 1);

  if (tier1.length > 0) {
    await notifyEmployeeTier(
      sos.id,
      tier1,
      1,
      shift as Parameters<typeof notifyEmployeeTier>[3],
      bonusAmount ?? null,
      bonusCurrency,
      bonusNote ?? null,
      "de",
    );
  }

  log.info(
    `[SOS] Created ${sos.id} for shift ${shiftId}, notified ${tier1.length} tier-1 employees`,
  );
  return NextResponse.json({ sosRequestId: sos.id, notified: tier1.length });
});

/**
 * GET /api/sos
 * List active SOS requests for this workspace.
 */
export const GET = withRoute("/api/sos", "GET", async () => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const forbidden = requirePermission(user, "shifts", "read");
  if (forbidden) return forbidden;

  const requests = await prisma.sosRequest.findMany({
    where: { workspaceId: user.workspaceId, status: "OPEN" },
    include: {
      shift: { include: { location: { select: { name: true } } } },
      notifications: {
        include: {
          employee: {
            select: { id: true, firstName: true, lastName: true, color: true },
          },
        },
        orderBy: { tier: "asc" },
      },
      filledBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ sosRequests: requests });
});
