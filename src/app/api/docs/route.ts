import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authorization";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";

/**
 * GET /api/docs
 *
 * Returns the OpenAPI 3.0 specification for the Shiftfy API.
 * Restricted to OWNER/ADMIN to prevent unauthenticated API spec exposure.
 */
export const GET = withRoute("/api/docs", "GET", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  const forbidden = requireAdmin(user);
  if (forbidden) return forbidden;

  const spec = {
    openapi: "3.0.3",
    info: {
      title: "Shiftfy API",
      version: "1.0.0",
      description:
        "REST API for Shiftfy — Shift planning, time tracking, and workforce management. All endpoints require authentication via session cookie. All list endpoints support pagination.",
      contact: {
        name: "Shiftfy Support",
        url: "https://www.shiftfy.de",
      },
    },
    servers: [
      {
        url: process.env.SITE_URL || "https://www.shiftfy.de",
        description: "Production",
      },
    ],
    security: [{ cookieAuth: [] }],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "next-auth.session-token",
        },
      },
      schemas: {
        Pagination: {
          type: "object",
          properties: {
            total: { type: "integer" },
            limit: { type: "integer" },
            offset: { type: "integer" },
            hasMore: { type: "boolean" },
          },
        },
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
        Employee: {
          type: "object",
          properties: {
            id: { type: "string" },
            firstName: { type: "string" },
            lastName: { type: "string" },
            email: { type: "string", nullable: true },
            phone: { type: "string", nullable: true },
            position: { type: "string", nullable: true },
            hourlyRate: { type: "number", nullable: true },
            weeklyHours: { type: "number", nullable: true },
            isActive: { type: "boolean" },
            workspaceId: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Shift: {
          type: "object",
          properties: {
            id: { type: "string" },
            date: { type: "string", format: "date" },
            startTime: { type: "string", example: "08:00" },
            endTime: { type: "string", example: "16:00" },
            status: {
              type: "string",
              enum: [
                "SCHEDULED",
                "CONFIRMED",
                "IN_PROGRESS",
                "COMPLETED",
                "CANCELLED",
                "NO_SHOW",
                "OPEN",
              ],
            },
            employeeId: { type: "string", nullable: true },
            locationId: { type: "string", nullable: true },
            workspaceId: { type: "string" },
          },
        },
        TimeEntry: {
          type: "object",
          properties: {
            id: { type: "string" },
            date: { type: "string", format: "date" },
            startTime: { type: "string", example: "08:00" },
            endTime: { type: "string", example: "16:30" },
            breakMinutes: { type: "integer" },
            grossMinutes: { type: "integer" },
            netMinutes: { type: "integer" },
            status: {
              type: "string",
              enum: [
                "ENTWURF",
                "EINGEREICHT",
                "KORREKTUR",
                "ZURUECKGEWIESEN",
                "GEPRUEFT",
                "BESTAETIGT",
              ],
            },
            employeeId: { type: "string" },
            workspaceId: { type: "string" },
          },
        },
        HealthCheck: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["ok", "degraded"] },
            version: { type: "string" },
            apiVersion: { type: "integer" },
            timestamp: { type: "string", format: "date-time" },
            uptime: {
              type: "integer",
              description: "Uptime in seconds",
            },
            memory: {
              type: "object",
              properties: {
                rss: { type: "integer", description: "MB" },
                heapUsed: { type: "integer", description: "MB" },
                heapTotal: { type: "integer", description: "MB" },
              },
            },
            checks: { type: "object" },
          },
        },
      },
      parameters: {
        page: {
          name: "page",
          in: "query",
          schema: { type: "integer", default: 1 },
          description: "Page number (1-indexed)",
        },
        pageSize: {
          name: "pageSize",
          in: "query",
          schema: { type: "integer", default: 50, maximum: 200 },
          description: "Number of items per page",
        },
      },
    },
    paths: {
      "/api/health": {
        get: {
          tags: ["System"],
          summary: "Health check",
          description:
            "Returns the health status of the API, including database and Redis connectivity.",
          security: [],
          responses: {
            "200": {
              description: "Healthy",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/HealthCheck" },
                },
              },
            },
            "503": { description: "Degraded" },
          },
        },
      },
      "/api/employees": {
        get: {
          tags: ["Employees"],
          summary: "List employees",
          parameters: [
            { $ref: "#/components/parameters/page" },
            { $ref: "#/components/parameters/pageSize" },
            {
              name: "search",
              in: "query",
              schema: { type: "string" },
              description: "Search by first name, last name, or email",
            },
          ],
          responses: {
            "200": {
              description: "Paginated list of employees",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      data: {
                        type: "array",
                        items: {
                          $ref: "#/components/schemas/Employee",
                        },
                      },
                      pagination: {
                        $ref: "#/components/schemas/Pagination",
                      },
                    },
                  },
                },
              },
            },
            "401": {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
          },
        },
        post: {
          tags: ["Employees"],
          summary: "Create an employee",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["firstName", "lastName"],
                  properties: {
                    firstName: { type: "string" },
                    lastName: { type: "string" },
                    email: { type: "string" },
                    phone: { type: "string" },
                    position: { type: "string" },
                    hourlyRate: { type: "number" },
                    weeklyHours: { type: "number" },
                  },
                },
              },
            },
          },
          responses: {
            "201": { description: "Employee created" },
            "400": { description: "Validation error" },
            "401": { description: "Unauthorized" },
            "403": { description: "Forbidden" },
          },
        },
      },
      "/api/shifts": {
        get: {
          tags: ["Shifts"],
          summary: "List shifts",
          parameters: [
            { $ref: "#/components/parameters/page" },
            { $ref: "#/components/parameters/pageSize" },
            {
              name: "start",
              in: "query",
              schema: { type: "string", format: "date" },
            },
            {
              name: "end",
              in: "query",
              schema: { type: "string", format: "date" },
            },
          ],
          responses: {
            "200": { description: "Paginated list of shifts" },
            "401": { description: "Unauthorized" },
          },
        },
        post: {
          tags: ["Shifts"],
          summary: "Create a shift",
          responses: {
            "201": { description: "Shift created" },
            "400": { description: "Validation error" },
            "401": { description: "Unauthorized" },
          },
        },
      },
      "/api/time-entries": {
        get: {
          tags: ["Time Entries"],
          summary: "List time entries",
          parameters: [
            { $ref: "#/components/parameters/page" },
            { $ref: "#/components/parameters/pageSize" },
          ],
          responses: {
            "200": { description: "Paginated list of time entries" },
            "401": { description: "Unauthorized" },
          },
        },
        post: {
          tags: ["Time Entries"],
          summary: "Create a time entry",
          responses: {
            "201": { description: "Time entry created" },
            "400": { description: "Validation error" },
            "401": { description: "Unauthorized" },
          },
        },
      },
      "/api/absences": {
        get: {
          tags: ["Absences"],
          summary: "List absence requests",
          parameters: [
            { $ref: "#/components/parameters/page" },
            { $ref: "#/components/parameters/pageSize" },
          ],
          responses: {
            "200": { description: "Paginated list of absences" },
            "401": { description: "Unauthorized" },
          },
        },
      },
      "/api/locations": {
        get: {
          tags: ["Locations"],
          summary: "List locations",
          parameters: [
            { $ref: "#/components/parameters/page" },
            { $ref: "#/components/parameters/pageSize" },
          ],
          responses: {
            "200": { description: "Paginated list of locations" },
          },
        },
      },
      "/api/departments": {
        get: {
          tags: ["Departments"],
          summary: "List departments",
          parameters: [
            { $ref: "#/components/parameters/page" },
            { $ref: "#/components/parameters/pageSize" },
          ],
          responses: {
            "200": { description: "Paginated list of departments" },
          },
        },
      },
      "/api/notifications": {
        get: {
          tags: ["Notifications"],
          summary: "List notifications",
          parameters: [
            { $ref: "#/components/parameters/page" },
            { $ref: "#/components/parameters/pageSize" },
          ],
          responses: {
            "200": {
              description: "Paginated notifications with unread count",
            },
          },
        },
      },
      "/api/shift-swaps": {
        get: {
          tags: ["Shift Swaps"],
          summary: "List shift swap requests",
          responses: {
            "200": { description: "Paginated list of swap requests" },
          },
        },
      },
      "/api/projects": {
        get: {
          tags: ["Projects"],
          summary: "List projects",
          responses: {
            "200": { description: "Paginated list of projects" },
          },
        },
      },
      "/api/webhooks": {
        get: {
          tags: ["Webhooks"],
          summary: "List webhooks",
          responses: {
            "200": { description: "Paginated list of webhooks" },
          },
        },
      },
      "/api/automation-rules": {
        get: {
          tags: ["Automation"],
          summary: "List automation rules",
          responses: {
            "200": {
              description: "Paginated list of automation rules",
            },
          },
        },
      },
    },
    tags: [
      { name: "System", description: "Health and system endpoints" },
      { name: "Employees", description: "Employee management" },
      { name: "Shifts", description: "Shift planning" },
      { name: "Time Entries", description: "Time tracking" },
      { name: "Absences", description: "Absence / vacation requests" },
      { name: "Locations", description: "Workspace locations" },
      { name: "Departments", description: "Department management" },
      { name: "Notifications", description: "User notifications" },
      { name: "Shift Swaps", description: "Shift swap requests" },
      { name: "Projects", description: "Project management" },
      { name: "Webhooks", description: "Webhook configuration" },
      { name: "Automation", description: "Automation rules" },
    ],
  };

  return NextResponse.json(spec, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
});
