import { describe, it, expect } from "vitest";

describe("authorization", () => {
  it("loads the authorization module", async () => {
    const mod = await import("@/lib/authorization");
    expect(mod.isOwner).toBeDefined();
    expect(mod.isAdmin).toBeDefined();
    expect(mod.isManagement).toBeDefined();
    expect(mod.isEmployee).toBeDefined();
    expect(mod.requirePermission).toBeDefined();
  });

  it("isOwner returns true for OWNER role", async () => {
    const { isOwner } = await import("@/lib/authorization");
    expect(
      isOwner({
        id: "1",
        email: "a@b.com",
        name: "Test",
        role: "OWNER",
        workspaceId: "w1",
      }),
    ).toBe(true);
  });

  it("isOwner returns false for ADMIN role", async () => {
    const { isOwner } = await import("@/lib/authorization");
    expect(
      isOwner({
        id: "1",
        email: "a@b.com",
        name: "Test",
        role: "ADMIN",
        workspaceId: "w1",
      }),
    ).toBe(false);
  });

  it("isManagement returns true for MANAGER", async () => {
    const { isManagement } = await import("@/lib/authorization");
    expect(
      isManagement({
        id: "1",
        email: "a@b.com",
        name: "Test",
        role: "MANAGER",
        workspaceId: "w1",
      }),
    ).toBe(true);
  });

  it("isEmployee returns true for EMPLOYEE", async () => {
    const { isEmployee } = await import("@/lib/authorization");
    expect(
      isEmployee({
        id: "1",
        email: "a@b.com",
        name: "Test",
        role: "EMPLOYEE",
        workspaceId: "w1",
      }),
    ).toBe(true);
  });
});
