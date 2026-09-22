
-- Drop overly permissive USING(true)/WITH CHECK(true) policies on tenant-scoped tables.
DROP POLICY IF EXISTS "bank_accounts delete all authenticated" ON public.bank_accounts;
DROP POLICY IF EXISTS "bank_accounts insert all authenticated" ON public.bank_accounts;
DROP POLICY IF EXISTS "bank_accounts read all authenticated"   ON public.bank_accounts;
DROP POLICY IF EXISTS "bank_accounts update all authenticated" ON public.bank_accounts;

DROP POLICY IF EXISTS "lc_amendments delete all authenticated" ON public.facility_lc_amendments;
DROP POLICY IF EXISTS "lc_amendments insert all authenticated" ON public.facility_lc_amendments;
DROP POLICY IF EXISTS "lc_amendments read all authenticated"   ON public.facility_lc_amendments;
DROP POLICY IF EXISTS "lc_amendments update all authenticated" ON public.facility_lc_amendments;

DROP POLICY IF EXISTS "facility_transactions delete all authenticated" ON public.facility_transactions;
DROP POLICY IF EXISTS "facility_transactions insert all authenticated" ON public.facility_transactions;
DROP POLICY IF EXISTS "facility_transactions read all authenticated"   ON public.facility_transactions;
DROP POLICY IF EXISTS "facility_transactions update all authenticated" ON public.facility_transactions;

-- Ensure RLS stays enabled (fail-closed for anon/authenticated); service_role bypasses RLS.
ALTER TABLE public.bank_accounts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_lc_amendments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_transactions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_transactions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_snapshots         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facilities              ENABLE ROW LEVEL SECURITY;

-- Revoke Data API privileges from anon/authenticated so PostgREST cannot reach these tables
-- even if a permissive policy is later added by accident. All access is via server routes
-- using the service_role client, which retains full privileges.
REVOKE ALL ON public.bank_accounts          FROM anon, authenticated;
REVOKE ALL ON public.facility_lc_amendments FROM anon, authenticated;
REVOKE ALL ON public.facility_transactions  FROM anon, authenticated;
REVOKE ALL ON public.cash_transactions      FROM anon, authenticated;
REVOKE ALL ON public.daily_snapshots        FROM anon, authenticated;
REVOKE ALL ON public.facilities             FROM anon, authenticated;

GRANT ALL ON public.bank_accounts          TO service_role;
GRANT ALL ON public.facility_lc_amendments TO service_role;
GRANT ALL ON public.facility_transactions  TO service_role;
GRANT ALL ON public.cash_transactions      TO service_role;
GRANT ALL ON public.daily_snapshots        TO service_role;
GRANT ALL ON public.facilities             TO service_role;
