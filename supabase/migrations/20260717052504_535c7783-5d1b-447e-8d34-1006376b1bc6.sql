
CREATE TABLE public.facility_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_code text NOT NULL,
  facility_id uuid,
  facility_name text NOT NULL,
  lending_bank text NOT NULL,
  txn_date date NOT NULL,
  txn_type text NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'MYR',
  remarks text,
  entered_by text,
  entered_by_email text,
  is_superseded boolean NOT NULL DEFAULT false,
  supersedes_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.facility_transactions TO authenticated;
GRANT ALL ON public.facility_transactions TO service_role;

ALTER TABLE public.facility_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "facility_transactions read all authenticated"
  ON public.facility_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "facility_transactions insert all authenticated"
  ON public.facility_transactions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "facility_transactions update all authenticated"
  ON public.facility_transactions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "facility_transactions delete all authenticated"
  ON public.facility_transactions FOR DELETE TO authenticated USING (true);

CREATE INDEX facility_transactions_tenant_date_idx
  ON public.facility_transactions (tenant_code, txn_date DESC);
CREATE INDEX facility_transactions_facility_idx
  ON public.facility_transactions (facility_id);
