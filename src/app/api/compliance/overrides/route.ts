import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, badRequest } from "@/lib/api-response";
import { requirePermission } from "@/lib/authorization";
import { withRoute } from "@/lib/with-route";

export const dynamic = "force-dynamic";

/**
 * GET /api/compliance/overrides?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Every hard block consciously released in the period: which rule, on which
 * entity, by whom, and why. Written since Phase 2 but never surfaced — an
 * override that nobody can read is not an audit trail.
 *
 * Rows are resolved to human identities here rather than in the UI: the raw
 * record stores a user id and an entity id, and an auditor needs a name and a
 * date.
 */
export const GET = withRoute(
  "/api/compliance/overrides",
  "GET",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "shifts", "read");
    if (forbidden) return forbidden;

    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (!from || !to) return badRequest("from und to sind erforderlich");
    if (isNaN(Date.parse(from)) || isNaN(Date.parse(to))) {
      return badRequest("Ungültiger Zeitraum");
    }

    // `to` is an inclusive calendar day, so extend to its end.
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);

    const overrides = await prisma.complianceOverride.findMany({
      where: {
        workspaceId,
        overriddenAt: { gte: new Date(from), lte: end },
      },
      orderBy: { overriddenAt: "desc" },
      take: 500,
    });

    if (overrides.length === 0) return NextResponse.json([]);

    // Resolve the acting managers in one query rather than per row.
    const userIds = [...new Set(overrides.map((o) => o.overriddenBy))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    });
    const userById = new Map(users.map((u) => [u.id, u]));

    // Same for the shifts the overrides point at. entityId is deliberately not
    // a foreign key (an override outlives the shift it justifies), so a miss
    // here is expected and rendered as "deleted", not as an error.
    const shiftIds = overrides
      .filter((o) => o.entityType === "Shift")
      .map((o) => o.entityId);
    const shifts = shiftIds.length
      ? await prisma.shift.findMany({
          where: { id: { in: shiftIds }, workspaceId },
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            employee: { select: { firstName: true, lastName: true } },
            location: { select: { name: true } },
          },
        })
      : [];
    const shiftById = new Map(shifts.map((s) => [s.id, s]));

    return NextResponse.json(
      overrides.map((o) => {
        const actor = userById.get(o.overriddenBy);
        const shift = shiftById.get(o.entityId);
        return {
          id: o.id,
          rule: o.rule,
          entityType: o.entityType,
          entityId: o.entityId,
          reason: o.reason,
          overriddenAt: o.overriddenAt,
          overriddenBy: o.overriddenBy,
          overriddenByName: actor?.name ?? actor?.email ?? null,
          entity: shift
            ? {
                date: shift.date,
                startTime: shift.startTime,
                endTime: shift.endTime,
                employeeName: shift.employee
                  ? `${shift.employee.firstName} ${shift.employee.lastName}`
                  : null,
                locationName: shift.location?.name ?? null,
              }
            : null,
        };
      }),
    );
  },
);
