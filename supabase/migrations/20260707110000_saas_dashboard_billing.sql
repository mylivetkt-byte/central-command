-- ============================================================
-- SAAS ADVANCED BRANDING AND BILLING HISTORY
-- ============================================================

-- 1. Agregar columnas de personalización de marca a saas_companies
ALTER TABLE public.saas_companies ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.saas_companies ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#8B5CF6';

-- 2. Crear tabla saas_payments para registro de facturación mensual
CREATE TABLE IF NOT EXISTS public.saas_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.saas_companies(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pagado', 'pendiente', 'vencido')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Habilitar seguridad de nivel de fila (RLS) en saas_payments
ALTER TABLE public.saas_payments ENABLE ROW LEVEL SECURITY;

-- 4. Políticas RLS para saas_payments
DROP POLICY IF EXISTS "Super admins manage payments" ON public.saas_payments;
CREATE POLICY "Super admins manage payments" ON public.saas_payments
  FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Company admins read own payments" ON public.saas_payments;
CREATE POLICY "Company admins read own payments" ON public.saas_payments
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.user_id = auth.uid() AND cu.company_id = saas_payments.company_id
    )
  );
