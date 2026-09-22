ALTER TABLE public.facility_lc_amendments
  ADD COLUMN IF NOT EXISTS new_amount numeric,
  ADD COLUMN IF NOT EXISTS previous_amount numeric,
  ADD COLUMN IF NOT EXISTS new_maturity_date date,
  ADD COLUMN IF NOT EXISTS previous_maturity_date date;