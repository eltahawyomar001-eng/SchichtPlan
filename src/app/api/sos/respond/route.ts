import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRoute } from "@/lib/with-route";
import { emitSosEvent } from "@/lib/sos-events";
import { log } from "@/lib/logger";

/**
 * GET /api/sos/respond?token=<responseToken>
 *
 * Returns the SOS request details for the employee response page.
 * No auth — the token IS the credential.
 *
 * Side effect: stamps `linkOpenedAt` the first time an employee
 * opens their token and emits a LINK_OPENED audit event so the
 * control-room ledger can show who saw the request and when.
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

  // Stamp first-open + emit audit event exactly once per employee.
  if (!notif.linkOpenedAt) {
    await prisma.sosNotification
      .update({
        where: { id: notif.id },
        data: { linkOpenedAt: new Date() },
      })
      .catch(() => {});
    await emitSosEvent({
      sosRequestId: notif.sosRequestId,
      type: "LINK_OPENED",
      actorType: "EMPLOYEE",
      actorId: notif.employeeId,
      actorName:
        `${notif.employee.firstName} ${notif.employee.lastName}`.trim(),
      metadata: { tier: notif.tier },
    });
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
 *
 * Employee accepts or declines. No auth — token is the credential.
 *
 * For ACCEPT: uses a compare-and-swap UPDATE inside a transaction
 * (`UPDATE … SET status='FILLED' WHERE id=… AND status='OPEN'`).
 * The row-level lock that UPDATE acquires plus the conditional
 * predicate guarantees that even under concurrent acceptance
 * attempts, **exactly one** notification wins. All other in-flight
 * acceptances see zero affected rows and return `alreadyResolved`.
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
        select: { id: true, status: true, expiresAt: true, shiftId: true },
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
  const employeeFullName =
    `${notif.employee.firstName} ${notif.employee.lastName}`.trim();

  if (action === "decline") {
    await prisma.sosNotification.update({
      where: { id: notif.id },
      data: { response: "DECLINED", respondedAt: now },
    });
    await emitSosEvent({
      sosRequestId: sos.id,
      type: "DECLINED",
      actorType: "EMPLOYEE",
      actorId: notif.employeeId,
      actorName: employeeFullName,
      metadata: { tier: notif.tier },
    });
    log.info(`[SOS] ${employeeFullName} declined SOS ${sos.id}`);
    return NextResponse.json({ ok: true, accepted: false });
  }

  // ── ACCEPT: race-safe compare-and-swap claim ───────────────────
  // Inside a single transaction:
  //  1. Atomically flip SosRequest.status OPEN → FILLED via a
  //     conditional UPDATE. The row-level lock + WHERE predicate
  //     means only ONE concurrent writer succeeds; everyone else
  //     gets zero affected rows.
  //  2. Only the winner writes the notification, shift assignment,
  //     and downstream state. Losers short-circuit with `conflict`.
  const result = await prisma.$transaction(async (tx) => {
    const claimed = await tx.sosRequest.updateMany({
      where: { id: sos.id, status: "OPEN" },
      data: {
        status: "FILLED",
        filledById: notif.employeeId,
        filledAt: now,
      },
    });

    if (claimed.count === 0) {
      // Another acceptance won the race
      return { conflict: true as const };
    }

    await tx.sosNotification.update({
      where: { id: notif.id },
      data: { response: "ACCEPTED", respondedAt: now },
    });

    await tx.sosNotification.updateMany({
      where: {
        sosRequestId: sos.id,
        response: "PENDING",
        id: { not: notif.id },
      },
      data: { response: "EXPIRED", respondedAt: now },
    });

    await tx.shift.update({
      where: { id: sos.shiftId },
      data: { employeeId: notif.employeeId, status: "SCHEDULED" },
    });

    return { ok: true as const };
  });

  if ("conflict" in result) {
    return NextResponse.json({ alreadyResolved: true });
  }

  // ACCEPTED + FILLED events (outside the txn so audit failures
  // never undo the actual claim)
  await emitSosEvent({
    sosRequestId: sos.id,
    type: "ACCEPTED",
    actorType: "EMPLOYEE",
    actorId: notif.employeeId,
    actorName: employeeFullName,
    metadata: { tier: notif.tier },
  });
  await emitSosEvent({
    sosRequestId: sos.id,
    type: "FILLED",
    metadata: {
      employeeId: notif.employeeId,
      employeeName: employeeFullName,
      shiftId: sos.shiftId,
    },
  });

  log.info(
    `[SOS] ${employeeFullName} ACCEPTED SOS ${sos.id} → shift ${sos.shiftId}`,
  );

  return NextResponse.json({
    ok: true,
    accepted: true,
    shiftId: sos.shiftId,
    employeeName: employeeFullName,
  });
});
