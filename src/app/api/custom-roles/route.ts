import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/authorization";
import { requirePlanFeature } from "@/lib/subscription";
import type { SessionUser } from "@/lib/types";

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
    name: "Owner",
    builtIn: true,
    permissions: ["*"],
    description: "Full access — can manage billing, members, and all data.",
  },
  {
    id: "admin",
    name: "Admin",
    builtIn: true,
    permissions: [
      "employees.*",
      "shifts.*",
      "locations.*",
      "reports.read",
      "settings.read",
    ],
    description:
      "Can manage employees, shifts, and locations. Cannot manage billing.",
  },
  {
    id: "manager",
    name: "Manager",
    builtIn: true,
    permissions: [
      "shifts.*",
      "employees.read",
      "absences.review",
      "time-entries.review",
    ],
    description: "Can manage shifts and review absences / time entries.",
  },
  {
    id: "employee",
    name: "Employee",
    builtIn: true,
    permissions: [
      "shifts.read",
      "absences.create",
      "time-entries.create",
      "availability.manage",
    ],
    description: "Can view own shifts, submit absences and clock in/out.",
  },
];

/* ── GET /api/custom-roles ── */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as SessionUser;

  // Only admins+ can view roles
  const authError = requireAdmin(user);
  if (authError) return authError;

  // Gate behind customRoles feature
  const planDenied = await requirePlanFeature(user.workspaceId, "customRoles");
  if (planDenied) return planDenied;

  return NextResponse.json(BUILT_IN_ROLES);
}

/* ── POST /api/custom-roles ── */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as SessionUser;

  const authError = requireAdmin(user);
  if (authError) return authError;

  const planDenied = await requirePlanFeature(user.workspaceId, "customRoles");
  if (planDenied) return planDenied;

  // Stub: acknowledge the request but explain that custom role
  // persistence is not yet implemented (needs DB migration).
  const body = await req.json();
  return NextResponse.json(
    {
      message:
        "Custom role creation is coming soon. " +
        "The built-in roles cover most use cases.",
      received: body,
    },
    { status: 202 },
  );
}
