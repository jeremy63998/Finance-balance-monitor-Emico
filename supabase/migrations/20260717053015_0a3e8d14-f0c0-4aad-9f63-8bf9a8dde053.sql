
ALTER TABLE public.facility_transactions
  ADD COLUMN IF NOT EXISTS maturity_date date,
  ADD COLUMN IF NOT EXISTS settlement_bank_account_id uuid,
  ADD COLUMN IF NOT EXISTS settlement_bank_account_name text,
  ADD COLUMN IF NOT EXISTS settlement_bank_account_number text,
  ADD COLUMN IF NOT EXISTS settled_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS settlement_cash_txn_id uuid,
  ADD COLUMN IF NOT EXISTS settlement_repayment_txn_id uuid;

CREATE INDEX IF NOT EXISTS facility_transactions_maturity_idx
  ON public.facility_transactions (tenant_code, maturity_date)
  WHERE txn_type = 'drawdown' AND settled_at IS NULL;
