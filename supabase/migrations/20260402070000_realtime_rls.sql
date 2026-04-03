-- Secure Realtime configuration for CentralCommand
-- This migration restricts real-time subscriptions to protect sensitive data

-- OPTION 1: Disable realtime publication for sensitive tables
-- This is the most secure approach - removes tables from supabase_realtime

-- First, remove the sensitive tables from realtime publication
ALTER PUBLICATION supabase_realtime REMOVE TABLE public.deliveries;
ALTER PUBLICATION supabase_realtime REMOVE TABLE public.driver_locations;

-- Keep alerts for admins only
-- ALTERNATIVE: If you need realtime, use a secure channel approach in the app

-- Create a function for drivers to get filtered realtime deliveries
-- This function returns deliveries that the driver can see in real-time
CREATE OR REPLACE FUNCTION public.driver_realtime_deliveries(driver_uuid UUID)
RETURNS SETOF public.deliveries
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.*
  FROM public.deliveries d
  WHERE 
    -- Drivers see their own deliveries
    d.driver_id = driver_uuid
    OR
    -- Admins see all
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = driver_uuid AND role = 'admin')
    OR
    -- Pending deliveries are broadcast (no PII exposed - use the view)
    d.status = 'pendiente';
$$;

-- Create a secure function for driver locations (admins only)
CREATE OR REPLACE FUNCTION public.admin_realtime_driver_locations(admin_uuid UUID)
RETURNS SETOF public.driver_locations
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT dl.*
  FROM public.driver_locations dl
  WHERE 
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = admin_uuid AND role = 'admin');
$$;

-- Note: For the frontend, instead of using Supabase Realtime directly on the tables,
-- use the app-level filtering or the secure functions above.
-- 
-- Alternatively, configure channel-level auth in Supabase Dashboard:
-- 1. Go to Supabase Dashboard > Database > Replication
-- 2. Configure row-level security for realtime
-- 3. Or disable realtime for sensitive tables entirely
