-- ============================================================
-- SAAS COMPLETE COMPANY DELETION RPC
-- ============================================================

CREATE OR REPLACE FUNCTION public.delete_company_completely(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- 1. Verificar que el ejecutor sea Super Admin
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access Denied';
  END IF;

  -- 2. Eliminar usuarios asociados a la empresa de auth.users
  -- Borrar los administradores de company_users
  FOR v_user_id IN (SELECT user_id FROM public.company_users WHERE company_id = p_company_id) LOOP
    DELETE FROM auth.users WHERE id = v_user_id;
  END LOOP;

  -- Borrar los conductores de driver_profiles
  FOR v_user_id IN (SELECT id FROM public.driver_profiles WHERE company_id = p_company_id) LOOP
    DELETE FROM auth.users WHERE id = v_user_id;
  END LOOP;

  -- 3. Borrar todos los datos de las tablas operativas de la empresa
  DELETE FROM public.chat_messages WHERE company_id = p_company_id;
  DELETE FROM public.delivery_audit_log WHERE company_id = p_company_id;
  DELETE FROM public.driver_locations WHERE company_id = p_company_id;
  DELETE FROM public.alerts WHERE company_id = p_company_id;
  DELETE FROM public.deliveries WHERE company_id = p_company_id;
  DELETE FROM public.driver_profiles WHERE company_id = p_company_id;
  DELETE FROM public.company_users WHERE company_id = p_company_id;
  DELETE FROM public.saas_payments WHERE company_id = p_company_id;

  -- 4. Borrar la empresa de saas_companies
  DELETE FROM public.saas_companies WHERE id = p_company_id;

  RETURN TRUE;
END;
$$;
