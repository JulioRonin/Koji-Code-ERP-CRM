-- ============================================================================
-- KANRI · Proveedores: ranking y clasificación (espejo de Clientes)
-- Idempotente.
-- ============================================================================
ALTER TABLE public.suppliers
    ADD COLUMN IF NOT EXISTS tier           TEXT,     -- A|B|C (rango manual)
    ADD COLUMN IF NOT EXISTS category       TEXT,     -- categoría de suministro
    ADD COLUMN IF NOT EXISTS lead_time_days INTEGER;  -- días de entrega típico

NOTIFY pgrst, 'reload schema';
-- ============================================================================
