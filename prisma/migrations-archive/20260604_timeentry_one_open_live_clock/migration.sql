-- Enforce: at most ONE open live-clock entry per employee.
-- Applied 2026-06-04 via Supabase MCP (apply_migration), mirrored here so
-- `prisma migrate deploy` stays consistent across environments.
--
-- Why: the clock-in handler used findFirst()-then-create() inside a default
-- READ COMMITTED transaction. Two concurrent punches (double-tap kiosk, retry)
-- could both see "no open entry" and both insert, corrupting time data and
-- payroll. A partial unique index is the authoritative guard and protects
-- every clock-in path (web, QR, station). The losing insert raises 23505,
-- surfaced by Prisma as P2002 and mapped to a 409 by the route.
--
-- Prisma cannot express a partial/filtered unique index in schema.prisma, so
-- this lives as raw SQL. It is additive; `migrate deploy` never drops it.
CREATE UNIQUE INDEX IF NOT EXISTS "TimeEntry_one_open_live_clock_per_employee"
ON "TimeEntry" ("employeeId")
WHERE "isLiveClock" AND "clockOutAt" IS NULL;
