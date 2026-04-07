import { prisma } from "@/lib/db";
import {
  requireAuth,
  apiSuccess,
  badRequest,
  serverError,
} from "@/lib/api-response";
import { log } from "@/lib/logger";
import { captureRouteError } from "@/lib/sentry";
import { withRoute } from "@/lib/with-route";
import { updateFavoritesSchema, validateBody } from "@/lib/validations";
import { createAuditLog } from "@/lib/audit";

/* ── All valid page keys (must match sidebar navGroups keys) ── */
const VALID_PAGE_KEYS = new Set([
  "shiftPlan",
  "timeTracking",
  "absences",
  "shiftSwap",
  "punchClock",
  "serviceProof",
  "teamChat",
  "tickets",
  "teamCalendar",
  "annualPlanning",
  "employees",
  "departments",
  "skills",
  "locations",
  "shiftTemplates",
  "projects",
  "clients",
  "vacationBalance",
  "timeAccounts",
  "reports",
  "payrollExport",
  "monthClose",
  "dataIO",
  "holidays",
  "automationRules",
  "webhooks",
  "settings",
  "billing",
  "roles",
]);

const MAX_FAVORITES = 8;

/* ── GET — read current user's favorites ── */
export const GET = withRoute("/api/dashboard/favorites", "GET", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { dashboardFavorites: true },
  });

  const favorites: string[] = dbUser?.dashboardFavorites
    ? JSON.parse(dbUser.dashboardFavorites)
    : [];

  return apiSuccess(favorites);
});

/* ── PUT — replace the favorites list ── */
export const PUT = withRoute("/api/dashboard/favorites", "PUT", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const body = await req.json();
  const parsed = validateBody(updateFavoritesSchema, body);
  if (!parsed.success) return parsed.response;

  const favorites = parsed.data.favorites;

  // Validate all keys
  for (const key of favorites) {
    if (typeof key !== "string" || !VALID_PAGE_KEYS.has(key)) {
      return badRequest(`Invalid page key: ${key}`);
    }
  }

  // Deduplicate & cap
  const unique = [...new Set(favorites)].slice(0, MAX_FAVORITES);

  await prisma.user.update({
    where: { id: user.id },
    data: { dashboardFavorites: JSON.stringify(unique) },
  });

  createAuditLog({
    action: "UPDATE",
    entityType: "DashboardFavorites",
    userId: user.id,
    userEmail: user.email,
    workspaceId: user.workspaceId,
    changes: { favorites: unique },
  });

  return apiSuccess(unique);
});
