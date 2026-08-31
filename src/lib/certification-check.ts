import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * §34a GewO certification gate.
 *
 * Two modes, chosen per workspace:
 *
 *  - LEGACY (securitySectorMode = false): a certification is required only
 *    where an explicit LocationRequiredSkill row says so. A location with no
 *    configured requirements is unguarded. This is the historical behaviour
 *    and remains the default so existing non-security workspaces are
 *    unaffected.
 *
 *  - ZOLL-SHIELD (securitySectorMode = true): the default INVERTS. Every
 *    assigned shift requires a valid §34a qualification and a cleared
 *    Bewacherregister entry, whether or not the object has LocationRequiredSkill
 *    rows, unless that object is explicitly marked certificationExempt.
 *
 * The inversion matters because the old shape made the guarantee depend on
 * customer configuration: forget to add a required-skill row and enforcement
 * silently vanished. Under Zoll-Shield, forgetting to configure something
 * fails closed instead of open.
 */

export type CertViolationReason =
  | "MISSING"
  | "EXPIRED"
  | "NO_34A_QUALIFICATION"
  | "BEWACHER_ID_MISSING"
  | "BEWACHER_NOT_CLEARED";

export interface CertViolation {
  /** Present for skill-derived violations; absent for register-level ones. */
  skillId?: string;
  skillName?: string;
  reason: CertViolationReason;
  expiredAt?: Date;
  /** Bewacherregister status when the violation is register-level. */
  registerStatus?: string;
}

/**
 * Name fragments that identify a §34a qualification.
 *
 * Skills are workspace-authored free text, so this is a heuristic. It is only
 * used to decide whether an employee already holds SOME §34a qualification in
 * Zoll-Shield mode; explicit LocationRequiredSkill rows are always matched by
 * id and never by name.
 */
const SACHKUNDE_34A_PATTERNS = [
  "34a",
  "§34a",
  "sachkunde",
  "unterrichtung",
  "bewacher",
];

function is34aSkill(name: string): boolean {
  const n = name.toLowerCase();
  return SACHKUNDE_34A_PATTERNS.some((p) => n.includes(p));
}

/** Register statuses that permit deployment. Only a completed check counts. */
const CLEARED_REGISTER_STATUSES = new Set(["GEPRUEFT"]);

/**
 * Check whether an employee is cleared to work a shift at a location.
 *
 * Returns an empty array when the employee may be deployed.
 */
export async function checkLocationCertifications(
  employeeId: string,
  locationId: string | null | undefined,
  workspaceId?: string,
): Promise<CertViolation[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [requiredSkills, employee, location, workspace] = await Promise.all([
    locationId
      ? prisma.locationRequiredSkill.findMany({
          where: { locationId },
          select: { skillId: true, skill: { select: { name: true } } },
        })
      : Promise.resolve([]),
    prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        workspaceId: true,
        bewacherId: true,
        bewacherRegisterStatus: true,
        employeeSkills: {
          select: {
            skillId: true,
            expiresAt: true,
            skill: { select: { name: true } },
          },
        },
      },
    }),
    locationId
      ? prisma.location.findUnique({
          where: { id: locationId },
          select: { certificationExempt: true },
        })
      : Promise.resolve(null),
    // Resolve the workspace from the caller when given, otherwise from the
    // employee — auto-fill and SOS call this without a workspace in hand.
    workspaceId
      ? prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: { securitySectorMode: true },
        })
      : Promise.resolve(null),
  ]);

  if (!employee) return [];

  let securitySectorMode = workspace?.securitySectorMode ?? null;
  if (securitySectorMode === null) {
    const ws = await prisma.workspace.findUnique({
      where: { id: employee.workspaceId },
      select: { securitySectorMode: true },
    });
    securitySectorMode = ws?.securitySectorMode ?? false;
  }

  const heldSkills = employee.employeeSkills;
  const heldById = new Map(heldSkills.map((es) => [es.skillId, es]));

  const violations: CertViolation[] = [];

  // ── 1. Explicit per-location requirements (both modes) ──
  for (const req of requiredSkills) {
    const held = heldById.get(req.skillId);
    if (!held) {
      violations.push({
        skillId: req.skillId,
        skillName: req.skill.name,
        reason: "MISSING",
      });
      continue;
    }
    if (held.expiresAt && new Date(held.expiresAt) < today) {
      violations.push({
        skillId: req.skillId,
        skillName: req.skill.name,
        reason: "EXPIRED",
        expiredAt: new Date(held.expiresAt),
      });
    }
  }

  // ── 2. Zoll-Shield implicit §34a requirement ──
  // Applies to every assigned shift, including objects with no configured
  // required skills. An explicitly exempt object opts out.
  if (securitySectorMode && !location?.certificationExempt) {
    const valid34a = heldSkills.filter(
      (es) =>
        is34aSkill(es.skill.name) &&
        (!es.expiresAt || new Date(es.expiresAt) >= today),
    );
    const expired34a = heldSkills.filter(
      (es) =>
        is34aSkill(es.skill.name) &&
        es.expiresAt &&
        new Date(es.expiresAt) < today,
    );

    if (valid34a.length === 0) {
      // Only report the implicit violation when the explicit pass has not
      // already flagged the same underlying gap, so the dispatcher sees one
      // reason per real problem rather than two spellings of it.
      const alreadyFlagged = violations.some(
        (v) => v.skillName && is34aSkill(v.skillName),
      );
      if (!alreadyFlagged) {
        if (expired34a.length > 0) {
          const worst = expired34a[0];
          violations.push({
            skillId: worst.skillId,
            skillName: worst.skill.name,
            reason: "EXPIRED",
            expiredAt: new Date(worst.expiresAt!),
          });
        } else {
          violations.push({ reason: "NO_34A_QUALIFICATION" });
        }
      }
    }

    // ── 3. Bewacherregister (§11b GewO) ──
    // Holding the certificate is not enough: the guard must also be entered in
    // the register and the Zuverlässigkeitsüberprüfung must have passed.
    if (!employee.bewacherId) {
      violations.push({ reason: "BEWACHER_ID_MISSING" });
    } else if (
      !employee.bewacherRegisterStatus ||
      !CLEARED_REGISTER_STATUSES.has(employee.bewacherRegisterStatus)
    ) {
      violations.push({
        reason: "BEWACHER_NOT_CLEARED",
        registerStatus: employee.bewacherRegisterStatus ?? "UNBEKANNT",
      });
    }
  }

  return violations;
}

/** Human-readable German summary of a violation set, for API error messages. */
export function describeCertViolations(violations: CertViolation[]): string {
  const parts: string[] = [];

  const missing = violations
    .filter((v) => v.reason === "MISSING")
    .map((v) => v.skillName)
    .filter(Boolean);
  const expired = violations
    .filter((v) => v.reason === "EXPIRED")
    .map((v) => v.skillName)
    .filter(Boolean);

  if (missing.length > 0)
    parts.push(`fehlende Zertifikate: ${missing.join(", ")}`);
  if (expired.length > 0)
    parts.push(`abgelaufene Zertifikate: ${expired.join(", ")}`);
  if (violations.some((v) => v.reason === "NO_34A_QUALIFICATION"))
    parts.push("keine gültige §34a-Sachkunde bzw. -Unterrichtung hinterlegt");
  if (violations.some((v) => v.reason === "BEWACHER_ID_MISSING"))
    parts.push("keine Bewacher-ID im Bewacherregister hinterlegt");

  const notCleared = violations.find(
    (v) => v.reason === "BEWACHER_NOT_CLEARED",
  );
  if (notCleared)
    parts.push(
      `Bewacherregister-Status ist "${notCleared.registerStatus}" statt "GEPRUEFT"`,
    );

  return parts.join("; ");
}

/**
 * Returns a 422 NextResponse if the employee may not be deployed, or null if
 * they are cleared.
 *
 * Kept as the route-level convenience wrapper around
 * `checkLocationCertifications`. New call sites should prefer
 * `assertShiftCompliance` in `@/lib/compliance-gate`, which runs this check
 * alongside ArbZG §3/§4/§5 and supports audited overrides.
 */
export async function requireLocationCertifications(
  employeeId: string | null | undefined,
  locationId: string | null | undefined,
  workspaceId?: string,
): Promise<NextResponse | null> {
  // Zoll-Shield mode still needs the §34a and register checks on an unassigned
  // location, so only a missing EMPLOYEE short-circuits here.
  if (!employeeId) return null;

  const violations = await checkLocationCertifications(
    employeeId,
    locationId,
    workspaceId,
  );
  if (violations.length === 0) return null;

  return NextResponse.json(
    {
      error: "CERTIFICATION_REQUIRED",
      message: `Mitarbeiter darf nicht an diesem Standort eingeplant werden — ${describeCertViolations(violations)}.`,
      violations,
    },
    { status: 422 },
  );
}
