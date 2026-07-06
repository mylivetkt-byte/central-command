
CREATE OR REPLACE VIEW public.pending_delivery_offers
WITH (security_invoker = on) AS
SELECT
  id, order_id, pickup_address, delivery_address,
  pickup_lat, pickup_lng, delivery_lat, delivery_lng,
  amount, commission, estimated_time, status, zone, created_at
FROM public.deliveries
WHERE status = 'pendiente' AND driver_id IS NULL;

GRANT SELECT ON public.pending_delivery_offers TO authenticated;
