import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isEmployee } from "@/lib/authorization";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { log } from "@/lib/logger";
import { createAvailabilitySchema, validateBody } from "@/lib/validations";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";

// ─── GET  /api/availability ─────────────────────────────────────
export const GET = withRoute("/api/availability", "GET", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;
  if (!workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get("employeeId");

  const where: Record<string, unknown> = { workspaceId };
  if (employeeId) where.employeeId = employeeId;

  const { take, skip } = parsePagination(req);

  const [availabilities, total] = await Promise.all([
    prisma.availability.findMany({
      where,
      include: { employee: true },
      orderBy: [{ employeeId: "asc" }, { weekday: "asc" }],
      take,
      skip,
    }),
    prisma.availability.count({ where }),
  ]);

  return paginatedResponse(availabilities, total, take, skip);
});

// ─── POST  /api/availability ────────────────────────────────────
// Accepts a batch of availability entries for an employee
export const POST = withRoute(
  "/api/availability",
  "POST",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const parsed = validateBody(createAvailabilitySchema, await req.json());
    if (!parsed.success) return parsed.response;

    const body = parsed.data;

    // EMPLOYEE can only manage their own availability
    if (isEmployee(user)) {
      const linkedEmployee = await prisma.employee.findFirst({
        where: { workspaceId, email: user.email ?? undefined },
      });
      if (!linkedEmployee || body.employeeId !== linkedEmployee.id) {
        return NextResponse.json(
          {
            error: "Forbidden",
            message: "Sie können nur Ihre eigene Verfügbarkeit verwalten.",
          },
          { status: 403 },
        );
      }
    }

    // Delete existing entries for this employee's validity period, then re-create
    const validFrom = body.validFrom ? new Date(body.validFrom) : new Date();

    await prisma.availability.deleteMany({
      where: {
        employeeId: body.employeeId,
        workspaceId,
        validFrom: { gte: validFrom },
      },
    });

    const created = await prisma.availability.createMany({
      data: body.entries.map((entry) => ({
        weekday: entry.weekday,
        startTime: entry.startTime || null,
        endTime: entry.endTime || null,
        type: entry.type,
        validFrom,
        notes: entry.notes || null,
        employeeId: body.employeeId,
        workspaceId,
      })),
    });

    createAuditLog({
      action: "CREATE",
      entityType: "Availability",
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: { employeeId: body.employeeId, entries: body.entries.length },
    });

    dispatchWebhook(workspaceId, "availability.updated", {
      employeeId: body.employeeId,
      entries: body.entries.length,
    }).catch(() => {});

    return NextResponse.json({ created: created.count }, { status: 201 });
  },
  { idempotent: true },
);
