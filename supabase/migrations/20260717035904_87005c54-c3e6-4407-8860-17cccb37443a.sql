
-- Cash transactions
CREATE TABLE public.cash_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_code text NOT NULL,
  txn_date date NOT NULL,
  txn_type text NOT NULL CHECK (txn_type IN ('deposit','withdrawal','transfer')),
  amount numeric(18,2) NOT NULL,
  bank_account_name text NOT NULL,
  bank_account_number text,
  currency text NOT NULL DEFAULT 'MYR',
  remarks text,
  entered_by text,
  entered_by_email text,
  supersedes_id uuid REFERENCES public.cash_transactions(id) ON DELETE SET NULL,
  is_superseded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cash_txn_tenant_date_idx ON public.cash_transactions(tenant_code, txn_date DESC);
GRANT ALL ON public.cash_transactions TO service_role;
ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;

-- Facilities
CREATE TABLE public.facilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_code text NOT NULL,
  name text NOT NULL,
  lending_bank text NOT NULL,
  facility_type text NOT NULL CHECK (facility_type IN ('revolving_credit','term_loan','overdraft','other')),
  total_limit numeric(18,2) NOT NULL DEFAULT 0,
  amount_drawn numeric(18,2) NOT NULL DEFAULT 0,
  amount_repaid numeric(18,2) NOT NULL DEFAULT 0,
  maturity_date date,
  interest_rate numeric(6,3),
  currency text NOT NULL DEFAULT 'MYR',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','matured','cancelled')),
  remarks text,
  entered_by text,
  entered_by_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX facilities_tenant_idx ON public.facilities(tenant_code);
GRANT ALL ON public.facilities TO service_role;
ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER facilities_updated_at BEFORE UPDATE ON public.facilities
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Daily snapshots (Phase 2 support; safe to write from Phase 1)
CREATE TABLE public.daily_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_code text NOT NULL,
  snapshot_date date NOT NULL,
  total_cash numeric(18,2) NOT NULL DEFAULT 0,
  total_facility_limit numeric(18,2) NOT NULL DEFAULT 0,
  total_drawn numeric(18,2) NOT NULL DEFAULT 0,
  total_available numeric(18,2) NOT NULL DEFAULT 0,
  net_liquidity numeric(18,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_code, snapshot_date)
);
GRANT ALL ON public.daily_snapshots TO service_role;
ALTER TABLE public.daily_snapshots ENABLE ROW LEVEL SECURITY;
