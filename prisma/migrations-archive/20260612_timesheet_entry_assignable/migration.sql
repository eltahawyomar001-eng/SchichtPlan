-- Make timesheet staging entries assignable: a row can be staged without a
-- matched employee (auto-match failed) and assigned by the manager in Review.

-- Allow unassigned entries.
ALTER TABLE "TimesheetImportEntry" ALTER COLUMN "employeeId" DROP NOT NULL;

-- Remember the raw extracted name so the manager can assign the right person.
ALTER TABLE "TimesheetImportEntry" ADD COLUMN "extractedName" TEXT;

-- Employee deletion should null the staged link (not cascade-delete the row).
ALTER TABLE "TimesheetImportEntry" DROP CONSTRAINT "TimesheetImportEntry_employeeId_fkey";
ALTER TABLE "TimesheetImportEntry" ADD CONSTRAINT "TimesheetImportEntry_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
