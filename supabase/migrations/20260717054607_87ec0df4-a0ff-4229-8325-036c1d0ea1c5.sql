ALTER TABLE public.facility_transactions
  ADD COLUMN IF NOT EXISTS postage_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS postage_timing text,
  ADD COLUMN IF NOT EXISTS postage_cash_txn_id uuid,
  ADD COLUMN IF NOT EXISTS postage_settled_at timestamptz,
  ADD COLUMN IF NOT EXISTS charges_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS charges_timing text,
  ADD COLUMN IF NOT EXISTS charges_cash_txn_id uuid,
  ADD COLUMN IF NOT EXISTS charges_settled_at timestamptz;

ALTER TABLE public.facility_transactions
  DROP CONSTRAINT IF EXISTS facility_transactions_postage_timing_check;
ALTER TABLE public.facility_transactions
  ADD CONSTRAINT facility_transactions_postage_timing_check
  CHECK (postage_timing IS NULL OR postage_timing IN ('immediate','maturity'));

ALTER TABLE public.facility_transactions
  DROP CONSTRAINT IF EXISTS facility_transactions_charges_timing_check;
ALTER TABLE public.facility_transactions
  ADD CONSTRAINT facility_transactions_charges_timing_check
  CHECK (charges_timing IS NULL OR charges_timing IN ('immediate','maturity'));