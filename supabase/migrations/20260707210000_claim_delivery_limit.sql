-- ============================================================
-- ENFORCE 2 ACTIVE ORDERS LIMIT IN claim_delivery RPC
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
  v_active_count INTEGER;
BEGIN
  -- 1. Verificar que el usuario tiene rol driver
  IF NOT public.has_role(v_user_id, 'driver') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Solo los repartidores pueden tomar pedidos.');
  END IF;

  -- 2. Verificar que el driver está activo
  SELECT status INTO v_driver_status
    FROM public.driver_profiles
   WHERE id = v_user_id;

  IF v_driver_status NOT IN ('activo', 'en_ruta') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Tu cuenta no está activa para tomar pedidos.');
  END IF;

  -- 3. Verificar que el driver no tenga ya 2 o más pedidos activos (límite máximo de 2 simultáneos)
  SELECT COUNT(*) INTO v_active_count
    FROM public.deliveries
   WHERE driver_id = v_user_id
     AND status IN ('aceptado', 'en_camino');

  IF v_active_count >= 2 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ya tienes el límite máximo de 2 pedidos activos simultáneos.');
  END IF;

  -- 4. Verificar que el pedido existe, está pendiente y sin asignar (SELECT FOR UPDATE evita condiciones de carrera)
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

  -- 5. Asignar el pedido al driver
  UPDATE public.deliveries
     SET driver_id  = v_user_id,
         status     = 'aceptado',
         accepted_at = now(),
         updated_at  = now()
   WHERE id = p_delivery_id;

  -- 6. Actualizar carga del driver
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

-- Permitir ejecución a usuarios autenticados
REVOKE ALL ON FUNCTION public.claim_delivery(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_delivery(UUID) TO authenticated;
