
CREATE TABLE public.delivery_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_id UUID NOT NULL UNIQUE REFERENCES public.deliveries(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES public.driver_profiles(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.saas_companies(id) ON DELETE SET NULL,
  score SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment TEXT,
  tip_amount NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.delivery_ratings TO authenticated;
GRANT ALL ON public.delivery_ratings TO service_role;

ALTER TABLE public.delivery_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers can read their own ratings"
  ON public.delivery_ratings FOR SELECT TO authenticated
  USING (driver_id = auth.uid());

CREATE POLICY "Company admins can read their ratings"
  ON public.delivery_ratings FOR SELECT TO authenticated
  USING (public.user_can_access_company(company_id));

CREATE POLICY "Super admin all ratings"
  ON public.delivery_ratings FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_delivery_ratings_driver ON public.delivery_ratings(driver_id);
CREATE INDEX IF NOT EXISTS idx_delivery_ratings_company ON public.delivery_ratings(company_id);

CREATE OR REPLACE FUNCTION public.recalc_driver_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.driver_id IS NOT NULL THEN
    UPDATE public.driver_profiles dp
    SET rating = COALESCE((
      SELECT ROUND(AVG(score)::numeric, 2)
      FROM public.delivery_ratings
      WHERE driver_id = NEW.driver_id
    ), dp.rating)
    WHERE dp.id = NEW.driver_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_driver_rating ON public.delivery_ratings;
CREATE TRIGGER trg_recalc_driver_rating
AFTER INSERT ON public.delivery_ratings
FOR EACH ROW EXECUTE FUNCTION public.recalc_driver_rating();
