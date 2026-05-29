import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, parseJsonBody, badRequest } from "@/lib/api-response";
import { requirePermission } from "@/lib/authorization";
import { withRoute } from "@/lib/with-route";
import { createAuditLog } from "@/lib/audit";
import { svEauSchema, validateBody } from "@/lib/validations";
import {
  requestEau,
  isDatevSandbox as isSvSandbox,
  type EauGatewayResult,
} from "@/lib/sv-gateway";

export const dynamic = "force-dynamic";

/** Map the gateway result to a persisted SvSubmission status. */
function mapEauStatus(s: EauGatewayResult["status"]) {
  switch (s) {
    case "ACCEPTED":
      return "ACCEPTED" as const;
    case "NOT_INSURED":
      return "NOT_INSURED" as const;
    case "NOT_FOUND":
      return "REJECTED" as const;
    default:
      return "ERROR" as const;
  }
}

/**
 * GET /api/compliance/eau — list eAU gateway submissions for the workspace.
 */
export const GET = withRoute("/api/compliance/eau", "GET", async () => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  const forbidden = requirePermission(user, "employees", "read");
  if (forbidden) return forbidden;

  const submissions = await prisma.svSubmission.findMany({
    where: { workspaceId, type: "EAU" },
    orderBy: { submittedAt: "desc" },
    take: 100,
    include: {
      employee: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  return NextResponse.json(submissions);
});

/**
 * POST /api/compliance/eau — request an eAU via the certified gateway.
 * Builds the request payload from the employee's stored SV metadata.
 * Body: { employeeId, sicknessStartDate }
 */
export const POST = withRoute("/api/compliance/eau", "POST", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  const forbidden = requirePermission(user, "employees", "update");
  if (forbidden) return forbidden;

  const _json = await parseJsonBody(req);
  if (!_json.ok) return _json.response;
  const parsed = validateBody(svEauSchema, _json.data);
  if (!parsed.success) return parsed.response;
  const { employeeId, sicknessStartDate } = parsed.data;

  const [employee, workspace] = await Promise.all([
    prisma.employee.findFirst({
      where: { id: employeeId, workspaceId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        socialSecurityNumber: true,
      },
    }),
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { betriebsnummer: true },
    }),
  ]);

  if (!employee) return badRequest("Mitarbeiter nicht gefunden");

  // Structural prerequisites for an eAU lookup.
  const missing: string[] = [];
  if (!employee.dateOfBirth) missing.push("Geburtsdatum");
  if (!workspace?.betriebsnummer) missing.push("Betriebsnummer (Workspace)");
  if (missing.length > 0) {
    return badRequest(
      `Für den eAU-Abruf fehlen folgende Angaben: ${missing.join(", ")}.`,
    );
  }

  const sandbox = isSvSandbox();
  const dob = employee.dateOfBirth!.toLocaleDateString("en-CA");
  // Pass workspaceId so the gateway uses the stored DATEV token when available.
  const result = await requestEau(
    {
      firstName: employee.firstName,
      lastName: employee.lastName,
      dateOfBirth: dob,
      socialSecurityNumber: employee.socialSecurityNumber,
      sicknessStartDate,
      betriebsnummer: workspace!.betriebsnummer!,
    },
    workspaceId,
  );

  const submission = await prisma.svSubmission.create({
    data: {
      workspaceId,
      employeeId,
      type: "EAU",
      status: mapEauStatus(result.status),
      trackingId: result.trackingId ?? null,
      sandbox,
      requestPayload: {
        employeeId,
        sicknessStartDate,
        betriebsnummer: workspace!.betriebsnummer,
      },
      responsePayload: (result.raw as object) ?? null,
      errorCode: result.errorCode ?? null,
      errorMessage: result.errorMessage ?? null,
      auFrom: result.auFrom ? new Date(result.auFrom) : null,
      auTo: result.auTo ? new Date(result.auTo) : null,
      submittedById: user.id,
    },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  createAuditLog({
    action: "CREATE",
    entityType: "SvSubmission",
    entityId: submission.id,
    userId: user.id,
    userEmail: user.email,
    workspaceId,
    changes: { type: "EAU", status: submission.status, sandbox },
  });

  return NextResponse.json(submission, { status: 201 });
});
