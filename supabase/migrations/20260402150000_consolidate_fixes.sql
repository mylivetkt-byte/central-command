-- ============================================================
-- CONSOLIDACIÓN DE FIXES — aplicar una sola vez en Supabase
-- Incluye todos los cambios necesarios para que la app funcione
-- ============================================================

-- 1. Columna notes en deliveries (faltaba, causaba error al crear servicio)
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. Columna vehicle_type en driver_profiles (usada en DriverApp)
ALTER TABLE public.driver_profiles
  ADD COLUMN IF NOT EXISTS vehicle_type TEXT DEFAULT 'moto';

-- 3. Función get_my_role — RPC con SECURITY DEFINER
--    Evita bloqueos por RLS al obtener el rol durante refresco de token.
--    El frontend cae en query directa si esta función no existe,
--    pero tenerla acelera y estabiliza la autenticación.
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::TEXT
  FROM public.user_roles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_my_role() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

-- 4. Política INSERT faltante en delivery_audit_log para admins
--    Los admins también insertan entradas de auditoría (p.ej. al asignar)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'delivery_audit_log'
      AND policyname = 'Admins can insert audit entries'
  ) THEN
    CREATE POLICY "Admins can insert audit entries"
      ON public.delivery_audit_log
      FOR INSERT
      TO authenticated
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- 5. Política INSERT faltante en deliveries para admins
--    La política existente "Admins can manage all deliveries" cubre ALL
--    pero hay un edge case con RLS y triggers — agregamos INSERT explícito.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'deliveries'
      AND policyname = 'Admins can insert deliveries'
  ) THEN
    CREATE POLICY "Admins can insert deliveries"
      ON public.deliveries
      FOR INSERT
      TO authenticated
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- 6. Función para auto-actualizar updated_at en driver_profiles
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_driver_profiles_updated_at'
  ) THEN
    CREATE TRIGGER set_driver_profiles_updated_at
      BEFORE UPDATE ON public.driver_profiles
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- 7. Función RPC para obtener estadísticas del driver (usada en DriverApp)
CREATE OR REPLACE FUNCTION public.get_driver_stats(p_driver_id UUID DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID := COALESCE(p_driver_id, auth.uid());
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'total_deliveries', dp.total_deliveries,
    'rating',           dp.rating,
    'acceptance_rate',  dp.acceptance_rate,
    'status',           dp.status,
    'zone',             dp.zone,
    'current_load',     dp.current_load,
    'vehicle_type',     dp.vehicle_type
  )
  INTO v_result
  FROM public.driver_profiles dp
  WHERE dp.id = v_id;

  RETURN COALESCE(v_result, '{}'::json);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_driver_stats(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_my_role()         IS 'Returns the role of the current user, bypassing RLS.';
COMMENT ON FUNCTION public.get_driver_stats(UUID) IS 'Returns stats for a driver. Defaults to current user.';
COMMENT ON COLUMN public.deliveries.notes         IS 'Optional notes for the delivery, entered by admin.';
COMMENT ON COLUMN public.driver_profiles.vehicle_type IS 'Type of vehicle: moto, bicicleta, carro, etc.';
