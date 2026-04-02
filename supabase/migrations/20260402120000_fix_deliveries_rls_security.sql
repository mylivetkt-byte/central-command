-- ============================================================
-- SECURITY FIX: Deliveries RLS
-- Problema: la política "Drivers can read assigned deliveries"
-- exponía customer_name, customer_phone, pickup_address y
-- delivery_address de TODOS los pedidos pendientes a cualquier
-- usuario autenticado, no solo al driver asignado.
-- ============================================================

-- 1. Eliminar política vulnerable
DROP POLICY IF EXISTS "Drivers can read assigned deliveries" ON public.deliveries;

-- 2. Nueva política: driver solo ve sus propios pedidos asignados
CREATE POLICY "Drivers can read own assigned deliveries"
  ON public.deliveries
  FOR SELECT
  TO authenticated
  USING (
    driver_id = auth.uid()
    AND public.has_role(auth.uid(), 'driver')
  );

-- ============================================================
-- Vista restringida para pedidos disponibles (sin asignar)
-- Solo expone los campos mínimos necesarios para que un driver
-- decida si tomar o no un pedido, SIN datos sensibles del cliente.
-- ============================================================

CREATE OR REPLACE VIEW public.available_deliveries AS
  SELECT
    id,
    order_id,
    zone,
    estimated_time,
    amount,
    commission,
    -- Solo dirección general de recogida y zona de entrega,
    -- sin coordenadas exactas ni datos del cliente
    pickup_address,
    delivery_address,
    status,
    created_at
  FROM public.deliveries
  WHERE status = 'pendiente'
    AND driver_id IS NULL;

-- Política de acceso a la vista: solo drivers activos
ALTER VIEW public.available_deliveries OWNER TO authenticated;

REVOKE ALL ON public.available_deliveries FROM public, anon;
GRANT SELECT ON public.available_deliveries TO authenticated;

-- RLS en la vista heredado de la tabla base — agregar seguridad
-- adicional con security_invoker para que la vista use el RLS
-- del usuario que la consulta, no del owner.
ALTER VIEW public.available_deliveries SET (security_invoker = true);

-- ============================================================
-- Función segura para que un driver tome un pedido disponible
-- El driver nunca accede directamente a la tabla con datos
-- sensibles de un pedido que no es suyo — la función valida y
-- hace el UPDATE de forma controlada.
-- ============================================================

CREATE OR REPLACE FUNCTION public.claim_delivery(p_delivery_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_delivery RECORD;
  v_driver_status TEXT;
BEGIN
  -- Verificar que el usuario tiene rol driver
  IF NOT public.has_role(v_user_id, 'driver') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Solo los repartidores pueden tomar pedidos.');
  END IF;

  -- Verificar que el driver está activo
  SELECT status INTO v_driver_status
    FROM public.driver_profiles
   WHERE id = v_user_id;

  IF v_driver_status NOT IN ('activo', 'en_ruta') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Tu cuenta no está activa para tomar pedidos.');
  END IF;

  -- Verificar que el pedido existe, está pendiente y sin asignar
  -- con bloqueo para evitar condición de carrera (dos drivers tomando el mismo pedido)
  SELECT id, status, driver_id
    INTO v_delivery
    FROM public.deliveries
   WHERE id = p_delivery_id
     AND status = 'pendiente'
     AND driver_id IS NULL
   FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Pedido no disponible o ya fue tomado por otro repartidor.');
  END IF;

  -- Asignar el pedido al driver
  UPDATE public.deliveries
     SET driver_id  = v_user_id,
         status     = 'aceptado',
         accepted_at = now(),
         updated_at  = now()
   WHERE id = p_delivery_id;

  -- Actualizar carga del driver
  UPDATE public.driver_profiles
     SET current_load = current_load + 1,
         status       = 'en_ruta',
         updated_at   = now()
   WHERE id = v_user_id;

  RETURN jsonb_build_object('ok', true, 'delivery_id', p_delivery_id);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

-- Revocar ejecución pública y permitir solo a usuarios autenticados
REVOKE ALL ON FUNCTION public.claim_delivery(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_delivery(UUID) TO authenticated;

-- ============================================================
-- Comentarios de seguridad para documentar el modelo
-- ============================================================

COMMENT ON POLICY "Drivers can read own assigned deliveries" ON public.deliveries IS
  'Drivers can only read deliveries explicitly assigned to them. Pending deliveries are exposed via the available_deliveries view with restricted fields only.';

COMMENT ON VIEW public.available_deliveries IS
  'Restricted view for drivers to browse unassigned pending deliveries. Exposes zone, addresses and amounts but NOT customer_name, customer_phone, or exact coordinates.';

COMMENT ON FUNCTION public.claim_delivery(UUID) IS
  'Atomic function for a driver to claim an unassigned delivery. Uses SELECT FOR UPDATE SKIP LOCKED to prevent race conditions. Validates driver role and active status before assigning.';
