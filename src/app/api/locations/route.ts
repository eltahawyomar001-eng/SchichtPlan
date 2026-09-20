import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { requireLocationSlot } from "@/lib/subscription";
import { createLocationSchema, validateBody } from "@/lib/validations";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { requireAuth, serverError, parseJsonBody } from "@/lib/api-response";
import { withRoute } from "@/lib/with-route";
import { createAuditLog } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";
import { resolveAndPersistLocationGeo } from "@/lib/geocode";

/**
 * How long creating a location will wait on a geocoder.
 *
 * Long enough for an Open-Meteo hit, which is the overwhelming majority, and
 * short enough that a manager adding an object never sits on a spinner because
 * a third party is having a bad day.
 */
const GEOCODE_BUDGET_MS = 3000;

export const GET = withRoute("/api/locations", "GET", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { workspaceId } = auth;

  const { take, skip } = parsePagination(req);

  const [locations, total] = await Promise.all([
    prisma.location.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: { name: "asc" },
      take,
      skip,
    }),
    prisma.location.count({ where: { workspaceId, deletedAt: null } }),
  ]);

  const res = paginatedResponse(locations, total, take, skip);
  res.headers.set(
    "Cache-Control",
    "private, max-age=30, stale-while-revalidate=300",
  );
  return res;
});

export const POST = withRoute(
  "/api/locations",
  "POST",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    // Only OWNER, ADMIN, MANAGER can create locations
    const forbidden = requirePermission(user, "locations", "create");
    if (forbidden) return forbidden;

    // Check plan limit
    const planLimit = await requireLocationSlot(workspaceId);
    if (planLimit) return planLimit;

    const _json = await parseJsonBody(req);
    if (!_json.ok) return _json.response;
    const body = _json.data;
    const parsed = validateBody(createLocationSchema, body);
    if (!parsed.success) return parsed.response;
    const { name, address } = parsed.data;

    const location = await prisma.location.create({
      data: {
        name,
        address: address || null,
        workspaceId,
      },
    });

    /**
     * Resolve coordinates now, not eventually.
     *
     * A location was only ever geocoded by the manual "Resolve coordinates"
     * button or as a side effect of the weather widget, so an object created
     * through onboarding or the locations page had none. Without a reference
     * point the geofence cannot judge anything: every punch and every proof
     * photo at that object comes back "cannot be checked", and nothing tells
     * the manager why. That is a silent failure of the feature, so the common
     * case has to land before the row is first used.
     *
     * Bounded, and never fatal. A geocoding provider is a third party on
     * someone else's network and must not decide whether a location can be
     * created — if it is slow or down, the row is created without coordinates
     * and the nightly sweep picks it up.
     */
    const geo = await resolveAndPersistLocationGeo(location.id, {
      budgetMs: GEOCODE_BUDGET_MS,
    });

    createAuditLog({
      action: "CREATE",
      entityType: "Location",
      entityId: location.id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: { name, address },
    });

    dispatchWebhook(workspaceId, "location.created", {
      id: location.id,
      name,
      address,
    }).catch(() => {});

    return NextResponse.json(
      geo ? { ...location, latitude: geo.lat, longitude: geo.lon } : location,
      { status: 201 },
    );
  },
  { idempotent: true },
);
