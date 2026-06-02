import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { log } from "@/lib/logger";
import { createClientSchema, validateBody } from "@/lib/validations";
import { withRoute } from "@/lib/with-route";
import { requireAuth, parseJsonBody } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";

/** GET /api/clients — list all clients for the workspace */
export const GET = withRoute("/api/clients", "GET", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  const forbidden = requirePermission(user, "clients", "read");
  if (forbidden) return forbidden;

  const { take, skip } = parsePagination(req);

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where: { workspaceId: user.workspaceId, deletedAt: null },
      include: {
        projects: { select: { id: true, name: true, status: true } },
      },
      orderBy: { name: "asc" },
      take,
      skip,
    }),
    prisma.client.count({
      where: { workspaceId: user.workspaceId, deletedAt: null },
    }),
  ]);

  return paginatedResponse(clients, total, take, skip);
});

/** POST /api/clients — create a new client */
export const POST = withRoute(
  "/api/clients",
  "POST",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "clients", "create");
    if (forbidden) return forbidden;

    const _json = await parseJsonBody(req);
    if (!_json.ok) return _json.response;
    const parsed = validateBody(createClientSchema, _json.data);
    if (!parsed.success) return parsed.response;

    const { name, email, phone, address, notes } = parsed.data;

    const client = await prisma.client.create({
      data: {
        name,
        email: email || null,
        phone: phone || null,
        address: address || null,
        notes: notes || null,
        workspaceId: user.workspaceId,
      },
    });

    createAuditLog({
      action: "CREATE",
      entityType: "Client",
      entityId: client.id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: { name, email },
    });

    dispatchWebhook(workspaceId, "client.created", {
      id: client.id,
      name,
    }).catch((err) => log.warn("[dispatch] fire-and-forget failed", { err }));

    return NextResponse.json(client, { status: 201 });
  },
  { idempotent: true },
);
