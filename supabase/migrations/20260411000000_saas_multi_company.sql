-- ============================================================
-- SAAS MULTI-EMPRESA
-- ============================================================

-- 1. Agregar rol super_admin al enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin' BEFORE 'admin';

-- 2. Tabla de empresas
CREATE TABLE IF NOT EXISTS public.saas_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  nit TEXT UNIQUE,
  email TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'activa' CHECK (status IN ('activa', 'inactiva', 'suspendida')),
  max_drivers INTEGER NOT NULL DEFAULT 5,
  plan TEXT NOT NULL DEFAULT 'basico' CHECK (plan IN ('basico', 'profesional', 'enterprise')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.saas_companies ENABLE ROW LEVEL SECURITY;

-- 3. Relación usuario-empresa
CREATE TABLE IF NOT EXISTS public.company_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.saas_companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'driver', 'super_admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, company_id)
);
ALTER TABLE public.company_users ENABLE ROW LEVEL SECURITY;

-- 4. Agregar company_id a tablas existentes
ALTER TABLE public.driver_profiles ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.saas_companies(id) ON DELETE SET NULL;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.saas_companies(id) ON DELETE SET NULL;
ALTER TABLE public.driver_locations ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.saas_companies(id) ON DELETE SET NULL;
ALTER TABLE public.delivery_audit_log ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.saas_companies(id) ON DELETE SET NULL;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.saas_companies(id) ON DELETE SET NULL;
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.saas_companies(id) ON DELETE SET NULL;

-- 5. RLS: super_admin ve todo, cada empresa ve solo lo suyo
CREATE POLICY "super_admin all companies" ON public.saas_companies
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "users read own company" ON public.saas_companies
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.company_id = saas_companies.id
      AND cu.user_id = auth.uid()
    )
  );

CREATE POLICY "super_admin all company_users" ON public.company_users
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "users read own company_users" ON public.company_users
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 6. Función para obtener company_id del usuario actual
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1;
$$;

-- 7. RLS en deliveries por company_id
DROP POLICY IF EXISTS "super_admin all deliveries" ON public.deliveries;
CREATE POLICY "super_admin all deliveries" ON public.deliveries
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Modificar policies existentes para filtrar por empresa
-- Nota: las policies actuales ya existen con nombres anteriores,
-- agregamos una policy complementaria de company
CREATE POLICY "user company deliveries" ON public.deliveries
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.user_id = auth.uid()
      AND cu.company_id = deliveries.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.user_id = auth.uid()
      AND cu.company_id = deliveries.company_id
    )
  );

-- 7b. RLS en driver_profiles por company_id
DROP POLICY IF EXISTS "super_admin all driver_profiles" ON public.driver_profiles;
CREATE POLICY "super_admin all driver_profiles" ON public.driver_profiles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "user company driver_profiles" ON public.driver_profiles
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.user_id = auth.uid()
      AND cu.company_id = driver_profiles.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.user_id = auth.uid()
      AND cu.company_id = driver_profiles.company_id
    )
  );

-- 7c. RLS en driver_locations por company_id
DROP POLICY IF EXISTS "super_admin all driver_locations" ON public.driver_locations;
CREATE POLICY "super_admin all driver_locations" ON public.driver_locations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "user company driver_locations" ON public.driver_locations
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.user_id = auth.uid()
      AND cu.company_id = driver_locations.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.user_id = auth.uid()
      AND cu.company_id = driver_locations.company_id
    )
  );

-- 7d. RLS en chat_messages por company_id
DROP POLICY IF EXISTS "super_admin all chat_messages" ON public.chat_messages;
CREATE POLICY "super_admin all chat_messages" ON public.chat_messages
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "user company chat_messages" ON public.chat_messages
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.user_id = auth.uid()
      AND cu.company_id = chat_messages.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.user_id = auth.uid()
      AND cu.company_id = chat_messages.company_id
    )
  );

-- 7e. RLS en delivery_audit_log por company_id
DROP POLICY IF EXISTS "super_admin all delivery_audit_log" ON public.delivery_audit_log;
CREATE POLICY "super_admin all delivery_audit_log" ON public.delivery_audit_log
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "user company delivery_audit_log" ON public.delivery_audit_log
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.user_id = auth.uid()
      AND cu.company_id = delivery_audit_log.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.user_id = auth.uid()
      AND cu.company_id = delivery_audit_log.company_id
    )
  );

-- 7f. RLS en alerts por company_id
DROP POLICY IF EXISTS "super_admin all alerts" ON public.alerts;
CREATE POLICY "super_admin all alerts" ON public.alerts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "user company alerts" ON public.alerts
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.user_id = auth.uid()
      AND cu.company_id = alerts.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.user_id = auth.uid()
      AND cu.company_id = alerts.company_id
    )
  );

-- 8. Función para resetear datos de una empresa
CREATE OR REPLACE FUNCTION public.reset_company_data(p_company_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar que quien ejecuta es super_admin
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RETURN 'error: solo super_admin puede resetear';
  END IF;

  DELETE FROM public.chat_messages WHERE company_id = p_company_id;
  DELETE FROM public.delivery_audit_log WHERE company_id = p_company_id;
  DELETE FROM public.driver_locations WHERE company_id = p_company_id;
  DELETE FROM public.deliveries WHERE company_id = p_company_id;

  RETURN 'ok';
END;
$$;

-- 9. Trigger: al crear un usuario, asignar company_id de su empresa
CREATE OR REPLACE FUNCTION public.handle_new_user_company()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
BEGIN
  -- Si el usuario metadata tiene company_id, asignarlo
  v_company_id := (NEW.raw_user_meta_data->>'company_id')::UUID;
  IF v_company_id IS NOT NULL THEN
    INSERT INTO public.company_users (user_id, company_id, role)
    VALUES (
      NEW.id,
      v_company_id,
      COALESCE((NEW.raw_user_meta_data->>'role')::TEXT, 'driver')
    )
    ON CONFLICT (user_id, company_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_company ON auth.users;
CREATE TRIGGER on_auth_user_created_company
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_company();
