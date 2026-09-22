CREATE TABLE public.expected_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_code TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'receivable',
  due_date DATE NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'MYR',
  counterparty TEXT,
  bank_account_id UUID,
  bank_account_name TEXT,
  bank_account_number TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  settled_at TIMESTAMPTZ,
  cash_txn_id UUID,
  remarks TEXT,
  entered_by TEXT,
  entered_by_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX expected_transactions_tenant_due_idx ON public.expected_transactions (tenant_code, due_date);

GRANT ALL ON public.expected_transactions TO service_role;

ALTER TABLE public.expected_transactions ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER expected_transactions_set_updated_at
BEFORE UPDATE ON public.expected_transactions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();