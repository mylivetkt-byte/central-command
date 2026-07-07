-- ============================================================
-- SAAS AUTHORIZATION, ACTIVATION AND TENANT FIXES
-- ============================================================

-- 1. Modificar tabla saas_companies para soportar estado 'pendiente' y valor de plan
ALTER TABLE public.saas_companies DROP CONSTRAINT IF EXISTS saas_companies_status_check;
ALTER TABLE public.saas_companies ADD CONSTRAINT saas_companies_status_check CHECK (status IN ('pendiente', 'activa', 'inactiva', 'suspendida'));
ALTER TABLE public.saas_companies ALTER COLUMN status SET DEFAULT 'pendiente';
ALTER TABLE public.saas_companies ADD COLUMN IF NOT EXISTS plan_value NUMERIC(12,2) NOT NULL DEFAULT 0;

-- 2. Actualizar función trigger handle_new_user_company para soportar registro de empresa y corregir carrera de tiempos
CREATE OR REPLACE FUNCTION public.handle_new_user_company()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
  v_company_name TEXT;
BEGIN
  v_company_id := (NEW.raw_user_meta_data->>'company_id')::UUID;
  v_company_name := NEW.raw_user_meta_data->>'company_name';

  -- Si no tiene company_id pero tiene company_name (registro self-service)
  IF v_company_id IS NULL AND v_company_name IS NOT NULL THEN
    INSERT INTO public.saas_companies (name, status, plan, max_drivers, plan_value)
    VALUES (v_company_name, 'pendiente', 'basico', 5, 0)
    RETURNING id INTO v_company_id;
  END IF;

  IF v_company_id IS NOT NULL THEN
    -- Insertar en company_users
    INSERT INTO public.company_users (user_id, company_id, role)
    VALUES (
      NEW.id,
      v_company_id,
      COALESCE((NEW.raw_user_meta_data->>'role')::TEXT, 'driver')
    )
    ON CONFLICT (user_id, company_id) DO NOTHING;

    -- Forzar actualización del company_id en driver_profiles si existiera (evita race condition)
    UPDATE public.driver_profiles
    SET company_id = v_company_id
    WHERE id = NEW.id AND company_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Crear trigger para auto-completar company_id en driver_locations
CREATE OR REPLACE FUNCTION public.set_driver_location_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := (
      SELECT company_id FROM public.company_users
      WHERE user_id = NEW.driver_id LIMIT 1
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_driver_location_company_id ON public.driver_locations;
CREATE TRIGGER trg_set_driver_location_company_id
  BEFORE INSERT OR UPDATE ON public.driver_locations
  FOR EACH ROW EXECUTE FUNCTION public.set_driver_location_company_id();

-- 4. Crear trigger para auto-completar company_id en chat_messages
CREATE OR REPLACE FUNCTION public.set_chat_message_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NULL AND auth.uid() IS NOT NULL THEN
    NEW.company_id := (
      SELECT company_id FROM public.company_users
      WHERE user_id = auth.uid() LIMIT 1
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_chat_message_company_id ON public.chat_messages;
CREATE TRIGGER trg_set_chat_message_company_id
  BEFORE INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_chat_message_company_id();

-- 5. Crear trigger para auto-completar company_id en delivery_audit_log
CREATE OR REPLACE FUNCTION public.set_delivery_audit_log_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := (
      SELECT company_id FROM public.deliveries
      WHERE id = NEW.delivery_id LIMIT 1
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_delivery_audit_log_company_id ON public.delivery_audit_log;
CREATE TRIGGER trg_set_delivery_audit_log_company_id
  BEFORE INSERT ON public.delivery_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.set_delivery_audit_log_company_id();

-- 6. Crear trigger para auto-completar company_id en alerts
CREATE OR REPLACE FUNCTION public.set_alert_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NULL AND auth.uid() IS NOT NULL THEN
    NEW.company_id := (
      SELECT company_id FROM public.company_users
      WHERE user_id = auth.uid() LIMIT 1
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_alert_company_id ON public.alerts;
CREATE TRIGGER trg_set_alert_company_id
  BEFORE INSERT ON public.alerts
  FOR EACH ROW EXECUTE FUNCTION public.set_alert_company_id();
