-- ============================================================================
-- KANRI · Compras funcional (proveedores, requisiciones, órdenes de compra)
-- ----------------------------------------------------------------------------
-- 1) Vincula partidas de OC con productos de inventario (para sumar stock al
--    recibir).  2) Aplica aislamiento multi-tenant a las tablas de compras
--    (solo si ya corriste la migración multi-tenant). Idempotente.
-- ============================================================================

-- Partida de OC ligada a un producto de inventario (se suma al recibir).
ALTER TABLE public.purchase_order_items
    ADD COLUMN IF NOT EXISTS inventory_item_id UUID REFERENCES public.inventory_items(id) ON DELETE SET NULL;

-- Aislamiento por empresa (solo si existe current_tenant()).
DO $$
DECLARE
    t TEXT;
    imc UUID;
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_tenant') THEN
        SELECT id INTO imc FROM public.tenants WHERE slug = 'imc-design';
        FOR t IN SELECT unnest(ARRAY['suppliers','requisitions','purchase_orders','purchase_order_items'])
        LOOP
            EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;', t);
            IF imc IS NOT NULL THEN
                EXECUTE format('UPDATE public.%I SET tenant_id = $1 WHERE tenant_id IS NULL;', t) USING imc;
            END IF;
            EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%1$s_tenant ON public.%1$s(tenant_id);', t);
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
            EXECUTE format(
                'DROP POLICY IF EXISTS "tenant isolation %1$s" ON public.%1$s;
                 CREATE POLICY "tenant isolation %1$s" ON public.%1$s
                 AS RESTRICTIVE FOR ALL TO authenticated
                 USING (tenant_id = public.current_tenant() OR public.is_platform_owner())
                 WITH CHECK (tenant_id = public.current_tenant() OR public.is_platform_owner());', t);
            EXECUTE format(
                'DROP TRIGGER IF EXISTS trg_set_tenant_%1$s ON public.%1$s;
                 CREATE TRIGGER trg_set_tenant_%1$s BEFORE INSERT ON public.%1$s
                 FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();', t);
        END LOOP;
    END IF;
END$$;

-- Asegura permisos de escritura para usuarios operativos (si no existían).
DO $$
DECLARE t TEXT;
BEGIN
    FOR t IN SELECT unnest(ARRAY['suppliers','requisitions','purchase_orders','purchase_order_items'])
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
        EXECUTE format('DROP POLICY IF EXISTS "purchasing write %1$s" ON public.%1$s;
             CREATE POLICY "purchasing write %1$s" ON public.%1$s
             FOR ALL TO authenticated USING (true) WITH CHECK (true);', t);
    END LOOP;
END$$;

NOTIFY pgrst, 'reload schema';
-- ============================================================================
