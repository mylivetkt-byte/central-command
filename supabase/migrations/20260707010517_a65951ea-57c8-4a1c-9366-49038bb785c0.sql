
-- 1) Auto-fill company_id on deliveries insert
CREATE OR REPLACE FUNCTION public.set_delivery_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NULL AND auth.uid() IS NOT NULL THEN
    NEW.company_id := (
      SELECT company_id FROM public.company_users
      WHERE user_id = auth.uid() LIMIT 1
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_delivery_company_id ON public.deliveries;
CREATE TRIGGER trg_set_delivery_company_id
BEFORE INSERT ON public.deliveries
FOR EACH ROW EXECUTE FUNCTION public.set_delivery_company_id();

-- 2) Auto-fill company_id on driver_profiles insert
CREATE OR REPLACE FUNCTION public.set_driver_profile_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := (
      SELECT company_id FROM public.company_users
      WHERE user_id = NEW.id LIMIT 1
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_driver_profile_company_id ON public.driver_profiles;
CREATE TRIGGER trg_set_driver_profile_company_id
BEFORE INSERT ON public.driver_profiles
FOR EACH ROW EXECUTE FUNCTION public.set_driver_profile_company_id();

-- 3) Tighten user_can_access_company: NULL company_id no longer bypasses isolation
CREATE OR REPLACE FUNCTION public.user_can_access_company(record_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_super_admin(auth.uid())
    OR (
      record_company_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.company_users cu
        WHERE cu.user_id = auth.uid()
          AND cu.company_id = record_company_id
      )
    );
$$;

-- 4) Deliveries: replace blanket admin policies with company-scoped ones
DROP POLICY IF EXISTS "Admins can manage all deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Admins can insert deliveries" ON public.deliveries;

CREATE POLICY "Admins manage own company deliveries"
ON public.deliveries
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND public.user_can_access_company(company_id)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND public.user_can_access_company(company_id)
);

-- Drivers: only see pending deliveries from their own company
DROP POLICY IF EXISTS "Drivers can read assigned deliveries" ON public.deliveries;
CREATE POLICY "Drivers can read assigned deliveries"
ON public.deliveries
FOR SELECT
TO authenticated
USING (
  driver_id = auth.uid()
  OR (
    status = 'pendiente'::delivery_status
    AND public.has_role(auth.uid(), 'driver'::app_role)
    AND company_id = public.get_user_company_id()
  )
);

-- 5) Driver profiles: replace blanket admin policy with company-scoped
DROP POLICY IF EXISTS "Admins can manage all driver profiles" ON public.driver_profiles;
CREATE POLICY "Admins manage own company driver profiles"
ON public.driver_profiles
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND public.user_can_access_company(company_id)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND public.user_can_access_company(company_id)
);

-- 6) Rebuild pending_delivery_offers view scoped to driver's company
DROP VIEW IF EXISTS public.pending_delivery_offers;
CREATE VIEW public.pending_delivery_offers
WITH (security_invoker=on) AS
SELECT
  d.id, d.order_id, d.pickup_address, d.delivery_address,
  d.pickup_lat, d.pickup_lng, d.delivery_lat, d.delivery_lng,
  d.amount, d.commission, d.estimated_time, d.status, d.zone,
  d.company_id, d.created_at
FROM public.deliveries d
WHERE d.status = 'pendiente'::delivery_status
  AND d.driver_id IS NULL;

GRANT SELECT ON public.pending_delivery_offers TO authenticated;
