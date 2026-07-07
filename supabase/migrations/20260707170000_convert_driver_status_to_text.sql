-- ============================================================
-- CONVERT DRIVER STATUS ENUM TO TEXT COLUMN (AVOIDS MIGRATION HEADACHES)
-- ============================================================

-- 1. Eliminar el valor por defecto actual de status en driver_profiles
ALTER TABLE public.driver_profiles ALTER COLUMN status DROP DEFAULT;

-- 2. Cambiar la columna status de enum a TEXT (Postgres convierte los valores automáticamente)
ALTER TABLE public.driver_profiles ALTER COLUMN status TYPE TEXT;

-- 3. Agregar la restricción CHECK para validar los estados (incluyendo pendiente)
ALTER TABLE public.driver_profiles DROP CONSTRAINT IF EXISTS check_driver_status;
ALTER TABLE public.driver_profiles ADD CONSTRAINT check_driver_status 
  CHECK (status IN ('activo', 'inactivo', 'suspendido', 'en_ruta', 'pendiente'));

-- 4. Establecer 'pendiente' como el nuevo valor por defecto
ALTER TABLE public.driver_profiles ALTER COLUMN status SET DEFAULT 'pendiente';

-- 5. Recrear la función trigger handle_new_user_role usando TEXT en lugar del enum
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role app_role;
  _company_id UUID;
  _status TEXT;
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
      _status := 'inactivo';
    ELSE
      _status := 'pendiente';
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
