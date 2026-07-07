-- ============================================================
-- SAAS BLOCK INACTIVE & SUSPENDED COMPANIES LOGINS
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_company_id UUID;
  v_company_status TEXT;
BEGIN
  -- 1. Obtener el rol del usuario
  SELECT role::TEXT INTO v_role
  FROM public.user_roles
  WHERE user_id = auth.uid()
  LIMIT 1;

  -- Si no tiene rol, retornar null
  IF v_role IS NULL THEN
    RETURN NULL;
  END IF;

  -- 2. Si es super_admin, no tiene restricciones de empresa
  IF v_role = 'super_admin' THEN
    RETURN v_role;
  END IF;

  -- 3. Obtener el company_id del usuario
  -- Si es admin
  SELECT company_id INTO v_company_id 
  FROM public.company_users 
  WHERE user_id = auth.uid() 
  LIMIT 1;

  -- Si es driver
  IF v_company_id IS NULL THEN
    SELECT company_id INTO v_company_id 
    FROM public.driver_profiles 
    WHERE id = auth.uid() 
    LIMIT 1;
  END IF;

  -- Si no tiene empresa asignada, permitirle continuar
  IF v_company_id IS NULL THEN
    RETURN v_role;
  END IF;

  -- 4. Verificar el estado de la empresa
  SELECT status INTO v_company_status 
  FROM public.saas_companies 
  WHERE id = v_company_id;

  -- Si la empresa está inactiva, suspendida o pendiente, bloquear el acceso
  IF v_company_status IS DISTINCT FROM 'activa' THEN
    RETURN 'bloqueado';
  END IF;

  RETURN v_role;
END;
$$;
