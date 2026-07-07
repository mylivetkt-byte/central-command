-- ============================================================
-- SAAS DRIVER SELF-SIGNUP AND COMPANY ASSIGNMENT MIGRATION
-- ============================================================

-- 1. Permitir lectura pública de empresas activas a usuarios anónimos (para el registro del driver)
DROP POLICY IF EXISTS "public read active companies" ON public.saas_companies;
CREATE POLICY "public read active companies" ON public.saas_companies
  FOR SELECT TO anon, authenticated USING (status = 'activa');

-- 2. Modificar la función trigger handle_new_user_role para asignar el company_id desde los metadatos
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role app_role;
  _company_id UUID;
BEGIN
  -- Obtener rol de los metadatos (por defecto 'driver')
  _role := COALESCE(
    (NEW.raw_user_meta_data->>'role')::app_role,
    'driver'
  );

  -- Registrar en la tabla user_roles
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Si es conductor, crear el perfil vinculándolo a la empresa asignada
  IF _role = 'driver' THEN
    -- Parsear el UUID del company_id de los metadatos si está presente
    BEGIN
      _company_id := (NEW.raw_user_meta_data->>'company_id')::UUID;
    EXCEPTION WHEN OTHERS THEN
      _company_id := NULL;
    END;

    INSERT INTO public.driver_profiles (id, company_id)
    VALUES (NEW.id, _company_id)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
