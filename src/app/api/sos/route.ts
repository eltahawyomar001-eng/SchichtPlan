import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, parseJsonBody } from "@/lib/api-response";
import { requirePermission } from "@/lib/authorization";
import { withRoute } from "@/lib/with-route";
import {
  rankEmployeesForSos,
  notifyEmployeeTier,
  getTierSlice,
} from "@/lib/sos-ranking";
import { emitSosEvent } from "@/lib/sos-events";
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

  const _json = await parseJsonBody(req);
  if (!_json.ok) return _json.response;
  const body = _json.data;
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

  // Rate limit: max 3 SOS launches per workspace per 5 minutes to prevent
  // accidental or malicious notification storms burning Twilio/Resend credits.
  const recentCount = await prisma.sosRequest.count({
    where: {
      workspaceId: user.workspaceId!,
      createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
    },
  });
  if (recentCount >= 3) {
    return NextResponse.json(
      {
        error: "RATE_LIMITED",
        message:
          "Maximal 3 SOS-Anfragen pro 5 Minuten erlaubt. Bitte warten Sie kurz.",
        messageEn: "Maximum 3 SOS requests per 5 minutes. Please wait.",
      },
      { status: 429 },
    );
  }

  const existing = await prisma.sosRequest.findFirst({
    where: { shiftId, status: "OPEN" },
  });
  if (existing) {
    return NextResponse.json(
      { error: "ALREADY_OPEN", sosRequestId: existing.id },
      { status: 409 },
    );
  }

  // Rank candidates BEFORE creating the record — if nobody can be notified,
  // return a clear error instead of creating an orphaned SOS request.
  const ranked = await rankEmployeesForSos(
    shift,
    user.workspaceId,
    shift.employeeId,
  );

  if (ranked.length === 0) {
    return NextResponse.json(
      {
        error: "NO_CANDIDATES",
        message:
          "Keine geeigneten Mitarbeiter für SOS-Benachrichtigung gefunden. Bitte mindestens einen weiteren Mitarbeiter anlegen.",
        messageEn:
          "No eligible employees found for SOS notification. Please add at least one other employee first.",
      },
      { status: 422 },
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

  // CREATED event — manager opened the SOS
  await emitSosEvent({
    sosRequestId: sos.id,
    type: "CREATED",
    actorType: "USER",
    actorId: user.id,
    actorName: user.name ?? user.email ?? "Manager",
    metadata: {
      bonusAmount: bonusAmount ?? null,
      bonusCurrency,
      bonusNote: bonusNote ?? null,
      shiftId,
    },
  });

  // RANKED event — system indexed candidates by reliability
  await emitSosEvent({
    sosRequestId: sos.id,
    type: "RANKED",
    metadata: {
      candidateCount: ranked.length,
      tier1Count: Math.min(ranked.length, 5),
      tier2Count: Math.min(Math.max(ranked.length - 5, 0), 10),
      tier3Count: Math.min(Math.max(ranked.length - 15, 0), 20),
    },
  });

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

    // TIER_NOTIFIED event — first wave dispatched
    await emitSosEvent({
      sosRequestId: sos.id,
      type: "TIER_NOTIFIED",
      metadata: {
        tier: 1,
        count: tier1.length,
        employees: tier1.map((e) => ({
          id: e.id,
          name: `${e.firstName} ${e.lastName}`,
          reliabilityScore: e.reliabilityScore,
        })),
      },
    });
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
export const GET = withRoute("/api/sos", "GET", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const forbidden = requirePermission(user, "shifts", "read");
  if (forbidden) return forbidden;

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope") ?? "active";
  // active: only OPEN requests
  // recent: OPEN + closed within last 14 days
  // all: every SOS row for this workspace
  const where: Parameters<typeof prisma.sosRequest.findMany>[0] = { where: {} };
  if (scope === "active") {
    where.where = { workspaceId: user.workspaceId, status: "OPEN" };
  } else if (scope === "recent") {
    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    where.where = {
      workspaceId: user.workspaceId,
      OR: [{ status: "OPEN" }, { createdAt: { gte: cutoff } }],
    };
  } else {
    where.where = { workspaceId: user.workspaceId };
  }

  const requests = await prisma.sosRequest.findMany({
    ...where,
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
