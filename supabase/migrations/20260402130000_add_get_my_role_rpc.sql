-- ============================================================
-- FIX: Función RPC para obtener el rol del usuario autenticado
-- 
-- Problema: fetchRole() en el cliente hacía una query directa a
-- user_roles sujeta a RLS. Al recargar la página, el token JWT
-- puede estar aún refrescándose, causando que la query se cuelgue
-- y el loading nunca termine (spinner infinito hasta el failsafe).
--
-- Solución: función SECURITY DEFINER que bypasea RLS y siempre
-- responde con el rol del usuario actual de forma inmediata.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::TEXT
  FROM public.user_roles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- Revocar acceso público y permitir solo usuarios autenticados
REVOKE ALL ON FUNCTION public.get_my_role() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

COMMENT ON FUNCTION public.get_my_role() IS
  'Returns the role of the currently authenticated user. Uses SECURITY DEFINER to bypass RLS and avoid query hangs during token refresh on page reload.';
