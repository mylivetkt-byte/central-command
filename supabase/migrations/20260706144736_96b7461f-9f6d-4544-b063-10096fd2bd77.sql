
-- Allow drivers to claim (NULL -> self) and release (self -> NULL)
CREATE OR REPLACE FUNCTION public.protect_delivery_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Allow driver_id transitions: NULL -> self (claim) OR self -> NULL (release)
  IF NEW.driver_id IS DISTINCT FROM OLD.driver_id THEN
    IF NOT (
      (OLD.driver_id IS NULL AND NEW.driver_id = auth.uid())
      OR (OLD.driver_id = auth.uid() AND NEW.driver_id IS NULL)
    ) THEN
      RAISE EXCEPTION 'Drivers cannot reassign deliveries';
    END IF;
  END IF;

  IF NEW.amount IS DISTINCT FROM OLD.amount
     OR NEW.commission IS DISTINCT FROM OLD.commission
     OR NEW.order_id IS DISTINCT FROM OLD.order_id
     OR NEW.customer_name IS DISTINCT FROM OLD.customer_name
     OR NEW.customer_phone IS DISTINCT FROM OLD.customer_phone
     OR NEW.pickup_address IS DISTINCT FROM OLD.pickup_address
     OR NEW.delivery_address IS DISTINCT FROM OLD.delivery_address
     OR NEW.pickup_lat IS DISTINCT FROM OLD.pickup_lat
     OR NEW.pickup_lng IS DISTINCT FROM OLD.pickup_lng
     OR NEW.delivery_lat IS DISTINCT FROM OLD.delivery_lat
     OR NEW.delivery_lng IS DISTINCT FROM OLD.delivery_lng
  THEN
    RAISE EXCEPTION 'Drivers cannot modify financial or identity fields';
  END IF;

  RETURN NEW;
END;
$function$;

-- Update the UPDATE policy so a driver can release a delivery back to pending
DROP POLICY IF EXISTS "Drivers can update assigned deliveries" ON public.deliveries;
CREATE POLICY "Drivers can update assigned deliveries"
ON public.deliveries
FOR UPDATE
TO authenticated
USING (driver_id = auth.uid())
WITH CHECK (
  status IN ('aceptado','en_camino','entregado','cancelado','pendiente')
  AND (
    driver_id = auth.uid()
    OR (driver_id IS NULL AND status = 'pendiente')
  )
);
