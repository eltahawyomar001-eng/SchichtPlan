import { prisma } from "@/lib/db";
import {
  requireAuth,
  apiSuccess,
  badRequest,
  serverError,
} from "@/lib/api-response";
import { log } from "@/lib/logger";
import { captureRouteError } from "@/lib/sentry";

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
export async function GET() {
  try {
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
  } catch (error) {
    log.error("GET /api/dashboard/favorites failed", { error });
    captureRouteError(error, {
      route: "/api/dashboard/favorites",
      method: "GET",
    });
    return serverError();
  }
}

/* ── PUT — replace the favorites list ── */
export async function PUT(req: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user } = auth;

    const body = await req.json();

    if (!Array.isArray(body.favorites)) {
      return badRequest("favorites must be an array of page keys");
    }

    const favorites: string[] = body.favorites;

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

    return apiSuccess(unique);
  } catch (error) {
    log.error("PUT /api/dashboard/favorites failed", { error });
    captureRouteError(error, {
      route: "/api/dashboard/favorites",
      method: "PUT",
    });
    return serverError();
  }
}
