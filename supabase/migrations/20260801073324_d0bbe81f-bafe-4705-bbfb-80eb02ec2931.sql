CREATE TABLE public.app_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_code text NOT NULL,
  email text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  note text,
  revoked_at timestamptz,
  revoked_by_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_code, email)
);

GRANT ALL ON public.app_access TO service_role;
ALTER TABLE public.app_access ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER app_access_set_updated_at
BEFORE UPDATE ON public.app_access
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();