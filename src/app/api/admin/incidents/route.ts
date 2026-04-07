import { log } from "@/lib/logger";
import { captureRouteError } from "@/lib/sentry";
import {
  requireAuth,
  serverError,
  apiSuccess,
  badRequest,
  forbidden,
} from "@/lib/api-response";
import { requireAdmin } from "@/lib/authorization";
import { createAuditLog } from "@/lib/audit";
import {
  reportIncident,
  resolveIncident,
  createMaintenanceWindow,
} from "@/lib/monitoring";
import { z } from "zod";
import { validateBody } from "@/lib/validations";

const createIncidentSchema = z.object({
  action: z.literal("create"),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
});

const resolveIncidentSchema = z.object({
  action: z.literal("resolve"),
  incidentId: z.string().min(1),
});

const createMaintenanceSchema = z.object({
  action: z.literal("maintenance"),
  title: z.string().min(1).max(200),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
});

const incidentSchema = z.discriminatedUnion("action", [
  createIncidentSchema,
  resolveIncidentSchema,
  createMaintenanceSchema,
]);

/**
 * POST /api/admin/incidents
 * OWNER-only: create/resolve incidents or schedule maintenance on BetterStack status page.
 */
export async function POST(req: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const adminCheck = requireAdmin(user);
    if (adminCheck) return adminCheck;

    // Only OWNER can manage incidents
    if (user.role !== "OWNER") {
      return forbidden("Nur der Workspace-Eigentümer kann Vorfälle verwalten");
    }

    const body = await req.json();
    const parsed = validateBody(incidentSchema, body);
    if (!parsed.success) return parsed.response;
    const data = parsed.data;

    if (data.action === "create") {
      const incidentId = await reportIncident(data.title, data.body);

      createAuditLog({
        workspaceId,
        userId: user.id,
        action: "CREATE",
        entityType: "Incident",
        entityId: incidentId ?? "unknown",
        metadata: { title: data.title },
      });

      return apiSuccess({ incidentId }, 201);
    }

    if (data.action === "resolve") {
      const success = await resolveIncident(data.incidentId);

      createAuditLog({
        workspaceId,
        userId: user.id,
        action: "UPDATE",
        entityType: "Incident",
        entityId: data.incidentId,
        metadata: { resolved: true },
      });

      return apiSuccess({ resolved: success });
    }

    if (data.action === "maintenance") {
      const startsAt = new Date(data.startsAt);
      const endsAt = new Date(data.endsAt);

      if (endsAt <= startsAt) {
        return badRequest("Endzeit muss nach Startzeit liegen");
      }

      const maintenanceId = await createMaintenanceWindow(
        startsAt,
        endsAt,
        data.title,
      );

      createAuditLog({
        workspaceId,
        userId: user.id,
        action: "CREATE",
        entityType: "Maintenance",
        entityId: maintenanceId ?? "unknown",
        metadata: {
          title: data.title,
          startsAt: data.startsAt,
          endsAt: data.endsAt,
        },
      });

      return apiSuccess({ maintenanceId }, 201);
    }

    return badRequest("Unbekannte Aktion");
  } catch (error) {
    log.error("POST /api/admin/incidents failed", { error });
    captureRouteError(error, { route: "/api/admin/incidents", method: "POST" });
    return serverError();
  }
}
