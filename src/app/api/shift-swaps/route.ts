import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isEmployee } from "@/lib/authorization";
import {
  createSystemNotification,
  checkShiftConflicts,
} from "@/lib/automations";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { log } from "@/lib/logger";
import { createShiftSwapSchema, validateBody } from "@/lib/validations";
import { requireAuth, serverError } from "@/lib/api-response";

// ─── GET  /api/shift-swaps ──────────────────────────────────────
export async function GET(req: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const where: Record<string, unknown> = { workspaceId };
    if (status) where.status = status;

    // EMPLOYEE can only see swaps they are involved in
    if (isEmployee(user) && user.employeeId) {
      where.OR = [
        { requesterId: user.employeeId },
        { targetId: user.employeeId },
      ];
    }

    const { take, skip } = parsePagination(req);

    const [swaps, total] = await Promise.all([
      prisma.shiftSwapRequest.findMany({
        where,
        include: {
          requester: true,
          target: true,
          shift: { include: { location: true } },
          targetShift: { include: { location: true } },
        },
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      prisma.shiftSwapRequest.count({ where }),
    ]);

    return paginatedResponse(swaps, total, take, skip);
  } catch (error) {
    log.error("Error fetching shift swaps:", { error: error });
    return serverError("Error loading");
  }
}

// ─── POST  /api/shift-swaps ─────────────────────────────────────
export async function POST(req: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const parsed = validateBody(createShiftSwapSchema, await req.json());
    if (!parsed.success) return parsed.response;

    const body = parsed.data;

    // Verify shift belongs to requester
    const shift = await prisma.shift.findUnique({
      where: { id: body.shiftId },
    });

    if (!shift || shift.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }

    if (shift.employeeId !== body.requesterId) {
      return NextResponse.json(
        { error: "The shift does not belong to the requester" },
        { status: 400 },
      );
    }

    // ── Check for concurrent pending swap requests on this shift ──
    const existingSwap = await prisma.shiftSwapRequest.findFirst({
      where: {
        shiftId: body.shiftId,
        status: "ANGEFRAGT",
      },
    });

    if (existingSwap) {
      return NextResponse.json(
        {
          error:
            "Für diese Schicht liegt bereits ein offener Tauschantrag vor.",
        },
        { status: 409 },
      );
    }

    // ── ArbZG compliance pre-check for target employee ──
    if (body.targetId && body.targetShiftId) {
      // Check if taking the requester's shift would violate ArbZG for the target
      const targetConflicts = await checkShiftConflicts({
        employeeId: body.targetId,
        date:
          shift.date instanceof Date
            ? shift.date.toISOString().split("T")[0]
            : new Date(shift.date).toISOString().split("T")[0],
        startTime: shift.startTime,
        endTime: shift.endTime,
        workspaceId,
        excludeShiftId: body.targetShiftId,
      });

      const blockingConflicts = targetConflicts.filter(
        (c) =>
          c.type === "REST_PERIOD" ||
          c.type === "MAX_DAILY_HOURS" ||
          c.type === "MAX_WEEKLY_HOURS",
      );

      if (blockingConflicts.length > 0) {
        return NextResponse.json(
          {
            error:
              "Tausch nicht möglich — ArbZG-Verstoß für den Tauschpartner.",
            conflicts: blockingConflicts,
          },
          { status: 409 },
        );
      }

      // Check if taking the target's shift would violate ArbZG for the requester
      const targetShift = await prisma.shift.findUnique({
        where: { id: body.targetShiftId },
      });

      if (targetShift) {
        const requesterConflicts = await checkShiftConflicts({
          employeeId: body.requesterId,
          date:
            targetShift.date instanceof Date
              ? targetShift.date.toISOString().split("T")[0]
              : new Date(targetShift.date).toISOString().split("T")[0],
          startTime: targetShift.startTime,
          endTime: targetShift.endTime,
          workspaceId,
          excludeShiftId: body.shiftId,
        });

        const requesterBlocking = requesterConflicts.filter(
          (c) =>
            c.type === "REST_PERIOD" ||
            c.type === "MAX_DAILY_HOURS" ||
            c.type === "MAX_WEEKLY_HOURS",
        );

        if (requesterBlocking.length > 0) {
          return NextResponse.json(
            {
              error:
                "Tausch nicht möglich — ArbZG-Verstoß für den Antragsteller.",
              conflicts: requesterBlocking,
            },
            { status: 409 },
          );
        }
      }
    }

    const swap = await prisma.shiftSwapRequest.create({
      data: {
        shiftId: body.shiftId,
        targetShiftId: body.targetShiftId || null,
        requesterId: body.requesterId,
        targetId: body.targetId || null,
        reason: body.reason || null,
        workspaceId,
      },
      include: {
        requester: true,
        target: true,
        shift: { include: { location: true } },
      },
    });

    // ── Automation: Notify managers about new swap request ──
    const requesterName = `${swap.requester.firstName} ${swap.requester.lastName}`;
    const shiftDate =
      swap.shift.date instanceof Date
        ? swap.shift.date.toLocaleDateString("de-DE")
        : new Date(swap.shift.date).toLocaleDateString("de-DE");

    await createSystemNotification({
      type: "SWAP_REQUESTED",
      title: "Neuer Schichttausch-Antrag",
      message: `${requesterName} möchte die Schicht am ${shiftDate} (${swap.shift.startTime}–${swap.shift.endTime}) tauschen.`,
      link: "/schichttausch",
      workspaceId,
      recipientType: "managers",
    });

    return NextResponse.json(swap, { status: 201 });
  } catch (error) {
    log.error("Error creating shift swap:", { error: error });
    return NextResponse.json(
      { error: "Error creating resource" },
      { status: 500 },
    );
  }
}
