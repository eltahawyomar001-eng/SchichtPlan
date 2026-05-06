-- Add HMAC-hashed PIN field for QR station attendance (no buddy-punching)
ALTER TABLE "Employee" ADD COLUMN "pinHash" TEXT;

-- Unique per workspace: two employees in the same workspace cannot share a PIN.
-- NULLs are excluded from uniqueness checks in PostgreSQL, so employees without
-- a PIN assigned yet do not conflict with each other.
CREATE UNIQUE INDEX "Employee_workspaceId_pinHash_key" ON "Employee"("workspaceId", "pinHash");
