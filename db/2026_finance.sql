-- ============================================================================
-- KANRI · Finanzas: movimientos manuales (ingresos/egresos extra)
-- Idempotente. El dashboard combina esto con facturas, compras y nómina.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.finance_transactions (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id    UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    kind         TEXT NOT NULL DEFAULT 'expense',  -- income | expense
    category     TEXT,
    description  TEXT,
    amount       NUMERIC NOT NULL DEFAULT 0,
    tx_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    project_id   TEXT,
    created_by   UUID,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fin_tx_tenant ON public.finance_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fin_tx_date ON public.finance_transactions(tx_date);
ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "finance write" ON public.finance_transactions;
CREATE POLICY "finance write" ON public.finance_transactions
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname='current_tenant') THEN
        EXECUTE 'DROP POLICY IF EXISTS "tenant isolation finance_transactions" ON public.finance_transactions;
                 CREATE POLICY "tenant isolation finance_transactions" ON public.finance_transactions
                 AS RESTRICTIVE FOR ALL TO authenticated
                 USING (tenant_id = public.current_tenant() OR public.is_platform_owner())
                 WITH CHECK (tenant_id = public.current_tenant() OR public.is_platform_owner())';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname='set_tenant_id') THEN
        EXECUTE 'DROP TRIGGER IF EXISTS trg_set_tenant_finance ON public.finance_transactions;
                 CREATE TRIGGER trg_set_tenant_finance BEFORE INSERT ON public.finance_transactions
                 FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id()';
    END IF;
END$$;

NOTIFY pgrst, 'reload schema';
-- ============================================================================
