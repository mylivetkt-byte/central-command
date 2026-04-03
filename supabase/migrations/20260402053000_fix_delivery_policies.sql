-- Fix RLS policies for deliveries to properly handle roles
-- Drop existing delivery policies
DROP POLICY IF EXISTS "Drivers can read pending deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Drivers can read own deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Drivers can accept deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Drivers can update own deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Admins can read all deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Admins can manage all deliveries" ON public.deliveries;

-- Admins can do everything
CREATE POLICY "Admins manage deliveries" ON public.deliveries
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Drivers can read pending deliveries (with role check)
CREATE POLICY "Drivers read pending" ON public.deliveries
  FOR SELECT TO authenticated
  USING (
    status = 'pendiente' AND 
    (public.has_role(auth.uid(), 'driver') OR public.has_role(auth.uid(), 'admin'))
  );

-- Drivers can read their own deliveries
CREATE POLICY "Drivers read own" ON public.deliveries
  FOR SELECT TO authenticated
  USING (
    driver_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
  );

-- Drivers can accept pending deliveries
CREATE POLICY "Drivers accept" ON public.deliveries
  FOR UPDATE TO authenticated
  USING (
    status = 'pendiente' AND 
    (public.has_role(auth.uid(), 'driver') OR public.has_role(auth.uid(), 'admin'))
  );

-- Drivers can update their own deliveries
CREATE POLICY "Drivers update own" ON public.deliveries
  FOR UPDATE TO authenticated
  USING (
    driver_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
  );

-- Allow anon for INSERT (will be filtered by app)
-- This is needed for the initial insert from admin panel
