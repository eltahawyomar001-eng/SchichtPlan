/* ═══════════════════════════════════════════════════════════════
   Soft-delete helpers
   ═══════════════════════════════════════════════════════════════
   Instead of hard-deleting Employee, Shift, and TimeEntry rows,
   set `deletedAt = new Date()`.  All list queries should include
   `...notDeleted` in their `where` clause.

   Usage:
     import { notDeleted, softDelete } from "@/lib/soft-delete";

     // Querying (exclude soft-deleted rows)
     const employees = await prisma.employee.findMany({
       where: { workspaceId, ...notDeleted },
     });

     // Soft-deleting a record
     await softDelete(prisma.employee, employeeId);

     // Restoring a record
     await restore(prisma.employee, employeeId);
   ═══════════════════════════════════════════════════════════════ */

/**
 * Spread into any `where` clause to exclude soft-deleted records.
 *
 * ```ts
 * prisma.employee.findMany({ where: { workspaceId, ...notDeleted } })
 * ```
 */
export const notDeleted = { deletedAt: null } as const;

/**
 * Soft-delete a single record by setting `deletedAt` to now.
 *
 * @param model - A Prisma delegate with `update()` (e.g. `prisma.employee`)
 * @param id    - The record's primary key
 */
export async function softDelete(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any,
  id: string,
) {
  return model.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

/**
 * Restore a soft-deleted record.
 */
export async function restore(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any,
  id: string,
) {
  return model.update({
    where: { id },
    data: { deletedAt: null },
  });
}
