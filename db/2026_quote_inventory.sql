-- ============================================================================
-- KANRI · Cotizaciones ↔ Inventario
-- ----------------------------------------------------------------------------
-- Permite ligar partidas de cotización con productos del inventario y descontar
-- stock al aprobar la cotización. Idempotente.
-- ============================================================================

-- Partida de cotización ligada a un producto de inventario (descuenta al aprobar).
ALTER TABLE public.quote_items
    ADD COLUMN IF NOT EXISTS inventory_item_id UUID REFERENCES public.inventory_items(id) ON DELETE SET NULL;

-- Bandera para evitar descontar dos veces si se reaprueba la cotización.
ALTER TABLE public.quotes
    ADD COLUMN IF NOT EXISTS inventory_deducted BOOLEAN NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
-- ============================================================================
