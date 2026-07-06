-- ============================================================
-- FIX: RLS policies permiten company_id IS NULL (datos existentes)
-- ============================================================

-- Helper reutilizable para check company access (incluye NULL)
CREATE OR REPLACE FUNCTION public.user_can_access_company(record_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    record_company_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.user_id = auth.uid()
      AND cu.company_id = record_company_id
    );
$$;

-- Fix deliveries
DROP POLICY IF EXISTS "user company deliveries" ON public.deliveries;
CREATE POLICY "user company deliveries" ON public.deliveries
  FOR ALL TO authenticated
  USING (public.user_can_access_company(company_id))
  WITH CHECK (public.user_can_access_company(company_id));

-- Fix driver_profiles
DROP POLICY IF EXISTS "user company driver_profiles" ON public.driver_profiles;
CREATE POLICY "user company driver_profiles" ON public.driver_profiles
  FOR ALL TO authenticated
  USING (public.user_can_access_company(company_id))
  WITH CHECK (public.user_can_access_company(company_id));

-- Fix driver_locations
DROP POLICY IF EXISTS "user company driver_locations" ON public.driver_locations;
CREATE POLICY "user company driver_locations" ON public.driver_locations
  FOR ALL TO authenticated
  USING (public.user_can_access_company(company_id))
  WITH CHECK (public.user_can_access_company(company_id));

-- Fix chat_messages
DROP POLICY IF EXISTS "user company chat_messages" ON public.chat_messages;
CREATE POLICY "user company chat_messages" ON public.chat_messages
  FOR ALL TO authenticated
  USING (public.user_can_access_company(company_id))
  WITH CHECK (public.user_can_access_company(company_id));

-- Fix delivery_audit_log
DROP POLICY IF EXISTS "user company delivery_audit_log" ON public.delivery_audit_log;
CREATE POLICY "user company delivery_audit_log" ON public.delivery_audit_log
  FOR ALL TO authenticated
  USING (public.user_can_access_company(company_id))
  WITH CHECK (public.user_can_access_company(company_id));

-- Fix alerts
DROP POLICY IF EXISTS "user company alerts" ON public.alerts;
CREATE POLICY "user company alerts" ON public.alerts
  FOR ALL TO authenticated
  USING (public.user_can_access_company(company_id))
  WITH CHECK (public.user_can_access_company(company_id));
