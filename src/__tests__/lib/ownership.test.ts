// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const findFirstMock = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: { employee: { findFirst: (...a: unknown[]) => findFirstMock(...a) } },
}));

import {
  resolveOwnEmployeeScope,
  applyOwnEmployeeScope,
} from "@/lib/ownership";
import type { SessionUser } from "@/lib/types";

function user(role: string, employeeId: string | null): SessionUser {
  return {
    id: "u1",
    email: "u@x.de",
    name: "U",
    role,
    workspaceId: "ws1",
    employeeId,
  } as unknown as SessionUser;
}

describe("resolveOwnEmployeeScope", () => {
  beforeEach(() => findFirstMock.mockReset());

  it("management → all (no restriction, no DB lookup)", async () => {
    for (const role of ["OWNER", "ADMIN", "MANAGER"]) {
      const scope = await resolveOwnEmployeeScope(user(role, null), "ws1");
      expect(scope).toEqual({ kind: "all" });
    }
    expect(findFirstMock).not.toHaveBeenCalled();
  });

  it("employee with session employeeId → own (no DB lookup)", async () => {
    const scope = await resolveOwnEmployeeScope(
      user("EMPLOYEE", "emp-1"),
      "ws1",
    );
    expect(scope).toEqual({ kind: "own", employeeId: "emp-1" });
    expect(findFirstMock).not.toHaveBeenCalled();
  });

  it("employee without session employeeId → email fallback", async () => {
    findFirstMock.mockResolvedValue({ id: "emp-2" });
    const scope = await resolveOwnEmployeeScope(user("EMPLOYEE", null), "ws1");
    expect(scope).toEqual({ kind: "own", employeeId: "emp-2" });
    expect(findFirstMock).toHaveBeenCalled();
  });

  it("employee with no linked profile → none", async () => {
    findFirstMock.mockResolvedValue(null);
    const scope = await resolveOwnEmployeeScope(user("EMPLOYEE", null), "ws1");
    expect(scope).toEqual({ kind: "none" });
  });
});

describe("applyOwnEmployeeScope", () => {
  it("all → leaves where untouched, returns true", () => {
    const where: Record<string, unknown> = { workspaceId: "ws1" };
    expect(applyOwnEmployeeScope(where, { kind: "all" })).toBe(true);
    expect(where.employeeId).toBeUndefined();
  });

  it("own → pins employeeId (overriding any prior value), returns true", () => {
    const where: Record<string, unknown> = { employeeId: "someone-else" };
    expect(
      applyOwnEmployeeScope(where, { kind: "own", employeeId: "emp-1" }),
    ).toBe(true);
    expect(where.employeeId).toBe("emp-1");
  });

  it("none → returns false (caller must short-circuit to empty)", () => {
    const where: Record<string, unknown> = {};
    expect(applyOwnEmployeeScope(where, { kind: "none" })).toBe(false);
  });
});
