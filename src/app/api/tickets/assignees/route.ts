import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { requireAuth } from "@/lib/api-response";
import { withRoute } from "@/lib/with-route";

/**
 * GET /api/tickets/assignees
 *
 * Returns every workspace member that can be assigned to a ticket.
 * Includes ADMIN, MANAGER, and EMPLOYEE roles so any teammate can act
 * on a ticket. OWNER is included too (owners often handle support).
 *
 * Available to every authenticated user with ticket-read access — the
 * dropdown needs to render for employees creating new tickets.
 */
export const GET = withRoute("/api/tickets/assignees", "GET", async () => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  const forbidden = requirePermission(user, "tickets", "read");
  if (forbidden) return forbidden;

  const users = await prisma.user.findMany({
    where: {
      workspaceId,
      role: { in: ["OWNER", "ADMIN", "MANAGER", "EMPLOYEE"] },
    },
    select: { id: true, name: true, email: true, role: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({ assignees: users });
});
