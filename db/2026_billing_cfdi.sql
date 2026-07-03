-- ============================================================================
-- KANRI · Facturación CFDI 4.0 (Facturapi) — integración y facturas
-- ----------------------------------------------------------------------------
-- Requiere el stack multi-tenant (current_tenant/is_platform_owner/set_tenant_id).
-- Idempotente.
-- ============================================================================

-- Integraciones por empresa (llave de Facturapi, etc.). La llave la lee SOLO la
-- Edge Function con service_role; el frontend nunca la consulta.
CREATE TABLE IF NOT EXISTS public.tenant_integrations (
    tenant_id       UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
    facturapi_key   TEXT,
    facturapi_test  BOOLEAN NOT NULL DEFAULT true,
    facturapi_org   TEXT,
    connected       BOOLEAN NOT NULL DEFAULT false,
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.tenant_integrations ENABLE ROW LEVEL SECURITY;

-- Lectura del estatus (connected/test/org) por miembros de la empresa; la
-- escritura se hace desde la Edge Function (service_role bypassa RLS).
DROP POLICY IF EXISTS "integrations self read" ON public.tenant_integrations;
CREATE POLICY "integrations self read" ON public.tenant_integrations
    FOR SELECT TO authenticated
    USING (
        tenant_id = public.current_tenant()
        OR (EXISTS (SELECT 1 FROM pg_proc WHERE proname='is_platform_owner') AND public.is_platform_owner())
    );

-- Facturas emitidas.
CREATE TABLE IF NOT EXISTS public.invoices (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id      UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    facturapi_id   TEXT,
    folio          TEXT,
    uuid           TEXT,
    receptor_name  TEXT,
    receptor_rfc   TEXT,
    total          NUMERIC NOT NULL DEFAULT 0,
    currency       TEXT NOT NULL DEFAULT 'MXN',
    status         TEXT NOT NULL DEFAULT 'valid',
    pdf_url        TEXT,
    xml_url        TEXT,
    project_id     TEXT,
    quote_id       TEXT,
    created_by     UUID,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON public.invoices(tenant_id);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoices write" ON public.invoices;
CREATE POLICY "invoices write" ON public.invoices
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname='current_tenant') THEN
        EXECUTE 'DROP POLICY IF EXISTS "tenant isolation invoices" ON public.invoices;
                 CREATE POLICY "tenant isolation invoices" ON public.invoices
                 AS RESTRICTIVE FOR ALL TO authenticated
                 USING (tenant_id = public.current_tenant() OR public.is_platform_owner())
                 WITH CHECK (tenant_id = public.current_tenant() OR public.is_platform_owner())';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname='set_tenant_id') THEN
        EXECUTE 'DROP TRIGGER IF EXISTS trg_set_tenant_invoices ON public.invoices;
                 CREATE TRIGGER trg_set_tenant_invoices BEFORE INSERT ON public.invoices
                 FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id()';
    END IF;
END$$;

NOTIFY pgrst, 'reload schema';
-- ============================================================================
