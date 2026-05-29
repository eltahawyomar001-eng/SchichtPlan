import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, parseJsonBody, badRequest } from "@/lib/api-response";
import { requirePermission } from "@/lib/authorization";
import { withRoute } from "@/lib/with-route";
import { createAuditLog } from "@/lib/audit";
import { svSofortmeldungSchema, validateBody } from "@/lib/validations";
import {
  submitSofortmeldung,
  buildSofortmeldungPayload,
  isDatevSandbox as isSvSandbox,
} from "@/lib/sv-gateway";

export const dynamic = "force-dynamic";

/**
 * GET /api/compliance/sofortmeldung — list Sofortmeldung submissions.
 */
export const GET = withRoute(
  "/api/compliance/sofortmeldung",
  "GET",
  async () => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "employees", "read");
    if (forbidden) return forbidden;

    const submissions = await prisma.svSubmission.findMany({
      where: { workspaceId, type: "SOFORTMELDUNG" },
      orderBy: { submittedAt: "desc" },
      take: 100,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    return NextResponse.json(submissions);
  },
);

/**
 * POST /api/compliance/sofortmeldung — submit a Sofortmeldung (Meldegrund 20)
 * via the certified gateway, BEFORE the employee starts their first shift.
 * Builds the payload from the employee's stored SV metadata.
 * Body: { employeeId, employmentStartDate? }
 */
export const POST = withRoute(
  "/api/compliance/sofortmeldung",
  "POST",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "employees", "update");
    if (forbidden) return forbidden;

    const _json = await parseJsonBody(req);
    if (!_json.ok) return _json.response;
    const parsed = validateBody(svSofortmeldungSchema, _json.data);
    if (!parsed.success) return parsed.response;
    const { employeeId, employmentStartDate } = parsed.data;

    const [employee, workspace] = await Promise.all([
      prisma.employee.findFirst({
        where: { id: employeeId, workspaceId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          dateOfBirth: true,
          socialSecurityNumber: true,
          birthPlace: true,
          nationality: true,
          employmentStartDate: true,
        },
      }),
      prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { betriebsnummer: true },
      }),
    ]);

    if (!employee) return badRequest("Mitarbeiter nicht gefunden");

    const entryDate =
      employmentStartDate ||
      (employee.employmentStartDate
        ? employee.employmentStartDate.toLocaleDateString("en-CA")
        : null);

    // Structural prerequisites for a Sofortmeldung.
    const missing: string[] = [];
    if (!employee.dateOfBirth) missing.push("Geburtsdatum");
    if (!workspace?.betriebsnummer) missing.push("Betriebsnummer (Workspace)");
    if (!entryDate) missing.push("Eintrittsdatum");
    if (
      !employee.socialSecurityNumber &&
      (!employee.birthPlace || !employee.nationality)
    ) {
      missing.push("Versicherungsnummer oder Geburtsort + Staatsangehörigkeit");
    }
    if (missing.length > 0) {
      return badRequest(
        `Für die Sofortmeldung fehlen folgende Angaben: ${missing.join(", ")}.`,
      );
    }

    const sandbox = isSvSandbox();
    const dob = employee.dateOfBirth!.toLocaleDateString("en-CA");
    const input = {
      firstName: employee.firstName,
      lastName: employee.lastName,
      dateOfBirth: dob,
      socialSecurityNumber: employee.socialSecurityNumber,
      birthPlace: employee.birthPlace,
      nationality: employee.nationality,
      betriebsnummer: workspace!.betriebsnummer!,
      employmentStartDate: entryDate!,
    };

    const result = await submitSofortmeldung(input, workspaceId);

    const submission = await prisma.svSubmission.create({
      data: {
        workspaceId,
        employeeId,
        type: "SOFORTMELDUNG",
        meldegrund: "20",
        status: result.status,
        trackingId: result.trackingId ?? null,
        sandbox,
        requestPayload: buildSofortmeldungPayload(input) as object,
        responsePayload: (result.raw as object) ?? null,
        errorCode: result.errorCode ?? null,
        errorMessage: result.errorMessage ?? null,
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
      changes: { type: "SOFORTMELDUNG", status: submission.status, sandbox },
    });

    return NextResponse.json(submission, { status: 201 });
  },
);
