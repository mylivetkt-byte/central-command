-- ============================================================
-- SEPARATION OF ROLES: ADMINS IN company_users, DRIVERS IN driver_profiles
-- ============================================================

-- 1. Recrear la función get_user_company_id() para buscar en ambas tablas según el rol
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
BEGIN
  -- Intentar buscar en company_users (para administradores)
  SELECT company_id INTO v_company_id 
  FROM public.company_users 
  WHERE user_id = auth.uid() 
  LIMIT 1;

  -- Si no es administrador, buscar en driver_profiles (para conductores)
  IF v_company_id IS NULL THEN
    SELECT company_id INTO v_company_id 
    FROM public.driver_profiles 
    WHERE id = auth.uid() 
    LIMIT 1;
  END IF;

  RETURN v_company_id;
END;
$$;

-- 2. Actualizar el trigger handle_new_user_company para insertar en company_users SÓLO si el rol es 'admin'
CREATE OR REPLACE FUNCTION public.handle_new_user_company()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
  v_company_name TEXT;
  v_company_nit TEXT;
  v_phone TEXT;
  v_role TEXT;
BEGIN
  v_company_id := (NEW.raw_user_meta_data->>'company_id')::UUID;
  v_company_name := NEW.raw_user_meta_data->>'company_name';
  v_company_nit := NEW.raw_user_meta_data->>'company_nit';
  v_phone := NEW.raw_user_meta_data->>'phone';
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'driver');

  -- Si no tiene company_id pero tiene company_name (registro self-service de nuevo admin)
  IF v_company_id IS NULL AND v_company_name IS NOT NULL THEN
    INSERT INTO public.saas_companies (name, nit, email, phone, status, plan, max_drivers, plan_value)
    VALUES (
      v_company_name,
      v_company_nit,
      NEW.email,
      v_phone,
      'pendiente',
      'basico',
      5,
      0
    )
    RETURNING id INTO v_company_id;
  END IF;

  IF v_company_id IS NOT NULL THEN
    -- Insertar en la relación de usuarios de la empresa (company_users) SÓLO si es 'admin'
    IF v_role = 'admin' THEN
      INSERT INTO public.company_users (user_id, company_id, role)
      VALUES (
        NEW.id,
        v_company_id,
        'admin'
      )
      ON CONFLICT (user_id, company_id) DO NOTHING;
    END IF;

    -- Forzar actualización del company_id en driver_profiles si existiera (evita carrera de tiempos)
    UPDATE public.driver_profiles
    SET company_id = v_company_id
    WHERE id = NEW.id AND company_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Limpiar los registros duplicados de conductores en la tabla company_users
DELETE FROM public.company_users
WHERE user_id IN (
  SELECT user_id FROM public.user_roles WHERE role = 'driver'
);
