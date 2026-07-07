-- ============================================================
-- SAAS GLOBAL USER AND PASSWORD MANAGEMENT
-- ============================================================

-- 1. Función para listar todos los usuarios (Admins y Drivers) de una empresa con sus correos
CREATE OR REPLACE FUNCTION public.get_company_users_list(p_company_id UUID)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  full_name TEXT,
  role TEXT,
  status TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verificar que el ejecutor sea Super Admin
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access Denied';
  END IF;

  RETURN QUERY
  -- Admins/Managers de la empresa
  SELECT 
    cu.user_id,
    u.email::TEXT,
    p.full_name,
    'admin'::TEXT as role,
    'activo'::TEXT as status,
    cu.created_at
  FROM public.company_users cu
  JOIN auth.users u ON u.id = cu.user_id
  LEFT JOIN public.profiles p ON p.id = cu.user_id
  WHERE cu.company_id = p_company_id

  UNION ALL

  -- Repartidores de la empresa
  SELECT 
    dp.id as user_id,
    u.email::TEXT,
    p.full_name,
    'driver'::TEXT as role,
    dp.status::TEXT,
    dp.created_at
  FROM public.driver_profiles dp
  JOIN auth.users u ON u.id = dp.id
  LEFT JOIN public.profiles p ON p.id = dp.id
  WHERE dp.company_id = p_company_id;
END;
$$;

-- 2. Función para forzar el cambio de contraseña de cualquier usuario
CREATE OR REPLACE FUNCTION public.set_user_password(p_user_id UUID, p_new_password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verificar que el ejecutor sea Super Admin
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access Denied';
  END IF;

  -- Actualizar contraseña usando el hash bcrypt (bf)
  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf', 10)),
      updated_at = now()
  WHERE id = p_user_id;

  RETURN TRUE;
END;
$$;
