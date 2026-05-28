import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export interface CertViolation {
  skillId: string;
  skillName: string;
  reason: "MISSING" | "EXPIRED";
  expiredAt?: Date;
}

/**
 * Check whether an employee holds all required certifications for a location.
 * Returns an empty array when the employee is cleared to work at that location.
 */
export async function checkLocationCertifications(
  employeeId: string,
  locationId: string,
): Promise<CertViolation[]> {
  const [requiredSkills, employeeSkills] = await Promise.all([
    prisma.locationRequiredSkill.findMany({
      where: { locationId },
      select: {
        skillId: true,
        skill: { select: { name: true } },
      },
    }),
    prisma.employeeSkill.findMany({
      where: { employeeId },
      select: { skillId: true, expiresAt: true },
    }),
  ]);

  if (requiredSkills.length === 0) return [];

  const empSkillMap = new Map(
    employeeSkills.map((es) => [es.skillId, es.expiresAt]),
  );
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const violations: CertViolation[] = [];
  for (const req of requiredSkills) {
    if (!empSkillMap.has(req.skillId)) {
      violations.push({
        skillId: req.skillId,
        skillName: req.skill.name,
        reason: "MISSING",
      });
      continue;
    }
    const expiresAt = empSkillMap.get(req.skillId) ?? null;
    if (expiresAt && new Date(expiresAt) < today) {
      violations.push({
        skillId: req.skillId,
        skillName: req.skill.name,
        reason: "EXPIRED",
        expiredAt: new Date(expiresAt),
      });
    }
  }
  return violations;
}

/**
 * Returns a 422 NextResponse if the employee lacks any required certification
 * for the location, or null if the guard is cleared to work there.
 */
export async function requireLocationCertifications(
  employeeId: string | null | undefined,
  locationId: string | null | undefined,
): Promise<NextResponse | null> {
  if (!employeeId || !locationId) return null;

  const violations = await checkLocationCertifications(employeeId, locationId);
  if (violations.length === 0) return null;

  const missing = violations
    .filter((v) => v.reason === "MISSING")
    .map((v) => v.skillName);
  const expired = violations
    .filter((v) => v.reason === "EXPIRED")
    .map((v) => v.skillName);

  const parts: string[] = [];
  if (missing.length > 0)
    parts.push(`fehlende Zertifikate: ${missing.join(", ")}`);
  if (expired.length > 0)
    parts.push(`abgelaufene Zertifikate: ${expired.join(", ")}`);

  return NextResponse.json(
    {
      error: "CERTIFICATION_REQUIRED",
      message: `Mitarbeiter darf nicht an diesem Standort eingeplant werden — ${parts.join("; ")}.`,
      violations,
    },
    { status: 422 },
  );
}
