-- ============================================================================
-- KANRI · Endurecimiento de aislamiento multi-tenant (idempotente)
-- ----------------------------------------------------------------------------
-- Garantiza que CADA empresa solo vea sus datos. Para cada tabla con datos de
-- empresa: asegura la columna tenant_id, rellena las filas viejas (NULL) con la
-- empresa original, crea la política RESTRICTIVE de aislamiento y el trigger
-- que estampa tenant_id al insertar.
--
-- Requiere haber corrido antes db/2026_multitenant_migration.sql (define
-- current_tenant(), is_platform_owner() y set_tenant_id()).
--
-- NOTA: el dueño de plataforma (is_platform_owner) sigue viendo todo para el
-- panel; el frontend (scopeByTenant) lo acota a la empresa activa en los módulos
-- operativos. Esta SQL protege a las empresas CLIENTE entre sí.
-- ============================================================================
DO $$
DECLARE
    t TEXT;
    home_tenant UUID;
    tables TEXT[] := ARRAY[
        'customers','suppliers','projects','project_files','project_tasks',
        'project_notes','master_plans','master_plan_tasks','project_meetings',
        'material_prices','quotes','quote_items','bom_items','requisitions',
        'purchase_orders','purchase_order_items','machines','work_orders',
        'work_order_stages','time_entries','quality_inspections','ncrs',
        'measurement_instruments','dimensional_reports','shipments',
        'shipping_labels','shipping_label_items','pmo_reports',
        'chat_channels','chat_messages','inventory_items','inventory_movements',
        'company_settings','profiles'
    ];
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_tenant') THEN
        RAISE NOTICE 'Falta current_tenant(): corre primero db/2026_multitenant_migration.sql.';
        RETURN;
    END IF;

    -- Empresa "casa" para rellenar filas históricas sin tenant.
    SELECT id INTO home_tenant FROM public.tenants WHERE slug = 'imc-design' LIMIT 1;
    IF home_tenant IS NULL THEN
        SELECT id INTO home_tenant FROM public.tenants ORDER BY created_at LIMIT 1;
    END IF;

    FOREACH t IN ARRAY tables LOOP
        -- Solo si la tabla existe.
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = t
        ) THEN
            CONTINUE;
        END IF;

        -- 1) Columna tenant_id.
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;', t);

        -- 2) Backfill de filas viejas.
        IF home_tenant IS NOT NULL THEN
            EXECUTE format('UPDATE public.%I SET tenant_id = $1 WHERE tenant_id IS NULL;', t) USING home_tenant;
        END IF;

        -- 3) Índice + RLS.
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%1$s_tenant ON public.%1$s(tenant_id);', t);
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);

        -- 4) Política RESTRICTIVE de aislamiento (se combina con AND a las demás).
        EXECUTE format(
            'DROP POLICY IF EXISTS "tenant isolation %1$s" ON public.%1$s;
             CREATE POLICY "tenant isolation %1$s" ON public.%1$s
             AS RESTRICTIVE FOR ALL TO authenticated
             USING (tenant_id = public.current_tenant() OR public.is_platform_owner())
             WITH CHECK (tenant_id = public.current_tenant() OR public.is_platform_owner());', t);

        -- 5) Trigger que estampa tenant_id al insertar.
        IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_tenant_id') THEN
            EXECUTE format(
                'DROP TRIGGER IF EXISTS trg_set_tenant_%1$s ON public.%1$s;
                 CREATE TRIGGER trg_set_tenant_%1$s BEFORE INSERT ON public.%1$s
                 FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();', t);
        END IF;
    END LOOP;
END$$;

NOTIFY pgrst, 'reload schema';
-- ============================================================================
