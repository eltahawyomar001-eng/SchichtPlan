import { prisma } from "@/lib/db";
import {
  requireAuth,
  apiSuccess,
  apiError,
  serverError,
} from "@/lib/api-response";
import { requireManagement } from "@/lib/authorization";
import { log } from "@/lib/logger";
import { captureRouteError } from "@/lib/sentry";
import { cache } from "@/lib/cache";

/**
 * POST /api/time-entries/clock/create-profile
 *
 * Auto-creates an Employee record for the current user (OWNER/ADMIN/MANAGER)
 * and links it to their User account so they can use the Stempeluhr.
 *
 * Only allowed when the user does NOT already have a linked employee profile.
 */
export async function POST() {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    // Only management roles may self-create a profile
    const forbidden = requireManagement(user);
    if (forbidden) return forbidden;

    // Check if they already have a linked employee
    if (user.employeeId) {
      return apiError("Employee profile already exists", 409);
    }

    // Double-check in DB (session cache may be stale)
    const existingLink = await prisma.employee.findUnique({
      where: { userId: user.id },
    });
    if (existingLink) {
      // Invalidate JWT cache so session picks up the employeeId
      await cache.del(`jwt:${user.id}`);
      return apiSuccess({ employeeId: existingLink.id });
    }

    // Create the employee and link to this user in a transaction
    const employee = await prisma.$transaction(async (tx) => {
      if (!user.email) {
        throw new Error("User email is required for employee profile creation");
      }
      const created = await tx.employee.create({
        data: {
          firstName: user.name?.split(" ")[0] || "Mitarbeiter",
          lastName: user.name?.split(" ").slice(1).join(" ") || "",
          email: user.email,
          workspaceId,
          userId: user.id,
          isActive: true,
        },
      });
      return created;
    });

    // Invalidate JWT cache so the session refreshes with the new employeeId
    await cache.del(`jwt:${user.id}`);

    log.info("Self-created employee profile for clock", {
      userId: user.id,
      employeeId: employee.id,
    });

    return apiSuccess({ employeeId: employee.id }, 201);
  } catch (error) {
    log.error("Create clock profile error:", { error });
    captureRouteError(error, {
      route: "/api/time-entries/clock/create-profile",
      method: "POST",
    });
    return serverError();
  }
}
