import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePlanFeature } from "@/lib/subscription";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";

/**
 * GET /api/chat/users
 * List all workspace users for the member picker.
 * Returns id, name, email, image for each user.
 */
export const GET = withRoute("/api/chat/users", "GET", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  const planGate = await requirePlanFeature(user.workspaceId, "teamChat");
  if (planGate) return planGate;

  const users = await prisma.user.findMany({
    where: { workspaceId: user.workspaceId },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(users);
});
