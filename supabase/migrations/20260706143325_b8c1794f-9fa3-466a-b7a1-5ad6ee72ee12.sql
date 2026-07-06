
-- 1. Fix pending deliveries PII exposure - restrict to drivers only
DROP POLICY IF EXISTS "Drivers can read assigned deliveries" ON public.deliveries;
CREATE POLICY "Drivers can read assigned deliveries"
ON public.deliveries FOR SELECT
TO authenticated
USING (
  driver_id = auth.uid()
  OR (
    status = 'pendiente'::delivery_status
    AND public.has_role(auth.uid(), 'driver'::app_role)
  )
);

-- 2. Fix missing WITH CHECK on driver update policy - prevent tampering with financial fields
DROP POLICY IF EXISTS "Drivers can update assigned deliveries" ON public.deliveries;
CREATE POLICY "Drivers can update assigned deliveries"
ON public.deliveries FOR UPDATE
TO authenticated
USING (driver_id = auth.uid())
WITH CHECK (
  driver_id = auth.uid()
  AND status IN ('aceptado'::delivery_status, 'en_camino'::delivery_status, 'entregado'::delivery_status, 'cancelado'::delivery_status)
);

-- Trigger to lock immutable financial/identity fields on driver updates
CREATE OR REPLACE FUNCTION public.protect_delivery_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins bypass
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.amount IS DISTINCT FROM OLD.amount
     OR NEW.commission IS DISTINCT FROM OLD.commission
     OR NEW.driver_id IS DISTINCT FROM OLD.driver_id
     OR NEW.order_id IS DISTINCT FROM OLD.order_id
     OR NEW.customer_name IS DISTINCT FROM OLD.customer_name
     OR NEW.customer_phone IS DISTINCT FROM OLD.customer_phone
     OR NEW.pickup_address IS DISTINCT FROM OLD.pickup_address
     OR NEW.delivery_address IS DISTINCT FROM OLD.delivery_address
     OR NEW.pickup_lat IS DISTINCT FROM OLD.pickup_lat
     OR NEW.pickup_lng IS DISTINCT FROM OLD.pickup_lng
     OR NEW.delivery_lat IS DISTINCT FROM OLD.delivery_lat
     OR NEW.delivery_lng IS DISTINCT FROM OLD.delivery_lng
  THEN
    RAISE EXCEPTION 'Drivers cannot modify financial or identity fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_delivery_fields ON public.deliveries;
CREATE TRIGGER trg_protect_delivery_fields
BEFORE UPDATE ON public.deliveries
FOR EACH ROW EXECUTE FUNCTION public.protect_delivery_fields();

-- 3. Audit log integrity - remove open INSERT policy, require validated function
DROP POLICY IF EXISTS "Drivers can insert audit entries" ON public.delivery_audit_log;

CREATE OR REPLACE FUNCTION public.insert_driver_audit_entry(
  p_delivery_id uuid,
  p_event text,
  p_details text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.deliveries
    WHERE id = p_delivery_id AND driver_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to audit this delivery';
  END IF;

  IF p_event NOT IN ('accepted','picked_up','delivered','cancelled','rejected','issue_reported','location_update') THEN
    RAISE EXCEPTION 'Invalid event type: %', p_event;
  END IF;

  INSERT INTO public.delivery_audit_log(delivery_id, performed_by, event, details)
  VALUES (p_delivery_id, auth.uid(), p_event, p_details);
END;
$$;

REVOKE ALL ON FUNCTION public.insert_driver_audit_entry(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.insert_driver_audit_entry(uuid, text, text) TO authenticated;

-- 4. Add profiles INSERT policy for own profile
CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- 5. Fix mutable search_path on set_updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 6. Lock down SECURITY DEFINER functions - revoke from public/anon
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.get_my_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

REVOKE ALL ON FUNCTION public.get_driver_stats(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_driver_stats(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated;
