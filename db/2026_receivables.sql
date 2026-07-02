-- ============================================================================
-- KANRI · Crédito y Cobranza (cuentas por cobrar + pagos)
-- Aislado por empresa. Los pagos se reflejan como ingreso en Finanzas.
-- Idempotente.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.receivables (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id     UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    project_id    TEXT,
    customer_name TEXT NOT NULL,
    concept       TEXT,
    total_amount  NUMERIC NOT NULL DEFAULT 0,
    currency      TEXT NOT NULL DEFAULT 'MXN',
    due_date      DATE,
    notes         TEXT,
    created_by    UUID,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_receivables_tenant ON public.receivables(tenant_id);

CREATE TABLE IF NOT EXISTS public.receivable_payments (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id      UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    receivable_id  UUID REFERENCES public.receivables(id) ON DELETE CASCADE,
    amount         NUMERIC NOT NULL DEFAULT 0,
    paid_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    method         TEXT,               -- transferencia | efectivo | cheque | tarjeta
    kind           TEXT DEFAULT 'abono',-- anticipo | abono | liquidacion
    notes          TEXT,
    created_by     UUID,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_recpay_tenant ON public.receivable_payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_recpay_rec ON public.receivable_payments(receivable_id);

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['receivables','receivable_payments'] LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
        EXECUTE format('DROP POLICY IF EXISTS "cxc write %1$s" ON public.%1$s;
             CREATE POLICY "cxc write %1$s" ON public.%1$s FOR ALL TO authenticated USING (true) WITH CHECK (true);', t);
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
