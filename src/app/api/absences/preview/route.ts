import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth, parseJsonBody } from "@/lib/api-response";
import { withRoute } from "@/lib/with-route";
import { isEmployee } from "@/lib/authorization";
import { validateBody } from "@/lib/validations";
import { classifyAbsenceForWorkspace } from "@/lib/absence-days";

const previewSchema = z.object({
  employeeId: z.string().cuid(),
  startDate: z.string().datetime().or(z.string().date()),
  endDate: z.string().datetime().or(z.string().date()),
  halfDayStart: z.boolean().optional(),
  halfDayEnd: z.boolean().optional(),
});

/**
 * POST /api/absences/preview
 *
 * Stateless dry-run of the holiday-aware day classification. The client
 * calls this whenever the absence date range changes so the form can
 * show the user exactly which days will be deducted (and which won't
 * because they are statutory holidays or weekends) before they submit.
 *
 * Server is authoritative — the live submission re-runs the same helper.
 */
export const POST = withRoute("/api/absences/preview", "POST", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  const _json = await parseJsonBody(req);
  if (!_json.ok) return _json.response;
  const parsed = validateBody(previewSchema, _json.data);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;

  if (isEmployee(user) && user.employeeId !== body.employeeId) {
    return NextResponse.json(
      {
        error: "FORBIDDEN_EMPLOYEE",
        message: "Vorschau nur für eigene Abwesenheiten.",
      },
      { status: 403 },
    );
  }

  const start = new Date(body.startDate);
  const end = new Date(body.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json(
      { error: "INVALID_DATE", message: "Ungültiges Datum." },
      { status: 400 },
    );
  }
  if (end < start) {
    return NextResponse.json(
      {
        error: "INVALID_RANGE",
        message: "Enddatum muss nach Startdatum liegen.",
      },
      { status: 400 },
    );
  }

  const emp = await prisma.employee.findFirst({
    where: { id: body.employeeId, workspaceId },
    select: { id: true, locationId: true },
  });
  if (!emp) {
    return NextResponse.json(
      {
        error: "EMPLOYEE_NOT_FOUND",
        message: "Mitarbeiter nicht gefunden.",
      },
      { status: 404 },
    );
  }

  const classification = await classifyAbsenceForWorkspace({
    workspaceId,
    employeeId: emp.id,
    locationId: emp.locationId,
    startDate: start,
    endDate: end,
    halfDayStart: body.halfDayStart ?? false,
    halfDayEnd: body.halfDayEnd ?? false,
  });

  return NextResponse.json(classification);
});
