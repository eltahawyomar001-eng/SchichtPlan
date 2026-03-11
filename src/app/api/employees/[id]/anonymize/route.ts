import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requireAdmin } from "@/lib/authorization";
import { createAuditLog } from "@/lib/audit";
import { log } from "@/lib/logger";

/**
 * POST /api/employees/[id]/anonymize
 *
 * DSGVO Art. 17(3)(b) — Anonymisierung ehemaliger Mitarbeiter.
 *
 * Replaces all PII (name, email, phone) with placeholder values
 * while preserving statistical data (shifts, hours, time entries)
 * for legitimate business-interest retention (HGB § 257, AO § 147).
 *
 * Requirements:
 *   – OWNER or ADMIN only
 *   – Employee must be inactive (isActive === false)
 *   – Cannot anonymize an employee linked to an active User account
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    if (!user.workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    // Only OWNER/ADMIN may anonymize
    const forbidden = requireAdmin(user);
    if (forbidden) return forbidden;

    const { id } = await params;

    // Fetch employee in this workspace
    const employee = await prisma.employee.findFirst({
      where: { id, workspaceId: user.workspaceId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        isActive: true,
        userId: true,
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }

    // Guard: must be deactivated first
    if (employee.isActive) {
      return NextResponse.json(
        {
          error:
            "Employee must be deactivated (isActive = false) before anonymization.",
        },
        { status: 400 },
      );
    }

    // Guard: must not be linked to an active user account
    if (employee.userId) {
      return NextResponse.json(
        {
          error:
            "Employee is still linked to a user account. Unlink the user first.",
        },
        { status: 400 },
      );
    }

    // Check if already anonymised
    if (employee.firstName === "ANONYMISIERT") {
      return NextResponse.json(
        { error: "Employee is already anonymized." },
        { status: 409 },
      );
    }

    const anonymizedId = employee.id.slice(-6).toUpperCase();

    // Perform anonymization
    await prisma.employee.update({
      where: { id: employee.id },
      data: {
        firstName: "ANONYMISIERT",
        lastName: `#${anonymizedId}`,
        email: null,
        phone: null,
        position: null,
        color: null,
      },
    });

    // Audit log
    createAuditLog({
      action: "UPDATE",
      entityType: "employee",
      entityId: employee.id,
      userId: user.id,
      userEmail: user.email ?? undefined,
      workspaceId: user.workspaceId!,
      changes: {
        action: "ANONYMIZE",
        previousFirstName: employee.firstName,
        previousLastName: employee.lastName,
        previousEmail: employee.email,
      },
      metadata: {
        reason: "DSGVO Art. 17 — Recht auf Löschung / Anonymisierung",
      },
    });

    log.info("Employee anonymized", {
      employeeId: employee.id,
      workspaceId: user.workspaceId,
      performedBy: user.email,
    });

    return NextResponse.json({
      message: "Employee successfully anonymized",
      id: employee.id,
      firstName: "ANONYMISIERT",
      lastName: `#${anonymizedId}`,
    });
  } catch (error) {
    log.error("Error anonymizing employee:", { error });
    return NextResponse.json(
      { error: "Error anonymizing employee" },
      { status: 500 },
    );
  }
}
