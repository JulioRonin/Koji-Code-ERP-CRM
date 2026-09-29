-- ============================================================================
-- KANRI · Mantenimiento preventivo (PR-MTO-001 / FR-MTO-001)
--   ISO 9001:2015 §7.1.3 Infraestructura · §8.5.1 d)
-- Plan de tareas por máquina, órdenes de mantenimiento (preventivo y
-- correctivo) y checklist diario de arranque del operador.
-- Aislado por empresa (tenant). Idempotente.
-- ============================================================================

-- ── 1) Familia de equipo en el catálogo de máquinas ────────────────────────
ALTER TABLE public.machines
    ADD COLUMN IF NOT EXISTS equipment_family TEXT;   -- convencional | rectificadora | sierra | cnc | router | compresor

-- ── 2) Plan de mantenimiento: tareas por máquina ──────────────────────────
CREATE TABLE IF NOT EXISTS public.maintenance_tasks (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id     UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    machine_id    TEXT NOT NULL,
    description   TEXT NOT NULL,
    level         TEXT NOT NULL DEFAULT 'Preventivo',   -- Preventivo | Mayor
    frequency     TEXT NOT NULL DEFAULT 'Mensual',      -- Semanal | Quincenal | Mensual | Trimestral | Semestral | Anual
    performer     TEXT DEFAULT 'Técnico',               -- Técnico | Proveedor
    last_done     DATE,
    next_due      DATE,
    active        BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order    INT DEFAULT 0,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mtask_tenant  ON public.maintenance_tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mtask_machine ON public.maintenance_tasks(machine_id);

-- ── 3) Órdenes de mantenimiento ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.maintenance_orders (
    id                   TEXT PRIMARY KEY DEFAULT ('OM-' || to_char(NOW(),'YYYY') || '-' || substr(md5(random()::text), 1, 6)),
    tenant_id            UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    machine_id           TEXT NOT NULL,
    order_type           TEXT NOT NULL DEFAULT 'Preventivo',  -- Preventivo | Correctivo
    status               TEXT NOT NULL DEFAULT 'Programada',  -- Programada | En proceso | Completada | Cancelada
    scheduled_date       DATE,
    original_date        DATE,                               -- fecha antes de reprogramar
    reprogram_reason     TEXT,
    problem              TEXT,                               -- correctivo: falla reportada
    tasks                JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{task_id, description, done, notes}]
    performed_by         TEXT,
    loto_applied         BOOLEAN DEFAULT FALSE,
    loto_removed         BOOLEAN DEFAULT FALSE,
    findings             TEXT,
    parts_used           TEXT,
    downtime_hours       NUMERIC,
    test_ok              BOOLEAN DEFAULT FALSE,
    affects_quality      BOOLEAN DEFAULT FALSE,
    first_piece_released BOOLEAN DEFAULT FALSE,
    ncr_id               TEXT,
    checklist_id         UUID,                               -- origen: checklist diario con anomalía
    started_at           TIMESTAMPTZ,
    completed_at         TIMESTAMPTZ,
    created_by           TEXT,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_morder_tenant  ON public.maintenance_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_morder_machine ON public.maintenance_orders(machine_id);
CREATE INDEX IF NOT EXISTS idx_morder_status  ON public.maintenance_orders(status);

-- ── 4) Checklist diario de arranque (FR-MTO-001, secciones A y B) ─────────
CREATE TABLE IF NOT EXISTS public.maintenance_checklists (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id      UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    machine_id     TEXT NOT NULL,
    check_date     DATE NOT NULL DEFAULT CURRENT_DATE,
    shift          TEXT,                                     -- Matutino | Vespertino | Nocturno
    operator_name  TEXT,
    items          JSONB NOT NULL DEFAULT '[]'::jsonb,       -- [{key, label, result: ok|fail|na}]
    anomalies      TEXT,
    has_anomaly    BOOLEAN DEFAULT FALSE,
    order_id       TEXT,                                     -- orden correctiva generada
    created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mcheck_tenant  ON public.maintenance_checklists(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mcheck_machine ON public.maintenance_checklists(machine_id, check_date);

-- ── RLS: aislamiento por empresa (mismo patrón que el resto de KANRI) ─────
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['maintenance_tasks','maintenance_orders','maintenance_checklists'] LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
        EXECUTE format('DROP POLICY IF EXISTS "mto write %1$s" ON public.%1$s;
             CREATE POLICY "mto write %1$s" ON public.%1$s FOR ALL TO authenticated USING (true) WITH CHECK (true);', t);
        IF EXISTS (SELECT 1 FROM pg_proc WHERE proname='current_tenant') THEN
            EXECUTE format('DROP POLICY IF EXISTS "tenant isolation %1$s" ON public.%1$s;
                 CREATE POLICY "tenant isolation %1$s" ON public.%1$s
                 AS RESTRICTIVE FOR ALL TO authenticated
                 USING (tenant_id = public.current_tenant() OR public.is_platform_owner())
                 WITH CHECK (tenant_id = public.current_tenant() OR public.is_platform_owner());', t);
        END IF;
        IF EXISTS (SELECT 1 FROM pg_proc WHERE proname='set_tenant_id') THEN
            EXECUTE format('DROP TRIGGER IF EXISTS trg_set_tenant_%1$s ON public.%1$s;
                 CREATE TRIGGER trg_set_tenant_%1$s BEFORE INSERT ON public.%1$s
                 FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();', t);
        END IF;
    END LOOP;
END$$;

NOTIFY pgrst, 'reload schema';
-- ============================================================================
