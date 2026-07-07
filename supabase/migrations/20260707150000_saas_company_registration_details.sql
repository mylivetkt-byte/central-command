-- ============================================================
-- SAAS COMPANY SIGNUP DETAIL PROPAGATION TRIGGER FIX
-- ============================================================

-- Actualizar la función trigger handle_new_user_company para guardar NIT, email y teléfono en saas_companies al registrarse
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
BEGIN
  v_company_id := (NEW.raw_user_meta_data->>'company_id')::UUID;
  v_company_name := NEW.raw_user_meta_data->>'company_name';
  v_company_nit := NEW.raw_user_meta_data->>'company_nit';
  v_phone := NEW.raw_user_meta_data->>'phone';

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
    -- Insertar en la relación de usuarios de la empresa (company_users)
    INSERT INTO public.company_users (user_id, company_id, role)
    VALUES (
      NEW.id,
      v_company_id,
      COALESCE((NEW.raw_user_meta_data->>'role')::TEXT, 'driver')
    )
    ON CONFLICT (user_id, company_id) DO NOTHING;

    -- Forzar actualización del company_id en driver_profiles si existiera (evita carrera de tiempos)
    UPDATE public.driver_profiles
    SET company_id = v_company_id
    WHERE id = NEW.id AND company_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;
