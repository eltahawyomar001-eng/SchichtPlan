import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { isEmployee } from "@/lib/authorization";

/**
 * Centralized "employees only see their own data" invariant.
 * ──────────────────────────────────────────────────────────
 * EMPLOYEE-role users must never read/affect another employee's records via a
 * `?employeeId=` parameter or by omitting a filter. This was previously done
 * ad-hoc per route, which led to two failure modes:
 *   - routes that forgot the override entirely (a colleague's data was
 *     readable), and
 *   - routes whose override was skipped when the session had no linked
 *     employeeId, falling through to "see everything".
 *
 * Resolving the scope here once removes both classes of bug.
 */
export type OwnEmployeeScope =
  | { kind: "all" } // management — no restriction
  | { kind: "own"; employeeId: string } // employee — restrict to their records
  | { kind: "none" }; // employee with no linked profile — must see nothing

/**
 * Determine how an employee-scoped query must be restricted for this user.
 * Management roles get "all"; an EMPLOYEE is pinned to their own employeeId
 * (from the session, falling back to an email lookup), or "none" if they have
 * no employee profile at all.
 */
export async function resolveOwnEmployeeScope(
  user: SessionUser,
  workspaceId: string,
): Promise<OwnEmployeeScope> {
  if (!isEmployee(user)) return { kind: "all" };

  let employeeId = user.employeeId ?? null;
  if (!employeeId) {
    const emp = await prisma.employee.findFirst({
      where: { workspaceId, email: user.email ?? undefined },
      select: { id: true },
    });
    employeeId = emp?.id ?? null;
  }

  return employeeId ? { kind: "own", employeeId } : { kind: "none" };
}

/**
 * Apply the resolved scope to a Prisma `where` object in place.
 * @returns false if the caller should short-circuit to an empty result set
 *          (an employee with no linked profile must see nothing).
 */
export function applyOwnEmployeeScope(
  where: Record<string, unknown>,
  scope: OwnEmployeeScope,
): boolean {
  if (scope.kind === "none") return false;
  if (scope.kind === "own") where.employeeId = scope.employeeId;
  return true;
}
