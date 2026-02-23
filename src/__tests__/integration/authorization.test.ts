import { describe, it, expect } from "vitest";
import {
  hasRole,
  isOwner,
  isAdmin,
  isManagement,
  isEmployee,
  can,
  requirePermission,
  requireManagement,
  requireAdmin,
  type Resource,
  type Action,
} from "@/lib/authorization";
import {
  buildOwner,
  buildAdmin,
  buildManager,
  buildEmployee,
  ALL_ROLES,
  ADMIN_ROLES,
  MANAGEMENT_ROLES,
} from "../helpers/factories";

/* ═══════════════════════════════════════════════════════════════
   Authorization — comprehensive integration tests
   ═══════════════════════════════════════════════════════════════ */

describe("authorization", () => {
  // ─── Role Check Helpers ────────────────────────────────────

  describe("hasRole", () => {
    it("returns true when user role is in the list", () => {
      const user = buildOwner();
      expect(hasRole(user, ["OWNER", "ADMIN"])).toBe(true);
    });

    it("returns false when user role is NOT in the list", () => {
      const user = buildEmployee();
      expect(hasRole(user, ["OWNER", "ADMIN"])).toBe(false);
    });
  });

  describe("isOwner", () => {
    it("returns true only for OWNER", () => {
      expect(isOwner(buildOwner())).toBe(true);
      expect(isOwner(buildAdmin())).toBe(false);
      expect(isOwner(buildManager())).toBe(false);
      expect(isOwner(buildEmployee())).toBe(false);
    });
  });

  describe("isAdmin", () => {
    it("returns true for OWNER and ADMIN", () => {
      expect(isAdmin(buildOwner())).toBe(true);
      expect(isAdmin(buildAdmin())).toBe(true);
      expect(isAdmin(buildManager())).toBe(false);
      expect(isAdmin(buildEmployee())).toBe(false);
    });
  });

  describe("isManagement", () => {
    it("returns true for OWNER, ADMIN, MANAGER", () => {
      expect(isManagement(buildOwner())).toBe(true);
      expect(isManagement(buildAdmin())).toBe(true);
      expect(isManagement(buildManager())).toBe(true);
      expect(isManagement(buildEmployee())).toBe(false);
    });
  });

  describe("isEmployee", () => {
    it("returns true only for EMPLOYEE", () => {
      expect(isEmployee(buildEmployee())).toBe(true);
      expect(isEmployee(buildOwner())).toBe(false);
    });
  });

  // ─── Permission Matrix ─────────────────────────────────────

  describe("can (permission matrix)", () => {
    // Core resources: shifts, employees, locations
    describe("shifts", () => {
      it("all roles can read", () => {
        for (const role of ALL_ROLES) {
          expect(can(buildOwner({ role }), "shifts", "read")).toBe(true);
        }
      });

      it("management can create/update/delete", () => {
        for (const role of MANAGEMENT_ROLES) {
          expect(can(buildOwner({ role }), "shifts", "create")).toBe(true);
          expect(can(buildOwner({ role }), "shifts", "update")).toBe(true);
          expect(can(buildOwner({ role }), "shifts", "delete")).toBe(true);
        }
      });

      it("EMPLOYEE cannot create/update/delete", () => {
        const emp = buildEmployee();
        expect(can(emp, "shifts", "create")).toBe(false);
        expect(can(emp, "shifts", "update")).toBe(false);
        expect(can(emp, "shifts", "delete")).toBe(false);
      });
    });

    describe("employees", () => {
      it("all roles can read", () => {
        for (const role of ALL_ROLES) {
          expect(can(buildOwner({ role }), "employees", "read")).toBe(true);
        }
      });

      it("only management can create", () => {
        for (const role of MANAGEMENT_ROLES) {
          expect(can(buildOwner({ role }), "employees", "create")).toBe(true);
        }
        expect(can(buildEmployee(), "employees", "create")).toBe(false);
      });
    });

    describe("settings", () => {
      it("only OWNER and ADMIN can access settings", () => {
        for (const role of ADMIN_ROLES) {
          expect(can(buildOwner({ role }), "settings", "read")).toBe(true);
          expect(can(buildOwner({ role }), "settings", "update")).toBe(true);
        }
        expect(can(buildManager(), "settings", "read")).toBe(false);
        expect(can(buildEmployee(), "settings", "read")).toBe(false);
      });
    });

    describe("webhooks", () => {
      it("only OWNER and ADMIN can manage webhooks", () => {
        for (const role of ADMIN_ROLES) {
          expect(can(buildOwner({ role }), "webhooks", "read")).toBe(true);
          expect(can(buildOwner({ role }), "webhooks", "create")).toBe(true);
        }
        expect(can(buildManager(), "webhooks", "read")).toBe(false);
        expect(can(buildEmployee(), "webhooks", "create")).toBe(false);
      });
    });

    describe("absences", () => {
      it("EMPLOYEE can create absences (submit requests)", () => {
        expect(can(buildEmployee(), "absences", "create")).toBe(true);
      });

      it("only management can approve absences", () => {
        for (const role of MANAGEMENT_ROLES) {
          expect(can(buildOwner({ role }), "absences", "approve")).toBe(true);
        }
        expect(can(buildEmployee(), "absences", "approve")).toBe(false);
      });
    });

    describe("team", () => {
      it("only OWNER can update team (change roles)", () => {
        expect(can(buildOwner(), "team", "update")).toBe(true);
        expect(can(buildAdmin(), "team", "update")).toBe(false);
        expect(can(buildManager(), "team", "update")).toBe(false);
      });
    });

    describe("invitations", () => {
      it("only OWNER and ADMIN can manage invitations", () => {
        for (const role of ADMIN_ROLES) {
          expect(can(buildOwner({ role }), "invitations", "create")).toBe(true);
        }
        expect(can(buildManager(), "invitations", "create")).toBe(false);
      });
    });

    describe("shift-change-requests", () => {
      it("only EMPLOYEE can create shift-change requests", () => {
        expect(can(buildEmployee(), "shift-change-requests", "create")).toBe(
          true,
        );
        expect(can(buildOwner(), "shift-change-requests", "create")).toBe(
          false,
        );
      });
    });

    it("returns false for unknown resource/action combos", () => {
      expect(
        can(buildOwner(), "nonexistent" as Resource, "read" as Action),
      ).toBe(false);
    });
  });

  // ─── Response Guards ───────────────────────────────────────

  describe("requirePermission", () => {
    it("returns null when user has permission", () => {
      const result = requirePermission(buildOwner(), "shifts", "create");
      expect(result).toBeNull();
    });

    it("returns 403 response when user lacks permission", async () => {
      const result = requirePermission(buildEmployee(), "shifts", "create");
      expect(result).not.toBeNull();
      expect(result!.status).toBe(403);

      const body = await result!.json();
      expect(body.error).toBe("Forbidden");
    });
  });

  describe("requireManagement", () => {
    it("returns null for OWNER, ADMIN, MANAGER", () => {
      expect(requireManagement(buildOwner())).toBeNull();
      expect(requireManagement(buildAdmin())).toBeNull();
      expect(requireManagement(buildManager())).toBeNull();
    });

    it("returns 403 for EMPLOYEE", async () => {
      const result = requireManagement(buildEmployee());
      expect(result).not.toBeNull();
      expect(result!.status).toBe(403);
    });
  });

  describe("requireAdmin", () => {
    it("returns null for OWNER and ADMIN", () => {
      expect(requireAdmin(buildOwner())).toBeNull();
      expect(requireAdmin(buildAdmin())).toBeNull();
    });

    it("returns 403 for MANAGER and EMPLOYEE", async () => {
      const managerResult = requireAdmin(buildManager());
      expect(managerResult).not.toBeNull();
      expect(managerResult!.status).toBe(403);

      const employeeResult = requireAdmin(buildEmployee());
      expect(employeeResult).not.toBeNull();
      expect(employeeResult!.status).toBe(403);
    });
  });
});
