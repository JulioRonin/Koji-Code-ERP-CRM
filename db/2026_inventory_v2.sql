-- ============================================================================
-- KANRI · Inventario v2: tiempo de entrega, resurtido y modo de inventario
-- ----------------------------------------------------------------------------
-- Idempotente.
-- ============================================================================
ALTER TABLE public.inventory_items
    ADD COLUMN IF NOT EXISTS lead_time_days  INTEGER,      -- días de entrega si fuera de stock
    ADD COLUMN IF NOT EXISTS restock_status  TEXT,         -- none | solicitado | transito
    ADD COLUMN IF NOT EXISTS restock_eta     DATE;         -- fecha estimada de llegada

-- Modo del inventario por empresa: 'taller' | 'insumos'.
ALTER TABLE public.company_settings
    ADD COLUMN IF NOT EXISTS inventory_mode TEXT;

NOTIFY pgrst, 'reload schema';
-- ============================================================================
