-- ============================================================
-- SAAS LOGO UPLOAD STORAGE BUCKET AND POLICIES
-- ============================================================

-- 1. Crear bucket de logos público si no existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Habilitar políticas de lectura pública en storage.objects
DROP POLICY IF EXISTS "Public Read Access for logos" ON storage.objects;
CREATE POLICY "Public Read Access for logos" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'logos');

-- 3. Habilitar políticas de administración para Super Admins
DROP POLICY IF EXISTS "Super admins manage logos" ON storage.objects;
CREATE POLICY "Super admins manage logos" ON storage.objects
  FOR ALL TO authenticated USING (
    bucket_id = 'logos' AND public.is_super_admin(auth.uid())
  );
