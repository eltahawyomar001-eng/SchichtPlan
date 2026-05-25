import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isEmployee, isManagement } from "@/lib/authorization";
import {
  tryAutoApproveAbsence,
  createSystemNotification,
  executeCustomRules,
} from "@/lib/automations";
import { requirePlanFeature } from "@/lib/subscription";
import { dispatchWebhook } from "@/lib/webhooks";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { log } from "@/lib/logger";
import { createAbsenceSchema, validateBody } from "@/lib/validations";
import { captureRouteError } from "@/lib/sentry";
import { requireAuth, serverError, parseJsonBody } from "@/lib/api-response";
import { withRoute } from "@/lib/with-route";
import { classifyAbsenceForWorkspace } from "@/lib/absence-days";

/**
 * Sync VacationBalance used/planned/remaining from actual absence data.
 */
async function syncVacationBalance(
  employeeId: string,
  year: number,
  workspaceId: string,
): Promise<void> {
  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31);

  const absences = await prisma.absenceRequest.findMany({
    where: {
      employeeId,
      workspaceId,
      category: "URLAUB",
      status: { in: ["GENEHMIGT", "AUSSTEHEND"] },
      startDate: { lte: endOfYear },
      endDate: { gte: startOfYear },
      deletedAt: null,
    },
    select: { status: true, totalDays: true },
    take: 500, // hard cap — no employee can have >500 absence requests in a year
  });

  let used = 0;
  let planned = 0;
  for (const a of absences) {
    if (a.status === "GENEHMIGT") used += a.totalDays;
    else if (a.status === "AUSSTEHEND") planned += a.totalDays;
  }
  used = Math.round(used * 10) / 10;
  planned = Math.round(planned * 10) / 10;

  const balance = await prisma.vacationBalance.findUnique({
    where: { employeeId_year: { employeeId, year } },
  });

  if (balance) {
    const remaining =
      Math.round(
        (balance.totalEntitlement + balance.carryOver - used - planned) * 10,
      ) / 10;
    // Optimistic concurrency: increment version to detect concurrent updates
    await prisma.vacationBalance.update({
      where: { id: balance.id, version: balance.version },
      data: { used, planned, remaining, version: { increment: 1 } },
    });
  }
}

// ─── GET  /api/absences ─────────────────────────────────────────
export const GET = withRoute("/api/absences", "GET", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const employeeId = searchParams.get("employeeId");
  const year = searchParams.get("year");

  const where: Record<string, unknown> = { workspaceId };
  if (status) where.status = status;
  if (employeeId) where.employeeId = employeeId;
  if (year) {
    where.startDate = {
      gte: new Date(`${year}-01-01`),
      lte: new Date(`${year}-12-31`),
    };
  }

  // EMPLOYEE can only see their own absences
  if (isEmployee(user) && user.employeeId) {
    where.employeeId = user.employeeId;
  }

  const { take, skip } = parsePagination(req);

  const [absences, total] = await Promise.all([
    prisma.absenceRequest.findMany({
      where,
      include: { employee: true },
      orderBy: { startDate: "desc" },
      take,
      skip,
    }),
    prisma.absenceRequest.count({ where }),
  ]);

  // DSGVO Art. 9: Employees only see their own absences with full detail.
  // For non-management users, mask the category on records belonging to
  // other employees (defensive — employees are already scoped above).
  const sanitised = !isManagement(user)
    ? absences.map((a) => ({
        ...a,
        category: a.employeeId === user.employeeId ? a.category : "ABWESEND",
        reviewNote: a.employeeId === user.employeeId ? a.reviewNote : null,
      }))
    : absences;

  return paginatedResponse(sanitised, total, take, skip);
});

// ─── POST  /api/absences ────────────────────────────────────────
export const POST = withRoute(
  "/api/absences",
  "POST",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    // Check plan feature
    const planGate = await requirePlanFeature(workspaceId, "absenceManagement");
    if (planGate) return planGate;

    const _json = await parseJsonBody(req);
    if (!_json.ok) return _json.response;
    const parsed = validateBody(createAbsenceSchema, _json.data);
    if (!parsed.success) return parsed.response;

    const body = parsed.data;

    // EMPLOYEE can only create absences for themselves
    if (isEmployee(user) && user.employeeId) {
      if (body.employeeId !== user.employeeId) {
        return NextResponse.json(
          { error: "ONLY_OWN_ABSENCES" },
          { status: 403 },
        );
      }
    }

    const start = new Date(body.startDate);
    const end = new Date(body.endDate);
    if (end < start) {
      return NextResponse.json(
        { error: "End date must be after start date" },
        { status: 400 },
      );
    }

    // Validate employee belongs to this workspace before proceeding
    const employeeForBundesland = await prisma.employee.findFirst({
      where: { id: body.employeeId, workspaceId },
      select: { locationId: true },
    });

    if (!employeeForBundesland) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }
    const classification = await classifyAbsenceForWorkspace({
      workspaceId,
      employeeId: body.employeeId,
      locationId: employeeForBundesland?.locationId ?? null,
      startDate: start,
      endDate: end,
      halfDayStart: body.halfDayStart ?? false,
      halfDayEnd: body.halfDayEnd ?? false,
    });
    const totalDays = classification.deductibleDays;

    const absence = await prisma
      .$transaction(async (tx) => {
        // Overlap check — only block when an already-approved request
        // covers the same dates. Pending requests must NOT block new
        // submissions so employees can send multiple requests.
        const overlapping = await tx.absenceRequest.findFirst({
          where: {
            employeeId: body.employeeId,
            workspaceId,
            status: "GENEHMIGT",
            startDate: { lte: end },
            endDate: { gte: start },
          },
        });

        if (overlapping) {
          throw new Error("OVERLAP");
        }

        return tx.absenceRequest.create({
          data: {
            category: body.category,
            startDate: start,
            endDate: end,
            halfDayStart: body.halfDayStart || false,
            halfDayEnd: body.halfDayEnd || false,
            totalDays,
            employeeId: body.employeeId,
            workspaceId,
          },
          include: { employee: true },
        });
      })
      .catch((err) => {
        if (err instanceof Error && err.message === "OVERLAP") {
          return { error: "OVERLAP" as const };
        }
        throw err;
      });

    if ("error" in absence) {
      return NextResponse.json(
        {
          error:
            "Für diesen Zeitraum existiert bereits ein genehmigter Abwesenheitsantrag.",
        },
        { status: 409 },
      );
    }

    // ── Automation: Try auto-approve (sick leave only) ──
    const autoApproved = await tryAutoApproveAbsence(absence.id);

    // ── Automation: Notify managers about new request ──
    if (!autoApproved) {
      const empName = `${absence.employee.firstName} ${absence.employee.lastName}`;
      await createSystemNotification({
        type: "ABSENCE_REQUESTED",
        title: "Neuer Abwesenheitsantrag",
        message: `${empName} hat einen Abwesenheitsantrag (${body.category}) vom ${start.toLocaleDateString("de-DE")} bis ${end.toLocaleDateString("de-DE")} eingereicht.`,
        link: "/abwesenheiten",
        workspaceId,
        recipientType: "managers",
      });
    } else {
      // Notify employee that it was auto-approved
      if (absence.employee.email) {
        await createSystemNotification({
          type: "ABSENCE_AUTO_APPROVED",
          title: "Abwesenheit automatisch genehmigt",
          message: `Ihr Abwesenheitsantrag (${body.category}) wurde automatisch genehmigt.`,
          link: "/abwesenheiten",
          workspaceId,
          recipientType: "employee",
          employeeEmail: absence.employee.email,
        });
      }
    }

    // ── Automation: Execute custom rules ──
    executeCustomRules("absence.created", workspaceId, {
      id: absence.id,
      employeeId: absence.employeeId,
      employeeEmail: absence.employee.email || "",
      category: absence.category,
      startDate: body.startDate,
      endDate: body.endDate,
      totalDays,
      halfDayStart: body.halfDayStart || false,
      halfDayEnd: body.halfDayEnd || false,
      autoApproved,
    });

    // Re-fetch to get updated status if auto-approved
    const result = autoApproved
      ? await prisma.absenceRequest.findUnique({
          where: { id: absence.id },
          include: { employee: true },
        })
      : absence;

    // ── Sync VacationBalance for URLAUB absences ──
    if (body.category === "URLAUB") {
      syncVacationBalance(
        absence.employeeId,
        start.getFullYear(),
        workspaceId,
      ).catch((err) =>
        log.error("VacationBalance sync failed", { error: err }),
      );
    }

    // ── Webhook dispatch (fire & forget) ──
    dispatchWebhook(workspaceId, "absence.created", {
      id: absence.id,
      employeeId: absence.employeeId,
      category: body.category,
      startDate: body.startDate,
      endDate: body.endDate,
      autoApproved,
    }).catch((err) =>
      log.error("[webhook] absence.created dispatch error", { error: err }),
    );

    return NextResponse.json({ ...result, autoApproved }, { status: 201 });
  },
  { idempotent: true },
);
