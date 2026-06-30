-- ============================================================================
-- KANRI · MIGRACIÓN MULTI-TENANT (Fase 1) — aislamiento de datos por empresa
-- ============================================================================
-- Modelo: POOL (una sola base, columna tenant_id + RLS por empresa).
--
-- Estrategia de bajo riesgo:
--   * Agrega tenant_id a las tablas de negocio (nullable) y rellena (backfill)
--     todos los datos actuales al tenant "IMC Design".
--   * El aislamiento se aplica con políticas RESTRICTIVE, que se COMBINAN CON
--     AND a tus políticas actuales (rol/departamento) SIN reescribirlas. Así
--     conservas toda la lógica de permisos y solo añades el filtro por empresa.
--   * Un trigger BEFORE INSERT auto-rellena tenant_id = current_tenant(), de
--     modo que el frontend NO tiene que enviar tenant_id en cada query.
--
-- ⚠️ ANTES DE CORRER: haz un respaldo (Supabase → Database → Backups).
--    Es idempotente (IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS),
--    pero toca RLS de todo el negocio: pruébalo primero en un branch/staging.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. EXTENSIONES + FIX del trigger set_updated_at
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Algunas tablas (p. ej. project_notes) NO tienen columna updated_at, pero el
-- trigger genérico set_updated_at intentaba asignarla y rompía cualquier UPDATE
-- (incluido el backfill de tenant_id). Lo hacemos tolerante: solo asigna
-- updated_at si la fila realmente tiene esa columna.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    IF to_jsonb(NEW) ? 'updated_at' THEN
        NEW.updated_at := NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- 1. TABLA DE EMPRESAS (TENANTS)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenants (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name             TEXT NOT NULL,
    slug             TEXT UNIQUE NOT NULL,
    industry         TEXT NOT NULL DEFAULT 'cnc',
    plan             TEXT NOT NULL DEFAULT 'profesional'
                     CHECK (plan IN ('basico','profesional','enterprise')),
    status           TEXT NOT NULL DEFAULT 'trialing'
                     CHECK (status IN ('trialing','active','past_due','paused','canceled')),
    enabled_modules  JSONB NOT NULL DEFAULT '[]'::jsonb,
    billing_cycle    TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly','annual')),
    trial_ends_at    TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    stripe_customer_id     TEXT,
    stripe_subscription_id TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 2. PROFILES: pertenencia a empresa + bandera de dueño de plataforma
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_platform_owner BOOLEAN NOT NULL DEFAULT FALSE;

-- ---------------------------------------------------------------------------
-- 3. SEED + BACKFILL al tenant "IMC Design"
-- ---------------------------------------------------------------------------
-- Crea el tenant IMC si no existe (toma la empresa actual de company_settings).
INSERT INTO public.tenants (name, slug, industry, plan, status, enabled_modules)
SELECT
    COALESCE((SELECT commercial_name FROM public.company_settings LIMIT 1), 'IMC Design'),
    'imc-design', 'cnc', 'enterprise', 'active', '[]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.tenants WHERE slug = 'imc-design');

-- Asigna todos los perfiles existentes (sin empresa) a IMC.
UPDATE public.profiles
SET tenant_id = (SELECT id FROM public.tenants WHERE slug = 'imc-design')
WHERE tenant_id IS NULL;

-- ---------------------------------------------------------------------------
-- 4. tenant_id + backfill en TODAS las tablas de negocio
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    t TEXT;
    imc UUID := (SELECT id FROM public.tenants WHERE slug = 'imc-design');
BEGIN
    FOR t IN SELECT unnest(ARRAY[
        'customers','suppliers','projects','project_files','project_tasks',
        'project_notes','master_plans','master_plan_tasks','project_meetings',
        'material_prices','quotes','quote_items','bom_items','requisitions',
        'purchase_orders','purchase_order_items','machines','work_orders',
        'work_order_stages','time_entries','quality_inspections','ncrs',
        'measurement_instruments','dimensional_reports','shipments',
        'shipping_labels','shipping_label_items','pmo_reports',
        'chat_channels','chat_messages','company_settings'
    ])
    LOOP
        EXECUTE format(
            'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;',
            t
        );
        -- Backfill de los datos actuales a IMC.
        EXECUTE format('UPDATE public.%I SET tenant_id = $1 WHERE tenant_id IS NULL;', t) USING imc;
        -- Índice por tenant para que las consultas filtradas sean rápidas.
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%1$s_tenant ON public.%1$s(tenant_id);', t);
    END LOOP;
END$$;

-- ---------------------------------------------------------------------------
-- 5. FUNCIONES DE CONTEXTO
-- ---------------------------------------------------------------------------
-- Empresa del usuario autenticado. SECURITY DEFINER evita recursión de RLS al
-- leer profiles dentro de las políticas.
CREATE OR REPLACE FUNCTION public.current_tenant()
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER AS $$
    SELECT tenant_id FROM public.profiles WHERE id = auth.uid();
$$;

-- Dueño de la plataforma (equipo KANRI): puede ver/operar a través de empresas.
CREATE OR REPLACE FUNCTION public.is_platform_owner()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER AS $$
    SELECT COALESCE(
        (SELECT is_platform_owner FROM public.profiles WHERE id = auth.uid()),
        FALSE
    );
$$;

-- ---------------------------------------------------------------------------
-- 6. TRIGGER: auto-rellenar tenant_id en INSERT
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_tenant_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.tenant_id IS NULL THEN
        NEW.tenant_id := public.current_tenant();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- 7. RLS DE AISLAMIENTO (RESTRICTIVE) + trigger por tabla
-- ---------------------------------------------------------------------------
-- La política RESTRICTIVE se combina con AND a las políticas permissive ya
-- existentes (rol/departamento). Resultado: para tocar una fila se requiere
--   (alguna política de rol lo permite) AND (la fila es de TU empresa).
-- El dueño de plataforma queda exento (OR is_platform_owner()).
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN SELECT unnest(ARRAY[
        'customers','suppliers','projects','project_files','project_tasks',
        'project_notes','master_plans','master_plan_tasks','project_meetings',
        'material_prices','quotes','quote_items','bom_items','requisitions',
        'purchase_orders','purchase_order_items','machines','work_orders',
        'work_order_stages','time_entries','quality_inspections','ncrs',
        'measurement_instruments','dimensional_reports','shipments',
        'shipping_labels','shipping_label_items','pmo_reports',
        'chat_channels','chat_messages'
    ])
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);

        -- Aislamiento por empresa (RESTRICTIVE).
        EXECUTE format(
            'DROP POLICY IF EXISTS "tenant isolation %1$s" ON public.%1$s;
             CREATE POLICY "tenant isolation %1$s" ON public.%1$s
             AS RESTRICTIVE FOR ALL TO authenticated
             USING (tenant_id = public.current_tenant() OR public.is_platform_owner())
             WITH CHECK (tenant_id = public.current_tenant() OR public.is_platform_owner());',
            t
        );

        -- Trigger para auto-rellenar tenant_id en cada INSERT.
        EXECUTE format(
            'DROP TRIGGER IF EXISTS trg_set_tenant_%1$s ON public.%1$s;
             CREATE TRIGGER trg_set_tenant_%1$s BEFORE INSERT ON public.%1$s
             FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();',
            t
        );
    END LOOP;
END$$;

-- ---------------------------------------------------------------------------
-- 8. PERFILES: solo ves a la gente de TU empresa
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant isolation profiles" ON public.profiles;
CREATE POLICY "tenant isolation profiles" ON public.profiles
    AS RESTRICTIVE FOR ALL TO authenticated
    USING (
        tenant_id = public.current_tenant()
        OR id = auth.uid()                 -- siempre puedes verte a ti mismo
        OR public.is_platform_owner()
    )
    WITH CHECK (
        tenant_id = public.current_tenant()
        OR id = auth.uid()
        OR public.is_platform_owner()
    );

-- ---------------------------------------------------------------------------
-- 9. COMPANY_SETTINGS por empresa
-- ---------------------------------------------------------------------------
-- Cada empresa tiene su propia configuración. Lectura: usuarios de la empresa.
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant isolation company_settings" ON public.company_settings;
CREATE POLICY "tenant isolation company_settings" ON public.company_settings
    AS RESTRICTIVE FOR ALL TO authenticated
    USING (tenant_id = public.current_tenant() OR public.is_platform_owner())
    WITH CHECK (tenant_id = public.current_tenant() OR public.is_platform_owner());
DROP TRIGGER IF EXISTS trg_set_tenant_company_settings ON public.company_settings;
CREATE TRIGGER trg_set_tenant_company_settings BEFORE INSERT ON public.company_settings
    FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

-- ---------------------------------------------------------------------------
-- 10. RLS DE LA TABLA tenants (panel de plataforma + lectura propia)
-- ---------------------------------------------------------------------------
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
-- El usuario puede leer SU empresa; el dueño de plataforma, todas.
DROP POLICY IF EXISTS "tenant self read" ON public.tenants;
CREATE POLICY "tenant self read" ON public.tenants
    FOR SELECT TO authenticated
    USING (id = public.current_tenant() OR public.is_platform_owner());
-- Solo el dueño de plataforma gestiona empresas (alta, plan, módulos, estatus).
DROP POLICY IF EXISTS "tenant platform write" ON public.tenants;
CREATE POLICY "tenant platform write" ON public.tenants
    FOR ALL TO authenticated
    USING (public.is_platform_owner())
    WITH CHECK (public.is_platform_owner());

-- ---------------------------------------------------------------------------
-- 11. MARCA TU CUENTA COMO DUEÑO DE PLATAFORMA (ejecuta manualmente)
-- ---------------------------------------------------------------------------
-- Reemplaza el correo por el tuyo. Sin esto, nadie podrá administrar el panel
-- de Plataforma ni "entrar como" otras empresas.
--
--   UPDATE public.profiles SET is_platform_owner = TRUE
--   WHERE email = 'TU-CORREO-ADMIN@dominio.com';
--
-- Recarga el esquema de PostgREST:
NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- 12. NOTAS / PENDIENTES (Fase 2 — endurecimiento)
-- ---------------------------------------------------------------------------
--  * Aislamiento garantizado para usuarios AUTENTICADOS: cada uno solo ve las
--    filas de su empresa (current_tenant()). El dueño de plataforma ve todo.
--  * Acceso ANÓNIMO: company_settings tiene una policy de lectura "company read"
--    TO anon (heredada). Las RESTRICTIVE de arriba son TO authenticated y NO
--    afectan a anon. El login ya NO lee company_settings (usa marca KANRI), pero
--    el Portal del Cliente (magic link) sí lee datos sin sesión. Ese flujo se
--    endurece en Fase 2 con funciones SECURITY DEFINER que validan el token y
--    devuelven SOLO los datos del proyecto/tenant del enlace.
--  * Frontend: las consultas existentes NO cambian (RLS filtra solo). Falta
--    cablear platformStore/TenantContext a la tabla `tenants` y resolver
--    profiles.tenant_id en el login (setActiveTenant).
--
-- PLAN DE PRUEBAS sugerido:
--   1) Corre la migración en un BRANCH de Supabase (no en producción).
--   2) Marca tu cuenta como is_platform_owner (sección 11).
--   3) Crea un 2º tenant de prueba + un usuario de ese tenant.
--   4) Verifica: el usuario del tenant B NO ve proyectos/BOM/etc. del tenant A.
--   5) Verifica: el dueño de plataforma sí ve ambos.
--   6) Verifica: crear un proyecto nuevo queda con tenant_id correcto (trigger).
--   7) Si todo pasa, mergea el branch a producción.
-- ============================================================================
-- FIN DE LA MIGRACIÓN
-- ============================================================================
