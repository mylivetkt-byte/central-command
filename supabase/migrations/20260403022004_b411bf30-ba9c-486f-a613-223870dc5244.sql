CREATE POLICY "Drivers can insert own audit entries"
ON public.delivery_audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  performed_by = auth.uid() AND
  EXISTS (
    SELECT 1 FROM deliveries d
    WHERE d.id = delivery_audit_log.delivery_id
    AND d.driver_id = auth.uid()
  )
);