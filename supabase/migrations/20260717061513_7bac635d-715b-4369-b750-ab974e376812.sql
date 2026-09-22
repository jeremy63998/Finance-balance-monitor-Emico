CREATE TABLE public.facility_lc_amendments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_code text NOT NULL,
  lc_txn_id uuid NOT NULL REFERENCES public.facility_transactions(id) ON DELETE CASCADE,
  txn_date date NOT NULL,
  currency text NOT NULL DEFAULT 'MYR',
  interest_amount numeric NOT NULL DEFAULT 0,
  postage_amount numeric NOT NULL DEFAULT 0,
  charges_amount numeric NOT NULL DEFAULT 0,
  settlement_bank_account_id uuid,
  settlement_bank_account_name text,
  settlement_bank_account_number text,
  cash_txn_id uuid,
  settled_at timestamptz,
  remarks text,
  entered_by text,
  entered_by_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.facility_lc_amendments TO authenticated;
GRANT ALL ON public.facility_lc_amendments TO service_role;

ALTER TABLE public.facility_lc_amendments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lc_amendments read all authenticated" ON public.facility_lc_amendments FOR SELECT TO authenticated USING (true);
CREATE POLICY "lc_amendments insert all authenticated" ON public.facility_lc_amendments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "lc_amendments update all authenticated" ON public.facility_lc_amendments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "lc_amendments delete all authenticated" ON public.facility_lc_amendments FOR DELETE TO authenticated USING (true);

CREATE INDEX facility_lc_amendments_lc_txn_id_idx ON public.facility_lc_amendments(lc_txn_id);
CREATE INDEX facility_lc_amendments_tenant_idx ON public.facility_lc_amendments(tenant_code);