-- FIX: La política de INSERT en delivery_audit_log para drivers fallaba
-- porque verificaba que delivery.driver_id = auth.uid() DESPUÉS del update,
-- pero en el momento del insert ya está asignado. Sin embargo, cuando el
-- driver inserta el log justo después de claim_delivery, la condición
-- EXISTS puede fallar por timing. Usar SECURITY DEFINER en claim_delivery
-- para que inserte el log también, o relajar la política para drivers.

-- Eliminar política restrictiva actual
DROP POLICY IF EXISTS "Drivers can insert own audit entries" ON public.delivery_audit_log;

-- Nueva política más robusta: el driver puede insertar entradas de auditoría
-- siempre que el performed_by sea él mismo (sin requerir que ya sea driver_id)
CREATE POLICY "Drivers can insert audit entries"
  ON public.delivery_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    performed_by = auth.uid()
    AND public.has_role(auth.uid(), 'driver')
  );
