-- The exact instant a break began. See schema comment for why a "HH:MM"
-- string cannot survive a DST transition. Additive and nullable, so existing
-- rows keep working through the string path.
ALTER TABLE "TimeEntry" ADD COLUMN "breakStartAt" TIMESTAMP(3);
