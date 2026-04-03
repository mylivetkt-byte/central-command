-- Secure delivery system with column-level security
-- This migration creates:
-- 1. A secure view for pending delivery offers (limited fields)
-- 2. Proper RLS policies that restrict data exposure

-- First, drop any existing delivery policies
DROP POLICY IF EXISTS "Drivers can read pending deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Drivers can read own deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Drivers can accept deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Drivers can update own deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Admins can read all deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Admins can manage all deliveries" ON public.deliveries;

-- Create a secure view for pending delivery offers
-- Only exposes fields drivers need BEFORE accepting a job
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
WHERE d.status = 'pendiente';

-- Grant read access to authenticated users with driver role
-- This view can be read by any authenticated user with driver role
CREATE POLICY "Drivers can read pending offers" ON public.pending_delivery_offers
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'driver'));

-- Now set up policies on the main deliveries table

-- Admins have full access
CREATE POLICY "Admins full access deliveries" ON public.deliveries
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Drivers can read their OWN deliveries (assigned to them)
CREATE POLICY "Drivers read own deliveries" ON public.deliveries
  FOR SELECT TO authenticated
  USING (
    driver_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
  );

-- Drivers can ACCEPT pending deliveries (update status)
CREATE POLICY "Drivers accept deliveries" ON public.deliveries
  FOR UPDATE TO authenticated
  USING (
    status = 'pendiente' AND 
    public.has_role(auth.uid(), 'driver')
  );

-- Drivers can update their OWN deliveries (change status to en_camino, entregado)
CREATE POLICY "Drivers update own deliveries" ON public.deliveries
  FOR UPDATE TO authenticated
  USING (
    driver_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
  );
