-- ============================================================
-- FIX MIGRATION: Re-add deliveries to realtime + fix RLS
-- Run this in Supabase SQL Editor if the previous migrations
-- left deliveries outside supabase_realtime.
-- ============================================================

-- 1. Re-add deliveries to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.deliveries;

-- 2. Recreate pending_delivery_offers view with proper grants
DROP VIEW IF EXISTS public.pending_delivery_offers;

CREATE OR REPLACE VIEW public.pending_delivery_offers AS
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
WHERE d.status = 'pendiente'
  AND d.driver_id IS NULL;

GRANT SELECT ON public.pending_delivery_offers TO authenticated;

-- 3. RLS policies for pending_delivery_offers
DROP POLICY IF EXISTS "Drivers can read pending offers" ON public.pending_delivery_offers;
CREATE POLICY "Drivers can read pending offers" ON public.pending_delivery_offers
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'driver'));

-- 4. Clean up conflicting policies on deliveries table
-- Drop all duplicate policies first
DROP POLICY IF EXISTS "Drivers read pending" ON public.deliveries;
DROP POLICY IF EXISTS "Drivers read own" ON public.deliveries;
DROP POLICY IF EXISTS "Drivers accept" ON public.deliveries;
DROP POLICY IF EXISTS "Drivers update own" ON public.deliveries;
DROP POLICY IF EXISTS "Admins manage deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Admins full access deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Drivers read own deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Drivers accept deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Drivers update own deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Drivers can claim pending deliveries" ON public.deliveries;

-- 5. Create clean, non-duplicate policies
-- Admins: full access
CREATE POLICY "admin_all_deliveries" ON public.deliveries
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Drivers: read pending (for the view fallback)
CREATE POLICY "driver_read_pending" ON public.deliveries
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'driver')
    AND status = 'pendiente'
    AND driver_id IS NULL
  );

-- Drivers: read own deliveries
CREATE POLICY "driver_read_own" ON public.deliveries
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'driver')
    AND driver_id = auth.uid()
  );

-- Drivers: accept pending (claim)
CREATE POLICY "driver_accept_pending" ON public.deliveries
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'driver')
    AND status = 'pendiente'
    AND driver_id IS NULL
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'driver')
    AND status = 'aceptado'
    AND driver_id = auth.uid()
  );

-- Drivers: update own (status transitions)
CREATE POLICY "driver_update_own" ON public.deliveries
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'driver')
    AND driver_id = auth.uid()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'driver')
    AND driver_id = auth.uid()
  );

-- 6. Ensure driver_locations is also in realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'driver_locations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_locations;
  END IF;
END
$$;

-- 7. Verify (run manually to check)
-- SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
-- SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('deliveries', 'pending_delivery_offers');
