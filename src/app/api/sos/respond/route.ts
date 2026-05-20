import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRoute } from "@/lib/with-route";
import { log } from "@/lib/logger";

/**
 * GET /api/sos/respond?token=<responseToken>
 * Returns the SOS request details for the employee response page (no auth needed — token is the credential).
 */
export const GET = withRoute("/api/sos/respond", "GET", async (req) => {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const notif = await prisma.sosNotification.findUnique({
    where: { responseToken: token },
    include: {
      sosRequest: {
        include: {
          shift: { include: { location: { select: { name: true } } } },
        },
      },
      employee: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  if (!notif) {
    return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  }

  const sos = notif.sosRequest;

  if (sos.status !== "OPEN") {
    return NextResponse.json({
      alreadyResolved: true,
      status: sos.status,
      filledById: sos.filledById,
      employeeId: notif.employeeId,
    });
  }

  if (new Date() > sos.expiresAt) {
    return NextResponse.json({ expired: true });
  }

  if (notif.response !== "PENDING") {
    return NextResponse.json({
      alreadyResponded: true,
      response: notif.response,
    });
  }

  return NextResponse.json({
    sos: {
      id: sos.id,
      shift: sos.shift,
      bonusAmount: sos.bonusAmount,
      bonusCurrency: sos.bonusCurrency,
      bonusNote: sos.bonusNote,
      expiresAt: sos.expiresAt,
    },
    employee: notif.employee,
    notifId: notif.id,
  });
});

/**
 * POST /api/sos/respond?token=<responseToken>
 * Employee accepts or declines. No auth — token is the credential.
 *
 * Body: { action: "accept" | "decline" }
 */
export const POST = withRoute("/api/sos/respond", "POST", async (req) => {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const action = (body as { action?: string }).action;

  if (action !== "accept" && action !== "decline") {
    return NextResponse.json(
      { error: "action must be accept or decline" },
      { status: 400 },
    );
  }

  const notif = await prisma.sosNotification.findUnique({
    where: { responseToken: token },
    include: {
      sosRequest: {
        include: {
          shift: { include: { location: { select: { name: true } } } },
        },
      },
      employee: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  if (!notif) {
    return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  }

  const sos = notif.sosRequest;

  if (sos.status !== "OPEN") {
    return NextResponse.json({ alreadyResolved: true, status: sos.status });
  }

  if (new Date() > sos.expiresAt) {
    return NextResponse.json({ expired: true });
  }

  if (notif.response !== "PENDING") {
    return NextResponse.json({
      alreadyResponded: true,
      response: notif.response,
    });
  }

  const now = new Date();

  if (action === "decline") {
    await prisma.sosNotification.update({
      where: { id: notif.id },
      data: { response: "DECLINED", respondedAt: now },
    });
    log.info(`[SOS] ${notif.employee.firstName} declined SOS ${sos.id}`);
    return NextResponse.json({ ok: true, accepted: false });
  }

  // Accept — use a transaction to prevent race conditions
  const result = await prisma.$transaction(async (tx) => {
    // Re-check status inside transaction
    const fresh = await tx.sosRequest.findUnique({ where: { id: sos.id } });
    if (!fresh || fresh.status !== "OPEN") return { conflict: true };

    // Mark notification accepted
    await tx.sosNotification.update({
      where: { id: notif.id },
      data: { response: "ACCEPTED", respondedAt: now },
    });

    // Mark all other pending notifications as expired
    await tx.sosNotification.updateMany({
      where: {
        sosRequestId: sos.id,
        response: "PENDING",
        id: { not: notif.id },
      },
      data: { response: "EXPIRED", respondedAt: now },
    });

    // Assign shift to this employee
    await tx.shift.update({
      where: { id: sos.shiftId },
      data: { employeeId: notif.employeeId, status: "SCHEDULED" },
    });

    // Close the SOS request
    await tx.sosRequest.update({
      where: { id: sos.id },
      data: { status: "FILLED", filledById: notif.employeeId, filledAt: now },
    });

    return { ok: true };
  });

  if ("conflict" in result) {
    return NextResponse.json({ alreadyResolved: true });
  }

  log.info(
    `[SOS] ${notif.employee.firstName} ACCEPTED SOS ${sos.id} → shift ${sos.shiftId}`,
  );

  return NextResponse.json({
    ok: true,
    accepted: true,
    shiftId: sos.shiftId,
    employeeName: `${notif.employee.firstName} ${notif.employee.lastName}`,
  });
});
