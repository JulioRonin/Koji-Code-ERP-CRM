-- ============================================================================
-- KANRI · Nómina (corridas por periodo)
-- ----------------------------------------------------------------------------
-- Guarda cada corrida de nómina con sus partidas (JSONB). Aislada por empresa.
-- Requiere current_tenant()/is_platform_owner()/set_tenant_id() (multitenant).
-- Idempotente.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.payroll_runs (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id     UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_label  TEXT NOT NULL,
    periodicity   TEXT NOT NULL DEFAULT 'mensual',
    status        TEXT NOT NULL DEFAULT 'borrador',
    total_net     NUMERIC NOT NULL DEFAULT 0,
    items         JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_by    UUID,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payroll_runs_tenant ON public.payroll_runs(tenant_id);
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;

-- Escritura/lectura para usuarios autenticados (la RESTRICTIVE de abajo aísla).
DROP POLICY IF EXISTS "payroll write" ON public.payroll_runs;
CREATE POLICY "payroll write" ON public.payroll_runs
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Aislamiento por empresa (solo si existe el stack multi-tenant).
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_tenant') THEN
        EXECUTE 'DROP POLICY IF EXISTS "tenant isolation payroll_runs" ON public.payroll_runs;
                 CREATE POLICY "tenant isolation payroll_runs" ON public.payroll_runs
                 AS RESTRICTIVE FOR ALL TO authenticated
                 USING (tenant_id = public.current_tenant() OR public.is_platform_owner())
                 WITH CHECK (tenant_id = public.current_tenant() OR public.is_platform_owner())';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_tenant_id') THEN
        EXECUTE 'DROP TRIGGER IF EXISTS trg_set_tenant_payroll_runs ON public.payroll_runs;
                 CREATE TRIGGER trg_set_tenant_payroll_runs BEFORE INSERT ON public.payroll_runs
                 FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id()';
    END IF;
END$$;

NOTIFY pgrst, 'reload schema';
-- ============================================================================
