-- ============================================================
-- DRIVER APPROVAL FLOW & PENDING STATUS MIGRATION
-- ============================================================

-- 1. Agregar el valor 'pendiente' al tipo enum de estado de conductores
ALTER TYPE public.driver_status ADD VALUE IF NOT EXISTS 'pendiente';

-- 2. Establecer el valor por defecto de la columna status a 'pendiente' en la tabla driver_profiles
ALTER TABLE public.driver_profiles ALTER COLUMN status SET DEFAULT 'pendiente';

-- 3. Actualizar la función trigger handle_new_user_role para mapear correctamente el estado inicial
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role app_role;
  _company_id UUID;
  _status driver_status;
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

    -- Si se registró por el panel administrativo (is_approved = true), empieza como 'inactivo' (listo pero desconectado).
    -- Si se auto-registró por la app móvil, empieza como 'pendiente' (requiere aprobación explícita).
    IF (NEW.raw_user_meta_data->>'is_approved')::BOOLEAN = TRUE THEN
      _status := 'inactivo'::driver_status;
    ELSE
      _status := 'pendiente'::driver_status;
    END IF;

    INSERT INTO public.driver_profiles (id, company_id, status)
    VALUES (NEW.id, _company_id, _status)
    ON CONFLICT (id) DO UPDATE
    SET company_id = EXCLUDED.company_id,
        status = EXCLUDED.status;
  END IF;

  RETURN NEW;
END;
$$;
