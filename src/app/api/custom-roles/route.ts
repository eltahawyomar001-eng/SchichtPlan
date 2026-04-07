import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authorization";
import { requirePlanFeature } from "@/lib/subscription";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";

/**
 * Custom Roles CRUD — stub implementation.
 *
 * This endpoint is gated behind the `customRoles` feature flag
 * (Business+ tier). Once a CustomRole Prisma model is added,
 * the handlers below should be wired to the database.
 *
 * For now it returns a static list of the built-in roles with
 * their permission descriptions.
 */

const BUILT_IN_ROLES = [
  {
    id: "owner",
    name: "Inhaber",
    nameEn: "Owner",
    builtIn: true,
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

/* ── GET /api/custom-roles ── */
export const GET = withRoute("/api/custom-roles", "GET", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  // Only admins+ can view roles
  const authError = requireAdmin(user);
  if (authError) return authError;

  // Gate behind customRoles feature
  const planDenied = await requirePlanFeature(user.workspaceId, "customRoles");
  if (planDenied) return planDenied;

  return NextResponse.json(BUILT_IN_ROLES);
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

    const planDenied = await requirePlanFeature(
      user.workspaceId,
      "customRoles",
    );
    if (planDenied) return planDenied;

    // Not yet implemented — return 501 so the client knows this
    // feature does not exist yet (not a success status).
    return NextResponse.json(
      {
        error:
          "Benutzerdefinierte Rollen sind noch nicht verfügbar. " +
          "Die integrierten Rollen decken die meisten Anwendungsfälle ab.",
        errorEn:
          "Custom role creation is not yet available. " +
          "The built-in roles cover most use cases.",
      },
      { status: 501 },
    );
  },
  { idempotent: true },
);
