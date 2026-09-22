ALTER TABLE public.facility_transactions
  ADD COLUMN IF NOT EXISTS interest_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS interest_timing text,
  ADD COLUMN IF NOT EXISTS interest_cash_txn_id uuid,
  ADD COLUMN IF NOT EXISTS interest_settled_at timestamptz;

ALTER TABLE public.facility_transactions
  DROP CONSTRAINT IF EXISTS facility_transactions_interest_timing_check;
ALTER TABLE public.facility_transactions
  ADD CONSTRAINT facility_transactions_interest_timing_check
  CHECK (interest_timing IS NULL OR interest_timing IN ('immediate','maturity'));