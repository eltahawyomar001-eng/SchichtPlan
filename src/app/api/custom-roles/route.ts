import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/authorization";
import { requirePlanFeature } from "@/lib/subscription";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { validateBody } from "@/lib/validations";

/**
 * Custom Roles CRUD.
 *
 * Gated behind the `customRoles` plan feature (Business+ tier).
 *
 * Each role has a baseRole (OWNER/ADMIN/MANAGER/EMPLOYEE) that defines its
 * permission floor, plus an explicit allow-list of fine-grained permissions
 * (e.g. ["shifts.create", "employees.read"]).
 */

/* ── Built-in roles (read-only, always returned alongside custom ones) ── */
const BUILT_IN_ROLES = [
  {
    id: "owner",
    name: "Inhaber",
    nameEn: "Owner",
    builtIn: true,
    baseRole: "OWNER",
    permissions: [
      "employees.*",
      "shifts.*",
      "locations.*",
      "absences.*",
      "time-entries.*",
      "settings.*",
      "billing.*",
      "team.*",
      "reports.*",
    ],
    description:
      "Vollzugriff – kann Abrechnung, Teammitglieder und alle Daten verwalten.",
    descriptionEn:
      "Full access – can manage billing, team members, and all data.",
  },
  {
    id: "admin",
    name: "Administrator",
    nameEn: "Admin",
    builtIn: true,
    baseRole: "ADMIN",
    permissions: [
      "employees.*",
      "shifts.*",
      "locations.*",
      "absences.*",
      "time-entries.*",
      "settings.read",
      "reports.*",
    ],
    description:
      "Kann Mitarbeiter, Schichten und Standorte verwalten. Kein Zugriff auf Abrechnung.",
    descriptionEn:
      "Can manage employees, shifts, and locations. No access to billing.",
  },
  {
    id: "manager",
    name: "Manager",
    nameEn: "Manager",
    builtIn: true,
    baseRole: "MANAGER",
    permissions: [
      "shifts.*",
      "employees.read",
      "absences.approve",
      "time-entries.approve",
      "reports.read",
    ],
    description:
      "Kann Schichten verwalten sowie Abwesenheiten und Zeiteinträge genehmigen.",
    descriptionEn: "Can manage shifts and approve absences and time entries.",
  },
  {
    id: "employee",
    name: "Mitarbeiter",
    nameEn: "Employee",
    builtIn: true,
    baseRole: "EMPLOYEE",
    permissions: [
      "shifts.read",
      "absences.create",
      "time-entries.create",
      "availability.manage",
    ],
    description:
      "Kann eigene Schichten einsehen, Abwesenheiten einreichen und die Stempeluhr nutzen.",
    descriptionEn: "Can view own shifts, submit absences, and use time clock.",
  },
];

const VALID_BASE_ROLES = ["OWNER", "ADMIN", "MANAGER", "EMPLOYEE"] as const;

const createCustomRoleSchema = z.object({
  name: z.string().min(2).max(50),
  nameEn: z.string().max(50).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  descriptionEn: z.string().max(500).optional().nullable(),
  baseRole: z.enum(VALID_BASE_ROLES).default("EMPLOYEE"),
  permissions: z.array(z.string().regex(/^[a-z-]+\.(\*|[a-z]+)$/)).default([]),
});

/* ── GET /api/custom-roles ── */
export const GET = withRoute("/api/custom-roles", "GET", async () => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  const authError = requireAdmin(user);
  if (authError) return authError;

  const planDenied = await requirePlanFeature(workspaceId, "customRoles");
  if (planDenied) return planDenied;

  const custom = await prisma.customRole.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      nameEn: true,
      description: true,
      descriptionEn: true,
      baseRole: true,
      permissions: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    builtIn: BUILT_IN_ROLES,
    custom: (custom as Array<Record<string, unknown>>).map((r) => ({
      ...r,
      builtIn: false,
    })),
  });
});

/* ── POST /api/custom-roles ── */
export const POST = withRoute(
  "/api/custom-roles",
  "POST",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const authError = requireAdmin(user);
    if (authError) return authError;

    const planDenied = await requirePlanFeature(workspaceId, "customRoles");
    if (planDenied) return planDenied;

    const parsed = validateBody(createCustomRoleSchema, await req.json());
    if (!parsed.success) return parsed.response;
    const data = parsed.data;

    const existing = await prisma.customRole.findFirst({
      where: { workspaceId, name: data.name },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        {
          error: "Eine Rolle mit diesem Namen existiert bereits.",
          code: "DUPLICATE_NAME",
        },
        { status: 409 },
      );
    }

    const role = await prisma.customRole.create({
      data: {
        workspaceId,
        name: data.name,
        nameEn: data.nameEn ?? null,
        description: data.description ?? null,
        descriptionEn: data.descriptionEn ?? null,
        baseRole: data.baseRole,
        permissions: data.permissions,
        createdById: user.id,
      },
    });

    createAuditLog({
      action: "CREATE",
      entityType: "CustomRole",
      entityId: role.id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: { name: role.name, baseRole: role.baseRole },
    });

    return NextResponse.json({ ...role, builtIn: false }, { status: 201 });
  },
  { idempotent: true },
);
