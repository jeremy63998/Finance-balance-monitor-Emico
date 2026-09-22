CREATE TABLE public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_code text NOT NULL,
  bank_name text NOT NULL,
  account_name text NOT NULL,
  account_number text NOT NULL,
  currency text NOT NULL DEFAULT 'MYR',
  is_active boolean NOT NULL DEFAULT true,
  remarks text,
  entered_by text,
  entered_by_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_accounts TO authenticated;
GRANT ALL ON public.bank_accounts TO service_role;

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_accounts read all authenticated" ON public.bank_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "bank_accounts insert all authenticated" ON public.bank_accounts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "bank_accounts update all authenticated" ON public.bank_accounts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "bank_accounts delete all authenticated" ON public.bank_accounts FOR DELETE TO authenticated USING (true);

CREATE TRIGGER bank_accounts_set_updated_at
BEFORE UPDATE ON public.bank_accounts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX bank_accounts_tenant_idx ON public.bank_accounts(tenant_code);