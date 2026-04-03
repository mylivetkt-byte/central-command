-- ============================================================
-- FIX: Agregar columna notes a la tabla deliveries
--
-- El frontend (Dispatch.tsx) enviaba el campo notes al crear
-- un servicio, pero la columna no existía en la tabla,
-- causando error: "column notes does not exist".
-- ============================================================

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN public.deliveries.notes IS
  'Notas u observaciones opcionales sobre el servicio, ingresadas por el administrador al crear el pedido.';
