-- ============================================================================
-- KANRI · Cotizaciones (cliente/entrega) + Clientes (CRM) + fix edición empresa
-- ----------------------------------------------------------------------------
-- 1) Columnas nuevas en quotes: correo del cliente y tiempo de entrega.
-- 2) La tabla `customers` ya existe (database_schema.sql) y queda lista para el
--    módulo de Clientes — no se recrea aquí.
-- 3) Arregla la edición de la configuración de la empresa: la política era
--    estricta con el nombre del rol y, si la migración multi-tenant dejó la fila
--    con tenant_id NULL, la RESTRICTIVE bloqueaba el UPDATE incluso a un admin.
-- Idempotente.
-- ============================================================================

-- 1) Columnas de cotización -------------------------------------------------
ALTER TABLE public.quotes
    ADD COLUMN IF NOT EXISTS client_email  TEXT,
    ADD COLUMN IF NOT EXISTS delivery_time TEXT;

-- 1b) Datos bancarios de la empresa (para mostrar en la cotización) ---------
ALTER TABLE public.company_settings
    ADD COLUMN IF NOT EXISTS bank_name        TEXT,
    ADD COLUMN IF NOT EXISTS bank_account     TEXT,
    ADD COLUMN IF NOT EXISTS bank_clabe       TEXT,
    ADD COLUMN IF NOT EXISTS bank_beneficiary TEXT,
    ADD COLUMN IF NOT EXISTS payment_notes    TEXT;

-- 3a) Backfill de tenant_id en company_settings (solo si la columna existe) --
--     Asigna las filas sin empresa a la empresa "IMC" original (o a la única
--     empresa existente) para que la RESTRICTIVE de aislamiento no bloquee.
DO $$
DECLARE
    imc UUID;
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'company_settings' AND column_name = 'tenant_id'
    ) THEN
        SELECT id INTO imc FROM public.tenants WHERE slug = 'imc-design' LIMIT 1;
        IF imc IS NULL THEN
            -- Si no existe el slug, usa la única empresa (caso de un solo tenant).
            SELECT id INTO imc FROM public.tenants ORDER BY created_at LIMIT 1;
        END IF;
        IF imc IS NOT NULL THEN
            UPDATE public.company_settings SET tenant_id = imc WHERE tenant_id IS NULL;
        END IF;
    END IF;
END$$;

-- 3b) Política de escritura tolerante al nombre del rol + dueño de plataforma.
--     La RESTRICTIVE de aislamiento por tenant (si existe) sigue aplicando con
--     AND, así que esto NO rompe el aislamiento entre empresas. Se arma de forma
--     dinámica para incluir is_platform_owner() solo si la función existe.
DO $$
DECLARE
    owner_clause TEXT := '';
    cond TEXT;
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_platform_owner') THEN
        owner_clause := ' OR public.is_platform_owner()';
    END IF;
    cond := format(
        'public.is_admin()%s OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(p.role) LIKE ''%%admin%%'')',
        owner_clause
    );
    EXECUTE 'DROP POLICY IF EXISTS "company write" ON public.company_settings';
    EXECUTE format(
        'CREATE POLICY "company write" ON public.company_settings FOR ALL TO authenticated USING (%s) WITH CHECK (%s)',
        cond, cond
    );
END$$;

NOTIFY pgrst, 'reload schema';
-- ============================================================================
