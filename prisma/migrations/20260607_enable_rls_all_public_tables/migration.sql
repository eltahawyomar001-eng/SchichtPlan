-- ════════════════════════════════════════════════════════════════════════
-- Secure-by-default: enable Row Level Security on every public base table.
-- ════════════════════════════════════════════════════════════════════════
-- Why: tables in the `public` schema are reachable through Supabase's
-- PostgREST Data API. A table WITHOUT RLS is world-readable/writable by
-- anyone holding the (publishable) anon key. Shiftfy does not use PostgREST
-- (all access is Prisma over the Supavisor pooler, which connects as a
-- BYPASSRLS role), so enabling RLS with NO policy = deny-all for any
-- PostgREST/anon/authenticated caller while the application's bypassing role
-- keeps full access. This is the documented Supabase hardening pattern and
-- closes the `rls_disabled_in_public` advisor finding.
--
-- This migration is IDEMPOTENT and was a no-op on production at author time
-- (RLS had already been enabled out-of-band). Its purpose is INFRASTRUCTURE
-- AS CODE: any fresh database, CI shadow DB, or Supabase branch built from
-- migrations is now locked down the same way as production.
--
-- Note: ENABLE (not FORCE) ROW LEVEL SECURITY — the app role has BYPASSRLS,
-- so FORCE would be irrelevant to it; ENABLE is the minimal correct change.
-- New tables created by future migrations should add their own ENABLE RLS.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'              -- ordinary tables only
      AND c.relrowsecurity = false     -- skip already-enabled (idempotent)
      AND c.relname <> '_prisma_migrations'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;',
      r.relname
    );
  END LOOP;
END $$;
