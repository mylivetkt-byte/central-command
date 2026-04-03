-- Combined migration for secure delivery system
-- Run this single migration to set up all security policies

BEGIN;

-- 1. Create the secure view for pending delivery offers
CREATE VIEW IF NOT EXISTS public.pending_delivery_offers AS
SELECT 
  d.id,
  d.order_id,
  d.pickup_address,
  d.pickup_lat,
  d.pickup_lng,
  d.delivery_address,
  d.delivery_lat,
  d.delivery_lng,
  d.amount,
  d.commission,
  d.estimated_time,
  d.zone,
  d.status,
  d.created_at
FROM public.deliveries d
WHERE d.status = 'pendiente';

-- 2. Grant access to the view for drivers
GRANT SELECT ON public.pending_delivery_offers TO authenticated;

-- 3. Create RLS policies for the view (drop first if exists)
DROP POLICY IF EXISTS "Drivers can read pending offers" ON public.pending_delivery_offers;
CREATE POLICY "Drivers can read pending offers" ON public.pending_delivery_offers
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'driver'));

-- 4. Clean up old delivery policies if they exist (ignore errors)
DO $$
BEGIN
  DROP POLICY IF EXISTS "Drivers can read pending deliveries" ON public.deliveries;
EXCEPTION WHEN undefined_object THEN
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Drivers can read own deliveries" ON public.deliveries;
EXCEPTION WHEN undefined_object THEN
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Drivers can accept deliveries" ON public.deliveries;
EXCEPTION WHEN undefined_object THEN
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Drivers can update own deliveries" ON public.deliveries;
EXCEPTION WHEN undefined_object THEN
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Admins can read all deliveries" ON public.deliveries;
EXCEPTION WHEN undefined_object THEN
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Admins can manage all deliveries" ON public.deliveries;
EXCEPTION WHEN undefined_object THEN
END $$;

-- 5. Create proper RLS policies for deliveries table
CREATE POLICY "Admins full access deliveries" ON public.deliveries
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Drivers read own deliveries" ON public.deliveries
  FOR SELECT TO authenticated
  USING (
    driver_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Drivers accept deliveries" ON public.deliveries
  FOR UPDATE TO authenticated
  USING (
    status = 'pendiente' AND 
    public.has_role(auth.uid(), 'driver')
  );

CREATE POLICY "Drivers update own deliveries" ON public.deliveries
  FOR UPDATE TO authenticated
  USING (
    driver_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
  );

-- 6. Disable realtime for sensitive tables (ignore if not in publication)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime REMOVE TABLE IF EXISTS public.deliveries;
EXCEPTION WHEN undefined_table THEN
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime REMOVE TABLE IF EXISTS public.driver_locations;
EXCEPTION WHEN undefined_table THEN
END $$;

COMMIT;
