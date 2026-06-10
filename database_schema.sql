-- ============================================================================
-- KOJI CODE ERP — DATABASE SCHEMA (Supabase / PostgreSQL)
-- ----------------------------------------------------------------------------
-- Esta schema cubre el workflow completo de un taller CNC:
-- Cotización → Diseño → Compras → Producción → Calidad → Embarque → PMO.
--
-- Convenciones:
--   · IDs de negocio en TEXT con prefijo (IMC-, PO-, WO-, NCR-, QA-, etc.).
--   · IDs internos / FKs hidden en UUID.
--   · Estados como TEXT con CHECK donde aplica para legibilidad en queries.
--   · timestamps `created_at` / `updated_at` en TODAS las tablas.
--   · Auditoría central via `audit_logs` + triggers.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. CRM & PERFILES
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profiles (
    id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name    TEXT NOT NULL,
    email        TEXT UNIQUE NOT NULL,
    avatar_url   TEXT,
    role         TEXT DEFAULT 'Operador',
    department   TEXT DEFAULT 'Producción',
    phone        TEXT,
    status       TEXT DEFAULT 'Activo',
    join_date    TIMESTAMPTZ DEFAULT NOW(),
    bio          TEXT,
    salary       NUMERIC DEFAULT 0,
    pin_code     TEXT,  -- PIN 4-6 dígitos para portal del técnico (hash)
    metadata     JSONB DEFAULT '{}'::jsonb,  -- portfolio: skills, certs, experiencia
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on auth user insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        NEW.email,
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 2. CLIENTES (master)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.customers (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name          TEXT NOT NULL,
    contact_name  TEXT,
    contact_email TEXT,
    phone         TEXT,
    tax_id        TEXT,        -- RFC
    address       TEXT,
    notes         TEXT,
    is_active     BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 3. PROVEEDORES (master de compras)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.suppliers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL,
    contact_name    TEXT,
    contact_email   TEXT,
    phone           TEXT,
    tax_id          TEXT,
    address         TEXT,
    payment_terms   TEXT,        -- Net 30, Net 60, contado, etc.
    rating          INTEGER CHECK (rating BETWEEN 1 AND 5),
    is_certified    BOOLEAN DEFAULT FALSE,
    is_active       BOOLEAN DEFAULT TRUE,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 3b. COTIZACIONES — catálogo de precios y quotes
-- ---------------------------------------------------------------------------

-- Catálogo de precios de materiales (price book del comprador)
CREATE TABLE IF NOT EXISTS public.material_prices (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material      TEXT NOT NULL,               -- 'Acero 4140'
    description   TEXT,                        -- 'Barra redonda 2"'
    uom           TEXT NOT NULL DEFAULT 'kg',  -- kg, barra, placa, pza
    unit_price    NUMERIC NOT NULL DEFAULT 0,
    currency      TEXT DEFAULT 'MXN',
    supplier_id   UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    supplier_name TEXT,
    valid_until   DATE,
    notes         TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_material_prices_material ON public.material_prices(material);

CREATE TABLE IF NOT EXISTS public.quotes (
    id                    TEXT PRIMARY KEY,    -- COT-2026-001
    customer_id           UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    client_name           TEXT NOT NULL,
    project_name          TEXT NOT NULL,
    status                TEXT NOT NULL DEFAULT 'Borrador'
                          CHECK (status IN ('Borrador','Enviada','Aprobada','Rechazada','Convertida','Expirada')),
    currency              TEXT DEFAULT 'MXN',
    margin_pct            NUMERIC DEFAULT 30,   -- margen default de la cotización
    tax_pct               NUMERIC DEFAULT 16,   -- IVA
    machine_rate_per_hour NUMERIC DEFAULT 650,  -- tarifa máquina default
    valid_until           DATE,
    notes                 TEXT,
    subtotal              NUMERIC DEFAULT 0,
    total                 NUMERIC DEFAULT 0,
    converted_project_id  TEXT REFERENCES public.projects(id) ON DELETE SET NULL,
    created_by            UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quotes_status ON public.quotes(status);

CREATE TABLE IF NOT EXISTS public.quote_items (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quote_id            TEXT REFERENCES public.quotes(id) ON DELETE CASCADE,
    part_number         TEXT NOT NULL,
    description         TEXT,
    quantity            NUMERIC NOT NULL DEFAULT 1,
    material_price_id   UUID REFERENCES public.material_prices(id) ON DELETE SET NULL,
    material_name       TEXT,
    material_qty        NUMERIC DEFAULT 0,      -- consumo por pieza (en uom del material)
    material_unit_cost  NUMERIC DEFAULT 0,      -- snapshot del precio al cotizar
    machining_hours     NUMERIC DEFAULT 0,      -- horas máquina por pieza
    machine_rate        NUMERIC DEFAULT 0,      -- tarifa usada
    extra_cost          NUMERIC DEFAULT 0,      -- hardware / tratamientos por pieza
    margin_pct          NUMERIC,                -- override del margen; NULL usa el de la quote
    drawing_file        TEXT,                   -- nombre del plano 2D asociado
    unit_price          NUMERIC DEFAULT 0,      -- calculado
    line_total          NUMERIC DEFAULT 0,      -- calculado
    sort_order          INTEGER DEFAULT 0,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quote_items_quote ON public.quote_items(quote_id);

-- ---------------------------------------------------------------------------
-- 3c. PROJECT TASKS — plan de trabajo simple (WBS ligero)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.project_tasks (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id     TEXT REFERENCES public.projects(id) ON DELETE CASCADE,
    name           TEXT NOT NULL,
    scheduled_date DATE,
    start_date     DATE,
    end_date       DATE,
    department     TEXT,                          -- Compras, Diseño, Producción, Calidad, Embarque
    progress       INTEGER DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','in-progress','completed','cancelled')),
    sort_order     INTEGER DEFAULT 0,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_tasks_project ON public.project_tasks(project_id);

-- Para ampliar tablas ya creadas, los siguientes ALTER son idempotentes:
ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS end_date   DATE;
ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS progress   INTEGER DEFAULT 0;

-- Notas y actividad por proyecto
CREATE TABLE IF NOT EXISTS public.project_notes (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id TEXT REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    user_name  TEXT,
    action     TEXT NOT NULL,                -- 'creó el proyecto', 'agregó una nota: ...', etc.
    note_type  TEXT NOT NULL DEFAULT 'note'
               CHECK (note_type IN ('note','system','status_change','milestone')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_notes_project ON public.project_notes(project_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 3d. MASTER PLAN — planeación formal PMI
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.master_plans (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      TEXT REFERENCES public.projects(id) ON DELETE CASCADE,
    name            TEXT NOT NULL DEFAULT 'Master Plan v1',
    version         INTEGER DEFAULT 1,
    methodology     TEXT DEFAULT 'PMI-Predictivo'
                    CHECK (methodology IN ('PMI-Predictivo','Ágil','Híbrido')),
    template_used   TEXT,                       -- 'CNC-Estándar', 'Moldes', 'Herramentales', 'Custom'
    baseline_start  DATE NOT NULL,
    baseline_end    DATE NOT NULL,
    actual_start    DATE,
    actual_end      DATE,
    status          TEXT NOT NULL DEFAULT 'Borrador'
                    CHECK (status IN ('Borrador','Activo','Archivado')),
    risk_summary    TEXT,
    notes           TEXT,
    created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_master_plans_project ON public.master_plans(project_id);

CREATE TABLE IF NOT EXISTS public.master_plan_tasks (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    master_plan_id    UUID REFERENCES public.master_plans(id) ON DELETE CASCADE,
    wbs_code          TEXT NOT NULL,               -- "1.1", "2.3"
    name              TEXT NOT NULL,
    department        TEXT,                        -- Compras, Diseño, Producción, Calidad, Embarque
    start_date        DATE NOT NULL,
    end_date          DATE NOT NULL,
    progress          INTEGER DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    is_milestone      BOOLEAN DEFAULT FALSE,
    is_critical_path  BOOLEAN DEFAULT FALSE,
    dependencies      JSONB DEFAULT '[]'::jsonb,   -- array de wbs_code que deben terminar antes
    assigned_to       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    notes             TEXT,
    sort_order        INTEGER DEFAULT 0,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mpt_plan ON public.master_plan_tasks(master_plan_id, sort_order);

-- ---------------------------------------------------------------------------
-- 3e. JUNTAS DEL PROYECTO — calendario de seguimiento (readiness PMI)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.project_meetings (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id       TEXT REFERENCES public.projects(id) ON DELETE CASCADE,
    master_plan_id   UUID REFERENCES public.master_plans(id) ON DELETE SET NULL,
    title            TEXT NOT NULL,
    meeting_type     TEXT NOT NULL DEFAULT 'Semanal'
                     CHECK (meeting_type IN ('Kick-off','Semanal','Quincenal','Mensual','Hito','Cierre')),
    scheduled_at     TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER DEFAULT 30,
    attendees        JSONB DEFAULT '[]'::jsonb,    -- array de departamentos / participantes
    status           TEXT NOT NULL DEFAULT 'Programada'
                     CHECK (status IN ('Programada','Realizada','Cancelada')),
    notes            TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meetings_project ON public.project_meetings(project_id, scheduled_at);

-- ---------------------------------------------------------------------------
-- 4. PROYECTOS
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.projects (
    id               TEXT PRIMARY KEY,            -- IMC-2026-042
    name             TEXT NOT NULL,
    customer_id      UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    client_name      TEXT NOT NULL,               -- snapshot por si se borra customer
    status           TEXT NOT NULL DEFAULT 'Cotización'
                     CHECK (status IN ('Cotización','Diseño','Compras','En Producción','Calidad','Embarque','Entregado','Cancelado')),
    progress         INTEGER DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    purchase_order   TEXT,                        -- OC del cliente
    quote_amount     NUMERIC,
    currency         TEXT DEFAULT 'MXN',
    start_date       DATE NOT NULL DEFAULT CURRENT_DATE,
    deadline         DATE NOT NULL,
    delivered_at     TIMESTAMPTZ,
    manager_id       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    description      TEXT,
    -- Portal de cliente
    client_portal_token TEXT UNIQUE,              -- magic link token
    client_portal_expires TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_deadline ON public.projects(deadline);
CREATE INDEX IF NOT EXISTS idx_projects_customer ON public.projects(customer_id);

-- ---------------------------------------------------------------------------
-- 5. ARCHIVOS DE PROYECTO (OC del cliente, planos, contratos, fotos)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.project_files (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id   TEXT REFERENCES public.projects(id) ON DELETE CASCADE,
    bom_item_id  UUID,                            -- opcional: archivo asociado a una pieza
    category     TEXT NOT NULL
                 CHECK (category IN ('OC_Cliente','BOM','Plano_2D','Modelo_3D','Cotizacion','Contrato','Foto','Reporte_QA','Otro')),
    file_name    TEXT NOT NULL,
    storage_path TEXT NOT NULL,                   -- ruta en Supabase Storage
    mime_type    TEXT,
    size_bytes   BIGINT,
    uploaded_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_client_visible BOOLEAN DEFAULT FALSE,      -- mostrar en portal cliente
    notes        TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_files_project ON public.project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_project_files_category ON public.project_files(category);

-- ---------------------------------------------------------------------------
-- 6. BOM (Lista de materiales / partes)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.bom_items (
    id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id               TEXT REFERENCES public.projects(id) ON DELETE CASCADE,
    part_number              TEXT NOT NULL,
    description              TEXT,
    category                 TEXT NOT NULL DEFAULT 'General',
                             -- Materia Prima, Herramental, Hardware, Componente, etc.
    material                 TEXT,             -- Acero 4140, Al 6061, etc.
    quantity                 NUMERIC NOT NULL DEFAULT 1,
    uom                      TEXT NOT NULL DEFAULT 'Pzas',
    -- Estado de compra del item
    bom_status               TEXT NOT NULL DEFAULT 'Pendiente'
                             CHECK (bom_status IN ('Pendiente','Solicitado','Tránsito','Recibido','Stock')),
    -- Estado de manufactura
    manufacturing_status     TEXT NOT NULL DEFAULT 'PENDIENTE'
                             CHECK (manufacturing_status IN ('PENDIENTE','EN PROCESO','CALIDAD','TERMINADO','RECHAZADO')),
    drawing_url              TEXT,
    model_url                TEXT,
    assigned_technician_id   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at               TIMESTAMPTZ DEFAULT NOW(),
    updated_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bom_items_project ON public.bom_items(project_id);
CREATE INDEX IF NOT EXISTS idx_bom_items_mfg_status ON public.bom_items(manufacturing_status);

-- ---------------------------------------------------------------------------
-- 7. COMPRAS — Requisiciones y POs
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.requisitions (
    id               TEXT PRIMARY KEY,            -- REQ-2026-101
    project_id       TEXT REFERENCES public.projects(id) ON DELETE SET NULL,
    bom_item_id      UUID REFERENCES public.bom_items(id) ON DELETE SET NULL,
    description      TEXT NOT NULL,
    quantity         NUMERIC NOT NULL DEFAULT 1,
    uom              TEXT DEFAULT 'Pzas',
    requester_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    priority         TEXT DEFAULT 'Media'
                     CHECK (priority IN ('Alta','Media','Baja')),
    status           TEXT NOT NULL DEFAULT 'Pendiente'
                     CHECK (status IN ('Pendiente','Cotizando','Aprobada','Rechazada','Ordenada','Cerrada')),
    notes            TEXT,
    needed_by        DATE,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id               TEXT PRIMARY KEY,            -- PO-2026-089
    supplier_id      UUID REFERENCES public.suppliers(id) ON DELETE RESTRICT,
    project_id       TEXT REFERENCES public.projects(id) ON DELETE SET NULL,
    status           TEXT NOT NULL DEFAULT 'Borrador'
                     CHECK (status IN ('Borrador','Emitida','Confirmada','Tránsito','Recibida_Parcial','Recibida','Cerrada','Cancelada')),
    total_amount     NUMERIC DEFAULT 0,
    currency         TEXT DEFAULT 'MXN',
    issued_at        TIMESTAMPTZ,
    expected_delivery DATE,
    received_at      TIMESTAMPTZ,
    issued_by        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    notes            TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.purchase_order_items (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_order_id   TEXT REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    requisition_id      TEXT REFERENCES public.requisitions(id) ON DELETE SET NULL,
    bom_item_id         UUID REFERENCES public.bom_items(id) ON DELETE SET NULL,
    description         TEXT NOT NULL,
    quantity            NUMERIC NOT NULL,
    uom                 TEXT DEFAULT 'Pzas',
    unit_price          NUMERIC NOT NULL DEFAULT 0,
    line_total          NUMERIC GENERATED ALWAYS AS (quantity * unit_price) STORED,
    received_qty        NUMERIC DEFAULT 0,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_po_supplier ON public.purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_project  ON public.purchase_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_po_status   ON public.purchase_orders(status);

-- ---------------------------------------------------------------------------
-- 8. PRODUCCIÓN — Work Orders y etapas/operaciones
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.machines (
    id            TEXT PRIMARY KEY,            -- CNC-001
    type          TEXT NOT NULL,               -- "Centro de maquinado 3 ejes"
    status        TEXT NOT NULL DEFAULT 'Disponible'
                  CHECK (status IN ('Disponible','Operando','Setup','Mantenimiento','Fuera_Servicio')),
    location      TEXT,
    notes         TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.work_orders (
    id                  TEXT PRIMARY KEY,        -- WO-2026-089
    project_id          TEXT REFERENCES public.projects(id) ON DELETE CASCADE,
    bom_item_id         UUID REFERENCES public.bom_items(id) ON DELETE CASCADE,
    machine_id          TEXT REFERENCES public.machines(id) ON DELETE SET NULL,
    assigned_technician_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    quantity            NUMERIC NOT NULL,
    completed_qty       NUMERIC DEFAULT 0,
    priority            TEXT DEFAULT 'Normal'
                        CHECK (priority IN ('Normal','Alta','Urgente','Crítica')),
    status              TEXT NOT NULL DEFAULT 'Pendiente'
                        CHECK (status IN ('Pendiente','Setup','En Proceso','Pausado','Calidad','Completado','Cancelado')),
    planned_start       TIMESTAMPTZ,
    planned_end         TIMESTAMPTZ,
    actual_start        TIMESTAMPTZ,
    actual_end          TIMESTAMPTZ,
    notes               TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wo_project ON public.work_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_wo_tech    ON public.work_orders(assigned_technician_id);
CREATE INDEX IF NOT EXISTS idx_wo_status  ON public.work_orders(status);

-- Etapas/operaciones por work order (desbaste, acabado, taladrado, etc.)
CREATE TABLE IF NOT EXISTS public.work_order_stages (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    work_order_id   TEXT REFERENCES public.work_orders(id) ON DELETE CASCADE,
    sequence        INTEGER NOT NULL,        -- orden de la operación
    name            TEXT NOT NULL,           -- "Desbaste", "Acabado", "Inspección dim."
    status          TEXT NOT NULL DEFAULT 'Pendiente'
                    CHECK (status IN ('Pendiente','En Proceso','Pausado','Completado','Saltado')),
    estimated_minutes INTEGER,
    actual_minutes  INTEGER,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    operator_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(work_order_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_stages_wo ON public.work_order_stages(work_order_id);

-- Time tracking real por operario (clock in/out)
CREATE TABLE IF NOT EXISTS public.time_entries (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    work_order_id   TEXT REFERENCES public.work_orders(id) ON DELETE CASCADE,
    stage_id        UUID REFERENCES public.work_order_stages(id) ON DELETE SET NULL,
    operator_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at        TIMESTAMPTZ,
    duration_minutes INTEGER,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 9. CALIDAD
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.quality_inspections (
    id                TEXT PRIMARY KEY,            -- QA-2026-055
    project_id        TEXT REFERENCES public.projects(id) ON DELETE CASCADE,
    bom_item_id       UUID REFERENCES public.bom_items(id) ON DELETE CASCADE,
    work_order_id     TEXT REFERENCES public.work_orders(id) ON DELETE SET NULL,
    inspection_type   TEXT NOT NULL
                      CHECK (inspection_type IN ('Recibo Material','Primera Pieza','En Proceso','Final')),
    inspector_id      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    inspection_date   TIMESTAMPTZ DEFAULT NOW(),
    result            TEXT NOT NULL
                      CHECK (result IN ('Aprobado','Rechazado','Con Observaciones')),
    sample_size       INTEGER,
    notes             TEXT,
    report_url        TEXT,                        -- PDF dimensional / reporte
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qa_project ON public.quality_inspections(project_id);
CREATE INDEX IF NOT EXISTS idx_qa_result  ON public.quality_inspections(result);

-- Non-Conformance Reports
CREATE TABLE IF NOT EXISTS public.ncrs (
    id                TEXT PRIMARY KEY,            -- NCR-2026-012
    project_id        TEXT REFERENCES public.projects(id) ON DELETE CASCADE,
    bom_item_id       UUID REFERENCES public.bom_items(id) ON DELETE CASCADE,
    inspection_id     TEXT REFERENCES public.quality_inspections(id) ON DELETE SET NULL,
    issue_description TEXT NOT NULL,
    severity          TEXT NOT NULL DEFAULT 'Baja'
                      CHECK (severity IN ('Baja','Media','Alta','Crítica')),
    status            TEXT NOT NULL DEFAULT 'Abierta'
                      CHECK (status IN ('Abierta','En Investigación','Acción Correctiva','Cerrada')),
    root_cause        TEXT,
    action_plan       TEXT,
    notify_customer   BOOLEAN DEFAULT FALSE,
    created_by        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    closed_by         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    closed_at         TIMESTAMPTZ
);

-- Instrumentos de medición (calibración ISO 9001)
CREATE TABLE IF NOT EXISTS public.measurement_instruments (
    id                TEXT PRIMARY KEY,            -- INS-001
    name              TEXT NOT NULL,
    brand             TEXT,
    serial_number     TEXT,
    last_calibration  DATE,
    next_calibration  DATE,
    status            TEXT NOT NULL DEFAULT 'Calibrado'
                      CHECK (status IN ('Calibrado','Por Calibrar','Vencido','Fuera de Servicio')),
    notes             TEXT,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 10. EMBARQUE — Packing lists + etiquetas de caja
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.shipments (
    id                TEXT PRIMARY KEY,            -- SHIP-2026-005
    project_id        TEXT REFERENCES public.projects(id) ON DELETE CASCADE,
    status            TEXT NOT NULL DEFAULT 'Preparando'
                      CHECK (status IN ('Preparando','Listo','En Tránsito','Entregado','Cancelado')),
    carrier           TEXT,
    tracking_number   TEXT,
    shipped_at        TIMESTAMPTZ,
    delivered_at      TIMESTAMPTZ,
    ship_to_address   TEXT,
    packing_list_url  TEXT,
    notes             TEXT,
    created_by        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Cada caja del embarque (etiqueta imprimible con QR)
CREATE TABLE IF NOT EXISTS public.shipping_labels (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id       TEXT REFERENCES public.shipments(id) ON DELETE CASCADE,
    box_number        TEXT NOT NULL,               -- "1 de 5"
    weight_kg         NUMERIC,
    dimensions_cm     TEXT,                        -- "30x20x15"
    qr_token          TEXT UNIQUE NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
    label_pdf_url     TEXT,
    printed_at        TIMESTAMPTZ,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Contenido de cada caja
CREATE TABLE IF NOT EXISTS public.shipping_label_items (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    label_id          UUID REFERENCES public.shipping_labels(id) ON DELETE CASCADE,
    bom_item_id       UUID REFERENCES public.bom_items(id) ON DELETE SET NULL,
    description       TEXT NOT NULL,
    quantity          NUMERIC NOT NULL,
    uom               TEXT DEFAULT 'Pzas',
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipments_project ON public.shipments(project_id);
CREATE INDEX IF NOT EXISTS idx_labels_shipment   ON public.shipping_labels(shipment_id);

-- ---------------------------------------------------------------------------
-- 11. REPORTES PMO (snapshots históricos para portal cliente)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.pmo_reports (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id        TEXT REFERENCES public.projects(id) ON DELETE CASCADE,
    report_type       TEXT NOT NULL
                      CHECK (report_type IN ('Semanal','Quincenal','Mensual','Cierre','Ad-hoc')),
    period_start      DATE,
    period_end        DATE,
    progress_snapshot INTEGER,
    summary           TEXT,
    pdf_url           TEXT,
    sent_to_client    BOOLEAN DEFAULT FALSE,
    sent_at           TIMESTAMPTZ,
    generated_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 12. CHAT / NOTIFICACIONES
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.chat_channels (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name         TEXT UNIQUE NOT NULL,
    description  TEXT,
    category     TEXT,
    project_id   TEXT REFERENCES public.projects(id) ON DELETE CASCADE, -- canal por proyecto
    is_archived  BOOLEAN DEFAULT FALSE,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id    UUID REFERENCES public.chat_channels(id) ON DELETE CASCADE,
    user_id       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    content       TEXT NOT NULL,
    message_type  TEXT NOT NULL DEFAULT 'USER'
                  CHECK (message_type IN ('USER','SYSTEM','PROJECT','QUALITY','PURCHASE','PRODUCTION')),
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_msg_channel ON public.chat_messages(channel_id, created_at DESC);

-- Cola de automatizaciones (consumida por n8n via webhooks / cron)
CREATE TABLE IF NOT EXISTS public.automation_events (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type     TEXT NOT NULL,               -- 'project.status_changed', 'ncr.opened', 'inspection.final_approved', 'shipment.ready', 'pmo.weekly_due'
    entity_type    TEXT NOT NULL,               -- 'project', 'ncr', 'inspection', 'shipment'
    entity_id      TEXT NOT NULL,
    payload        JSONB,
    delivered      BOOLEAN DEFAULT FALSE,
    delivered_at   TIMESTAMPTZ,
    error          TEXT,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_undelivered ON public.automation_events(delivered, created_at)
    WHERE delivered = FALSE;

-- ---------------------------------------------------------------------------
-- 13. AUDITORÍA
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name  TEXT NOT NULL,
    record_id   TEXT NOT NULL,
    action      TEXT NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
    old_data    JSONB,
    new_data    JSONB,
    changed_by  UUID REFERENCES public.profiles(id),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_record ON public.audit_logs(table_name, record_id);

-- ---------------------------------------------------------------------------
-- 14. UPDATED_AT TRIGGERS
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN
        SELECT unnest(ARRAY[
            'profiles','customers','suppliers','projects','bom_items',
            'project_tasks','project_notes','master_plans','master_plan_tasks',
            'material_prices','quotes',
            'requisitions','purchase_orders','machines','work_orders',
            'work_order_stages','measurement_instruments','shipments'
        ])
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS set_updated_at_%I ON public.%I;
             CREATE TRIGGER set_updated_at_%I
             BEFORE UPDATE ON public.%I
             FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();',
            t, t, t, t
        );
    END LOOP;
END$$;

-- ---------------------------------------------------------------------------
-- 15. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
-- NOTA: Estas son políticas BASE. Para producción habrá que apretarlas
--       por departamento (ej. solo Compras puede escribir requisitions),
--       y crear una política especial para el portal cliente que use
--       projects.client_portal_token como llave de acceso.
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_prices         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tasks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_notes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_plans            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_plan_tasks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_meetings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_files           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_items               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requisitions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machines                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_orders             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_order_stages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_inspections     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ncrs                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurement_instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_labels         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_label_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pmo_reports             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_channels           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs              ENABLE ROW LEVEL SECURITY;

-- Helper: ¿el usuario actual es admin / PM?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('Administrador','Administración / PM')
    );
$$;

-- Lectura general para usuarios autenticados
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN
        SELECT unnest(ARRAY[
            'profiles','customers','suppliers','projects','project_files',
            'project_tasks','project_notes','master_plans','master_plan_tasks',
            'project_meetings','material_prices','quotes','quote_items',
            'bom_items','requisitions','purchase_orders','purchase_order_items',
            'machines','work_orders','work_order_stages','time_entries',
            'quality_inspections','ncrs','measurement_instruments',
            'shipments','shipping_labels','shipping_label_items',
            'pmo_reports','chat_channels','chat_messages'
        ])
    LOOP
        EXECUTE format(
            'DROP POLICY IF EXISTS "auth read %I" ON public.%I;
             CREATE POLICY "auth read %I" ON public.%I
             FOR SELECT TO authenticated USING (true);',
            t, t, t, t
        );
    END LOOP;
END$$;

-- Admins pueden modificar todo
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN
        SELECT unnest(ARRAY[
            'customers','suppliers','projects','project_files','bom_items',
            'project_tasks','project_notes','master_plans','master_plan_tasks',
            'project_meetings','material_prices','quotes','quote_items',
            'requisitions','purchase_orders','purchase_order_items',
            'machines','work_orders','work_order_stages',
            'quality_inspections','ncrs','measurement_instruments',
            'shipments','shipping_labels','shipping_label_items',
            'pmo_reports','chat_channels'
        ])
    LOOP
        EXECUTE format(
            'DROP POLICY IF EXISTS "admin write %I" ON public.%I;
             CREATE POLICY "admin write %I" ON public.%I
             FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());',
            t, t, t, t
        );
    END LOOP;
END$$;

-- Admins pueden actualizar perfiles del personal (sólo UPDATE; INSERT lo hace
-- el trigger handle_new_user al registrar un auth.user). Sin política dedicada
-- la actualización fallaba en silencio para los Administradores.
DROP POLICY IF EXISTS "admin update profiles" ON public.profiles;
CREATE POLICY "admin update profiles" ON public.profiles
    FOR UPDATE TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Cada usuario puede actualizar su propio perfil (datos personales).
DROP POLICY IF EXISTS "self update profile" ON public.profiles;
CREATE POLICY "self update profile" ON public.profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Compras puede escribir el catálogo de precios y cotizaciones
CREATE OR REPLACE FUNCTION public.is_purchasing()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND department IN ('Compras','Administrador','Administración / PM')
    );
$$;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN SELECT unnest(ARRAY['material_prices','quotes','quote_items'])
    LOOP
        EXECUTE format(
            'DROP POLICY IF EXISTS "purchasing write %I" ON public.%I;
             CREATE POLICY "purchasing write %I" ON public.%I
             FOR ALL TO authenticated USING (public.is_purchasing()) WITH CHECK (public.is_purchasing());',
            t, t, t, t
        );
    END LOOP;
END$$;

-- Cualquier autenticado puede mandar mensajes y abrir time entries
DROP POLICY IF EXISTS "send chat" ON public.chat_messages;
CREATE POLICY "send chat" ON public.chat_messages
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "add project notes" ON public.project_notes;
CREATE POLICY "add project notes" ON public.project_notes
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "log time" ON public.time_entries;
CREATE POLICY "log time" ON public.time_entries
    FOR ALL TO authenticated
    USING (operator_id = auth.uid() OR public.is_admin())
    WITH CHECK (operator_id = auth.uid() OR public.is_admin());

-- ---------------------------------------------------------------------------
-- 16. DATOS INICIALES
-- ---------------------------------------------------------------------------

INSERT INTO public.chat_channels (name, description, category) VALUES
    ('general',     'Canal principal de comunicación',              'ADMIN'),
    ('calidad',     'Alertas y discusiones de calidad',             'DEPARTAMENTOS'),
    ('anuncios',    'Notificaciones críticas del sistema',          'ADMIN'),
    ('produccion',  'Coordinación diaria de manufactura',           'DEPARTAMENTOS'),
    ('compras',     'Requisiciones, POs y proveedores',             'DEPARTAMENTOS')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- 17. AUTOMATION TRIGGERS — populate `automation_events` for n8n consumer
-- ----------------------------------------------------------------------------
-- Cada cambio crítico en el negocio genera un row en automation_events.
-- n8n (u otro consumer) lee los eventos no entregados y los procesa.
--
-- En Supabase puedes conectar esto con Database Webhooks
-- (Settings → Database → Webhooks) apuntando a la URL de n8n.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.emit_event(
    p_event_type   TEXT,
    p_entity_type  TEXT,
    p_entity_id    TEXT,
    p_payload      JSONB
) RETURNS UUID
LANGUAGE plpgsql AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO public.automation_events (event_type, entity_type, entity_id, payload)
    VALUES (p_event_type, p_entity_type, p_entity_id, p_payload)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

-- --- Project status changed --------------------------------------------------
CREATE OR REPLACE FUNCTION public.on_project_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        PERFORM public.emit_event(
            'project.status_changed',
            'project',
            NEW.id,
            jsonb_build_object(
                'old_status', OLD.status,
                'new_status', NEW.status,
                'project_name', NEW.name,
                'client_name', NEW.client_name,
                'progress', NEW.progress,
                'deadline', NEW.deadline,
                'manager_id', NEW.manager_id
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_project_status_change ON public.projects;
CREATE TRIGGER trg_project_status_change
    AFTER UPDATE OF status ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.on_project_status_change();

-- --- NCR opened (insert with status='Abierta') -------------------------------
CREATE OR REPLACE FUNCTION public.on_ncr_opened()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.emit_event(
        'ncr.opened',
        'ncr',
        NEW.id,
        jsonb_build_object(
            'project_id', NEW.project_id,
            'bom_item_id', NEW.bom_item_id,
            'severity', NEW.severity,
            'issue_description', NEW.issue_description,
            'notify_customer', NEW.notify_customer
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ncr_opened ON public.ncrs;
CREATE TRIGGER trg_ncr_opened
    AFTER INSERT ON public.ncrs
    FOR EACH ROW EXECUTE FUNCTION public.on_ncr_opened();

-- --- Final inspection approved ----------------------------------------------
CREATE OR REPLACE FUNCTION public.on_final_inspection_approved()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.inspection_type = 'Final' AND NEW.result = 'Aprobado' THEN
        PERFORM public.emit_event(
            'inspection.final_approved',
            'inspection',
            NEW.id,
            jsonb_build_object(
                'project_id', NEW.project_id,
                'bom_item_id', NEW.bom_item_id,
                'inspector_id', NEW.inspector_id,
                'inspection_date', NEW.inspection_date
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_final_inspection ON public.quality_inspections;
CREATE TRIGGER trg_final_inspection
    AFTER INSERT ON public.quality_inspections
    FOR EACH ROW EXECUTE FUNCTION public.on_final_inspection_approved();

-- --- Shipment status changed -------------------------------------------------
CREATE OR REPLACE FUNCTION public.on_shipment_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('Listo','En Tránsito','Entregado') THEN
        PERFORM public.emit_event(
            'shipment.' || lower(replace(NEW.status, ' ', '_')),
            'shipment',
            NEW.id,
            jsonb_build_object(
                'project_id', NEW.project_id,
                'carrier', NEW.carrier,
                'tracking_number', NEW.tracking_number,
                'old_status', OLD.status,
                'new_status', NEW.status
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_shipment_status_change ON public.shipments;
CREATE TRIGGER trg_shipment_status_change
    AFTER UPDATE OF status ON public.shipments
    FOR EACH ROW EXECUTE FUNCTION public.on_shipment_status_change();

-- --- PMO report sent ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.on_pmo_report_sent()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.sent_to_client AND (OLD.sent_to_client IS NULL OR OLD.sent_to_client = FALSE) THEN
        PERFORM public.emit_event(
            'pmo.report_sent',
            'pmo_report',
            NEW.id::TEXT,
            jsonb_build_object(
                'project_id', NEW.project_id,
                'report_type', NEW.report_type,
                'period_end', NEW.period_end,
                'progress_snapshot', NEW.progress_snapshot,
                'pdf_url', NEW.pdf_url
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pmo_sent ON public.pmo_reports;
CREATE TRIGGER trg_pmo_sent
    AFTER UPDATE OF sent_to_client ON public.pmo_reports
    FOR EACH ROW EXECUTE FUNCTION public.on_pmo_report_sent();

-- --- Marca un evento como entregado (lo llama el consumer) -------------------
CREATE OR REPLACE FUNCTION public.mark_event_delivered(p_event_id UUID, p_error TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE public.automation_events
    SET delivered = (p_error IS NULL),
        delivered_at = CASE WHEN p_error IS NULL THEN NOW() ELSE delivered_at END,
        error = p_error
    WHERE id = p_event_id;
END;
$$;

-- ============================================================================
-- 18. REALTIME — habilita publication para chat y eventos en vivo
-- ============================================================================
-- Estos bloques son idempotentes (silencian el error si la tabla ya está).
DO $$
BEGIN
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;       EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_channels;       EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.automation_events;   EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.work_order_stages;   EXCEPTION WHEN duplicate_object THEN NULL; END;
END$$;
