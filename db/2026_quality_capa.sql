-- ============================================================================
-- KANRI · Calidad: producto no conforme (NCR), plan de control y acciones
-- correctivas (CAPA / action list del proyecto).
--   ISO 9001:2015 §8.7 (control de salidas no conformes)
--                 §10.2 (no conformidad y acción correctiva)
--   AIAG / APQP  — Plan de control por proyecto de maquinado.
-- Aislado por empresa (tenant). Idempotente: se puede correr más de una vez.
-- ============================================================================

-- ── 1) NCR: campos del procedimiento de producto no conforme ───────────────
ALTER TABLE public.ncrs
    ADD COLUMN IF NOT EXISTS tenant_id          UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS part_number        TEXT,
    ADD COLUMN IF NOT EXISTS quantity_affected  NUMERIC,
    ADD COLUMN IF NOT EXISTS detected_area      TEXT,          -- Calidad | Producción | Recibo | Cliente | Proveedor
    ADD COLUMN IF NOT EXISTS defect_type        TEXT,          -- Dimensional | Acabado | Material | Documentación | Daño | Otro
    ADD COLUMN IF NOT EXISTS containment        TEXT,          -- acción de contención inmediata
    ADD COLUMN IF NOT EXISTS disposition        TEXT,          -- Retrabajo | Reparación | Desecho | Usar como está | Devolver a proveedor | Reinspección 100%
    ADD COLUMN IF NOT EXISTS disposition_notes  TEXT,
    ADD COLUMN IF NOT EXISTS disposition_by     TEXT,
    ADD COLUMN IF NOT EXISTS disposition_at     TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS why_analysis       JSONB,         -- 5 porqués: ["¿por qué 1?", ...]
    ADD COLUMN IF NOT EXISTS verification       TEXT,          -- verificación de eficacia
    ADD COLUMN IF NOT EXISTS effective          BOOLEAN,
    ADD COLUMN IF NOT EXISTS cost_impact        NUMERIC,
    ADD COLUMN IF NOT EXISTS updated_at         TIMESTAMPTZ DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_ncrs_tenant ON public.ncrs(tenant_id);

-- ── 2) Plan de control (encabezado, uno por proyecto) ──────────────────────
CREATE TABLE IF NOT EXISTS public.control_plans (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id     UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    project_id    TEXT NOT NULL,
    phase         TEXT DEFAULT 'Producción',   -- Prototipo | Pre-lanzamiento | Producción
    revision      TEXT DEFAULT 'A',
    prepared_by   TEXT,
    approved_by   TEXT,
    key_contact   TEXT,
    notes         TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_control_plans_project ON public.control_plans(tenant_id, project_id);
CREATE INDEX IF NOT EXISTS idx_control_plans_tenant ON public.control_plans(tenant_id);

-- ── 3) Plan de control (renglones: característica por operación) ──────────
CREATE TABLE IF NOT EXISTS public.control_plan_items (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id            UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    project_id           TEXT NOT NULL,
    bom_item_id          UUID,
    part_number          TEXT,
    operation_no         TEXT,                 -- 10, 20, 30…
    operation            TEXT,                 -- Torneado CNC, Fresado, Tratamiento…
    machine              TEXT,
    characteristic_no    TEXT,
    characteristic       TEXT NOT NULL,        -- Ø exterior, rugosidad, dureza…
    char_type            TEXT DEFAULT 'Producto', -- Producto | Proceso
    special_char         TEXT,                 -- CC (crítica) | SC (significativa) | null
    specification        TEXT,                 -- Ø25.00 ±0.02 · Ra 1.6 máx.
    evaluation_technique TEXT,                 -- Micrómetro, CMM, Vernier…
    instrument_id        TEXT,                 -- measurement_instruments.id
    sample_size          TEXT,                 -- 1 pza, 5 pzas, 100%
    frequency            TEXT,                 -- 1a pieza, c/hora, por lote…
    control_method       TEXT,                 -- Hoja de inspección, SPC, Poka-yoke…
    reaction_plan        TEXT,                 -- qué hacer si sale de especificación
    responsible          TEXT,
    sort_order           INT DEFAULT 0,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cpi_tenant  ON public.control_plan_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cpi_project ON public.control_plan_items(project_id);

-- ── 4) Acciones correctivas (action list multi-área del proyecto) ─────────
CREATE TABLE IF NOT EXISTS public.corrective_actions (
    id                    TEXT PRIMARY KEY DEFAULT ('CA-' || to_char(NOW(),'YYYY') || '-' || substr(md5(random()::text), 1, 6)),
    tenant_id             UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    project_id            TEXT,
    source_area           TEXT NOT NULL DEFAULT 'Calidad',  -- Calidad | Producción | Diseño | Compras | Ventas | Cliente | Auditoría | Otra
    source_type           TEXT DEFAULT 'NCR',               -- NCR | Plan de control | Queja de cliente | Auditoría | Proveedor | Mejora | Otro
    source_ref            TEXT,                             -- p. ej. NCR-2026-123
    ncr_id                TEXT,
    control_plan_item_id  UUID,
    title                 TEXT NOT NULL,
    problem               TEXT,
    root_cause            TEXT,
    action_type           TEXT DEFAULT 'Correctiva',        -- Contención | Correctiva | Preventiva | Mejora
    action                TEXT,
    responsible           TEXT,
    due_date              DATE,
    priority              TEXT DEFAULT 'Media',             -- Alta | Media | Baja
    status                TEXT NOT NULL DEFAULT 'Abierta',  -- Abierta | En proceso | En verificación | Cerrada | Cancelada
    verification          TEXT,
    effective             BOOLEAN,
    verified_by           TEXT,
    verified_at           DATE,
    closed_at             TIMESTAMPTZ,
    created_by            TEXT,
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ca_tenant  ON public.corrective_actions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ca_project ON public.corrective_actions(project_id);
CREATE INDEX IF NOT EXISTS idx_ca_status  ON public.corrective_actions(status);

-- ── RLS: aislamiento por empresa (mismo patrón que el resto de KANRI) ─────
-- (ncrs ya quedó aislada en 2026_multitenant_migration / tenant_hardening)
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['control_plans','control_plan_items','corrective_actions'] LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
        EXECUTE format('DROP POLICY IF EXISTS "capa write %1$s" ON public.%1$s;
             CREATE POLICY "capa write %1$s" ON public.%1$s FOR ALL TO authenticated USING (true) WITH CHECK (true);', t);
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

-- NCR previas sin empresa: se asignan a la empresa de su proyecto.
UPDATE public.ncrs n
   SET tenant_id = p.tenant_id
  FROM public.projects p
 WHERE n.project_id = p.id
   AND n.tenant_id IS NULL
   AND p.tenant_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
-- ============================================================================
