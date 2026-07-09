
CREATE TABLE public.driver_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.saas_companies(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_push_subscriptions TO authenticated;
GRANT ALL ON public.driver_push_subscriptions TO service_role;

ALTER TABLE public.driver_push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers manage their own push subscriptions"
  ON public.driver_push_subscriptions
  FOR ALL
  TO authenticated
  USING (driver_id = auth.uid())
  WITH CHECK (driver_id = auth.uid());

CREATE INDEX idx_dps_company_driver ON public.driver_push_subscriptions(company_id, driver_id);
