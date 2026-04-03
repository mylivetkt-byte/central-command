CREATE POLICY "Drivers can claim pending deliveries"
ON public.deliveries
FOR UPDATE
TO authenticated
USING (status = 'pendiente'::delivery_status AND driver_id IS NULL)
WITH CHECK (driver_id = auth.uid() AND status = 'aceptado'::delivery_status);