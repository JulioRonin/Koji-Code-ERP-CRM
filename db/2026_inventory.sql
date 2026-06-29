-- ============================================================================
-- KANRI · MÓDULO DE INVENTARIO
-- ----------------------------------------------------------------------------
-- Control de stock en tiempo real: items + kárdex de movimientos. El stock se
-- mantiene automáticamente con un trigger en cada movimiento (entrada / salida
-- / ajuste), de modo que las ventas/salidas descuenten correctamente.
-- Compatible con o sin la migración multi-tenant (aplica aislamiento por
-- empresa solo si existe current_tenant()). Idempotente.
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- 1. CATÁLOGO DE ITEMS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_items (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id     UUID,
    sku           TEXT,
    name          TEXT NOT NULL,
    category      TEXT DEFAULT 'General',
    uom           TEXT DEFAULT 'Pza',
    stock         NUMERIC NOT NULL DEFAULT 0,     -- stock actual (lo mantiene el trigger)
    min_stock     NUMERIC NOT NULL DEFAULT 0,     -- mínimo (punto de reorden)
    max_stock     NUMERIC,                        -- máximo (sobre-stock)
    unit_cost     NUMERIC NOT NULL DEFAULT 0,
    unit_price    NUMERIC NOT NULL DEFAULT 0,
    location      TEXT,
    supplier_name TEXT,
    barcode       TEXT,
    active        BOOLEAN NOT NULL DEFAULT TRUE,
    notes         TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inv_items_tenant ON public.inventory_items(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_inv_items_sku ON public.inventory_items(tenant_id, sku) WHERE sku IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. KÁRDEX DE MOVIMIENTOS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id     UUID,
    item_id       UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    type          TEXT NOT NULL CHECK (type IN ('entrada','salida','ajuste')),
    quantity      NUMERIC NOT NULL,               -- magnitud (en ajuste = nuevo stock)
    reason        TEXT,                            -- venta, compra, merma, conteo…
    reference     TEXT,                            -- folio / documento
    balance_after NUMERIC,                         -- stock resultante (snapshot)
    created_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inv_mov_tenant ON public.inventory_movements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inv_mov_item   ON public.inventory_movements(item_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 3. TRIGGER: aplica el movimiento al stock en tiempo real
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.inv_apply_movement()
RETURNS TRIGGER AS $$
DECLARE
    cur NUMERIC;
    nw  NUMERIC;
BEGIN
    SELECT stock INTO cur FROM public.inventory_items WHERE id = NEW.item_id FOR UPDATE;
    IF cur IS NULL THEN cur := 0; END IF;

    IF NEW.type = 'entrada' THEN
        nw := cur + ABS(NEW.quantity);
    ELSIF NEW.type = 'salida' THEN
        nw := cur - ABS(NEW.quantity);
    ELSE -- ajuste: el stock queda exactamente en quantity
        nw := NEW.quantity;
    END IF;

    UPDATE public.inventory_items SET stock = nw, updated_at = NOW() WHERE id = NEW.item_id;
    NEW.balance_after := nw;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inv_movement ON public.inventory_movements;
CREATE TRIGGER trg_inv_movement BEFORE INSERT ON public.inventory_movements
    FOR EACH ROW EXECUTE FUNCTION public.inv_apply_movement();

-- ---------------------------------------------------------------------------
-- 4. RLS — permisos por rol (cualquier usuario operativo gestiona inventario)
-- ---------------------------------------------------------------------------
ALTER TABLE public.inventory_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inv items read"  ON public.inventory_items;
CREATE POLICY "inv items read"  ON public.inventory_items  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "inv items write" ON public.inventory_items;
CREATE POLICY "inv items write" ON public.inventory_items  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "inv mov read"  ON public.inventory_movements;
CREATE POLICY "inv mov read"  ON public.inventory_movements FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "inv mov write" ON public.inventory_movements;
CREATE POLICY "inv mov write" ON public.inventory_movements FOR INSERT TO authenticated WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 5. AISLAMIENTO POR EMPRESA (solo si ya corriste la migración multi-tenant)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_tenant') THEN
        -- Backfill al tenant IMC, si aplica.
        IF EXISTS (SELECT 1 FROM public.tenants WHERE slug = 'imc-design') THEN
            UPDATE public.inventory_items     SET tenant_id = (SELECT id FROM public.tenants WHERE slug='imc-design') WHERE tenant_id IS NULL;
            UPDATE public.inventory_movements SET tenant_id = (SELECT id FROM public.tenants WHERE slug='imc-design') WHERE tenant_id IS NULL;
        END IF;
        -- Restrictive de aislamiento + auto-relleno de tenant_id.
        EXECUTE 'DROP POLICY IF EXISTS "tenant isolation inventory_items" ON public.inventory_items;
                 CREATE POLICY "tenant isolation inventory_items" ON public.inventory_items
                 AS RESTRICTIVE FOR ALL TO authenticated
                 USING (tenant_id = public.current_tenant() OR public.is_platform_owner())
                 WITH CHECK (tenant_id = public.current_tenant() OR public.is_platform_owner());';
        EXECUTE 'DROP POLICY IF EXISTS "tenant isolation inventory_movements" ON public.inventory_movements;
                 CREATE POLICY "tenant isolation inventory_movements" ON public.inventory_movements
                 AS RESTRICTIVE FOR ALL TO authenticated
                 USING (tenant_id = public.current_tenant() OR public.is_platform_owner())
                 WITH CHECK (tenant_id = public.current_tenant() OR public.is_platform_owner());';
        EXECUTE 'DROP TRIGGER IF EXISTS trg_set_tenant_inventory_items ON public.inventory_items;
                 CREATE TRIGGER trg_set_tenant_inventory_items BEFORE INSERT ON public.inventory_items
                 FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();';
        EXECUTE 'DROP TRIGGER IF EXISTS trg_set_tenant_inventory_movements ON public.inventory_movements;
                 CREATE TRIGGER trg_set_tenant_inventory_movements BEFORE INSERT ON public.inventory_movements
                 FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();';
    END IF;
END$$;

NOTIFY pgrst, 'reload schema';
-- ============================================================================
