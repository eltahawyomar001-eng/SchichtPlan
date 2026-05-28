import { NextResponse } from "next/server";
import { requireAuth, serverError } from "@/lib/api-response";
import { requirePermission } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { captureRouteError } from "@/lib/sentry";

export const dynamic = "force-dynamic";

/**
 * GET /api/compliance/34a?locationId=&from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Returns a §34a compliance report for a location + date range:
 * - Required certifications for the location
 * - Each guard who worked there (shifts)
 * - For each guard: which required certs they hold, which are missing/expired
 * - Overall compliance status
 */
export async function GET(req: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "shifts", "read");
    if (forbidden) return forbidden;

    const { searchParams } = new URL(req.url);
    const locationId = searchParams.get("locationId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (!locationId || !from || !to) {
      return NextResponse.json(
        { error: "locationId, from, and to are required" },
        { status: 400 },
      );
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid date range" },
        { status: 400 },
      );
    }

    // Load location + required skills
    const location = await prisma.location.findFirst({
      where: { id: locationId, workspaceId },
      select: {
        id: true,
        name: true,
        address: true,
        requiredSkills: {
          select: {
            skillId: true,
            skill: { select: { id: true, name: true, category: true } },
          },
        },
      },
    });

    if (!location) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 },
      );
    }

    // Load all shifts at this location in the date range (assigned only)
    const shifts = await prisma.shift.findMany({
      where: {
        workspaceId,
        locationId,
        date: { gte: fromDate, lte: toDate },
        employeeId: { not: null },
        deletedAt: null,
      },
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        status: true,
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            employeeSkills: {
              select: {
                skillId: true,
                expiresAt: true,
                certificateNumber: true,
                issuingAuthority: true,
                documentUrl: true,
                skill: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    const requiredSkills = location.requiredSkills;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Build per-guard summary (deduped by employeeId)
    const guardMap = new Map<
      string,
      {
        employeeId: string;
        name: string;
        email: string | null;
        shiftCount: number;
        certStatus: {
          skillId: string;
          skillName: string;
          status: "VALID" | "EXPIRED" | "MISSING";
          expiresAt: Date | null;
          certificateNumber: string | null;
          issuingAuthority: string | null;
          hasDocument: boolean;
        }[];
        compliant: boolean;
        documentationComplete: boolean;
      }
    >();

    for (const shift of shifts) {
      if (!shift.employee) continue;
      const emp = shift.employee;
      if (!guardMap.has(emp.id)) {
        const empSkillMap = new Map(
          emp.employeeSkills.map((es) => [
            es.skillId,
            {
              expiresAt: es.expiresAt,
              name: es.skill.name,
              certificateNumber: es.certificateNumber,
              issuingAuthority: es.issuingAuthority,
              documentUrl: es.documentUrl,
            },
          ]),
        );

        const certStatus = requiredSkills.map((req) => {
          const held = empSkillMap.get(req.skillId);
          if (!held) {
            return {
              skillId: req.skillId,
              skillName: req.skill.name,
              status: "MISSING" as const,
              expiresAt: null,
              certificateNumber: null,
              issuingAuthority: null,
              hasDocument: false,
            };
          }
          const expired = held.expiresAt && new Date(held.expiresAt) < today;
          return {
            skillId: req.skillId,
            skillName: req.skill.name,
            status: expired ? ("EXPIRED" as const) : ("VALID" as const),
            expiresAt: held.expiresAt ?? null,
            certificateNumber: held.certificateNumber ?? null,
            issuingAuthority: held.issuingAuthority ?? null,
            hasDocument: !!held.documentUrl,
          };
        });

        const compliant = certStatus.every((c) => c.status === "VALID");
        // Documentation is complete only when every valid cert also has the
        // scanned document on file (the audit-proof artifact).
        const documentationComplete = certStatus.every(
          (c) => c.status !== "MISSING" && c.hasDocument,
        );
        guardMap.set(emp.id, {
          employeeId: emp.id,
          name: `${emp.firstName} ${emp.lastName}`,
          email: emp.email,
          shiftCount: 0,
          certStatus,
          compliant,
          documentationComplete,
        });
      }
      guardMap.get(emp.id)!.shiftCount++;
    }

    const guards = [...guardMap.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    );

    const totalShifts = shifts.length;
    const compliantGuards = guards.filter((g) => g.compliant).length;
    const nonCompliantGuards = guards.filter((g) => !g.compliant).length;
    const overallCompliant = nonCompliantGuards === 0;
    // Guards who are cert-valid but missing the scanned proof on file.
    const guardsMissingDocuments = guards.filter(
      (g) => g.compliant && !g.documentationComplete,
    ).length;

    return NextResponse.json({
      location: {
        id: location.id,
        name: location.name,
        address: location.address,
      },
      period: { from, to },
      requiredSkills: requiredSkills.map((rs) => ({
        skillId: rs.skillId,
        skillName: rs.skill.name,
        category: rs.skill.category,
      })),
      summary: {
        totalShifts,
        totalGuards: guards.length,
        compliantGuards,
        nonCompliantGuards,
        overallCompliant,
        guardsMissingDocuments,
      },
      guards,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    captureRouteError(error, { route: "/api/compliance/34a", method: "GET" });
    return serverError("Fehler beim Erstellen des §34a-Berichts");
  }
}
