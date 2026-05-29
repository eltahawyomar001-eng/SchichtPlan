import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { createEauRequestSchema, validateBody } from "@/lib/validations";
import { withRoute } from "@/lib/with-route";
import { requireAuth, parseJsonBody, badRequest } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import { getEauProvider, resultToStatus } from "@/lib/eau";
import { requestEau } from "@/lib/sv-gateway";
import { getDatevAccessToken } from "@/lib/datev-oidc";

/**
 * GET /api/eau?employeeId=&absenceRequestId=
 * List eAU requests for the workspace, optionally scoped.
 */
export const GET = withRoute("/api/eau", "GET", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  const forbidden = requirePermission(user, "absences", "read");
  if (forbidden) return forbidden;

  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get("employeeId");
  const absenceRequestId = searchParams.get("absenceRequestId");

  const records = await prisma.eauRequest.findMany({
    where: {
      workspaceId,
      ...(employeeId ? { employeeId } : {}),
      ...(absenceRequestId ? { absenceRequestId } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  return NextResponse.json(records);
});

/**
 * POST /api/eau
 * Trigger an eAU retrieval for an employee + incapacity date.
 *
 * Priority:
 *  1. DATEV hr:eau — used automatically when the workspace has a valid DATEV
 *     token AND the employee has a datevPersonnelNumber AND the workspace has
 *     datevConsultantNumber + datevClientNumber set.
 *  2. HTTP gateway — when EAU_GATEWAY_URL is configured.
 *  3. Manual — record created in MANUAL state for employer to fill in.
 *
 * Body: { employeeId, incapacityDate, isInitial?, absenceRequestId?, insuranceNumber?, krankenkasseIk? }
 */
export const POST = withRoute(
  "/api/eau",
  "POST",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "absences", "update");
    if (forbidden) return forbidden;

    const _json = await parseJsonBody(req);
    if (!_json.ok) return _json.response;
    const parsed = validateBody(createEauRequestSchema, _json.data);
    if (!parsed.success) return parsed.response;
    const { employeeId, absenceRequestId, incapacityDate, isInitial } =
      parsed.data;

    const [employee, workspace, datevToken] = await Promise.all([
      prisma.employee.findFirst({
        where: { id: employeeId, workspaceId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          datevPersonnelNumber: true,
        },
      }),
      prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: {
          datevConsultantNumber: true,
          datevClientNumber: true,
        },
      }),
      getDatevAccessToken(workspaceId),
    ]);

    if (!employee) return badRequest("Mitarbeiter nicht gefunden");

    // ── DATEV path ───────────────────────────────────────────────
    const datevReady =
      datevToken &&
      workspace?.datevConsultantNumber &&
      workspace?.datevClientNumber &&
      employee.datevPersonnelNumber;

    if (datevReady) {
      const gatewayResult = await requestEau(
        {
          consultantNumber: workspace!.datevConsultantNumber!,
          clientNumber: workspace!.datevClientNumber!,
          personnelNumber: employee.datevPersonnelNumber!,
          sicknessStartDate: incapacityDate,
          source: "LODAS",
        },
        workspaceId,
      );

      const status =
        gatewayResult.status === "ACCEPTED"
          ? "RETRIEVED"
          : gatewayResult.status === "NOT_INSURED" ||
              gatewayResult.status === "NOT_FOUND"
            ? "NOT_FOUND"
            : "ERROR";

      const record = await prisma.eauRequest.create({
        data: {
          workspaceId,
          employeeId,
          absenceRequestId: absenceRequestId || null,
          status,
          provider: "datev",
          auFrom: gatewayResult.auFrom ? new Date(gatewayResult.auFrom) : null,
          auTo: gatewayResult.auTo ? new Date(gatewayResult.auTo) : null,
          isInitial: gatewayResult.isInitial ?? isInitial ?? null,
          reference: gatewayResult.trackingId ?? null,
          message: gatewayResult.errorMessage ?? null,
          requestedById: user.id,
          retrievedAt: status === "RETRIEVED" ? new Date() : null,
        },
        include: {
          employee: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      createAuditLog({
        action: "CREATE",
        entityType: "EauRequest",
        entityId: record.id,
        userId: user.id,
        userEmail: user.email,
        workspaceId,
        changes: { employeeId, incapacityDate, status, provider: "datev" },
      });

      return NextResponse.json(record, { status: 201 });
    }

    // ── Fallback: HTTP gateway or manual ─────────────────────────
    const provider = getEauProvider();
    const result = await provider.query({
      employee: { firstName: employee.firstName, lastName: employee.lastName },
      insuranceNumber: parsed.data.insuranceNumber || null,
      krankenkasseIk: parsed.data.krankenkasseIk || null,
      incapacityDate,
      isInitial,
    });

    const status =
      result.status === "NOT_CONFIGURED"
        ? "MANUAL"
        : resultToStatus(result.status);
    const retrieved = result.status === "RETRIEVED";

    const record = await prisma.eauRequest.create({
      data: {
        workspaceId,
        employeeId,
        absenceRequestId: absenceRequestId || null,
        status,
        provider: provider.name,
        auFrom: result.auFrom ? new Date(result.auFrom) : null,
        auTo: result.auTo ? new Date(result.auTo) : null,
        isInitial: result.isInitial ?? isInitial ?? null,
        issuedDate: result.issuedDate ? new Date(result.issuedDate) : null,
        krankenkasse: result.krankenkasse ?? null,
        reference: result.reference ?? null,
        message: result.message ?? null,
        requestedById: user.id,
        retrievedAt: retrieved ? new Date() : null,
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    createAuditLog({
      action: "CREATE",
      entityType: "EauRequest",
      entityId: record.id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: { employeeId, incapacityDate, status, provider: provider.name },
    });

    return NextResponse.json(record, { status: 201 });
  },
  { idempotent: true },
);
