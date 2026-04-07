import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { requireLocationSlot } from "@/lib/subscription";
import { createLocationSchema, validateBody } from "@/lib/validations";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { requireAuth, serverError } from "@/lib/api-response";
import { withRoute } from "@/lib/with-route";
import { createAuditLog } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";

export const GET = withRoute("/api/locations", "GET", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { workspaceId } = auth;

  const { take, skip } = parsePagination(req);

  const [locations, total] = await Promise.all([
    prisma.location.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
      take,
      skip,
    }),
    prisma.location.count({ where: { workspaceId } }),
  ]);

  return paginatedResponse(locations, total, take, skip);
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

    const body = await req.json();
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

    return NextResponse.json(location, { status: 201 });
  },
  { idempotent: true },
);
