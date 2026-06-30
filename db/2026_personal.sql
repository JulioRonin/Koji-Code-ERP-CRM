-- ============================================================================
-- KANRI · Personal: baja de colaboradores + Checador (asistencia)
-- ----------------------------------------------------------------------------
-- 1) Permite a los administradores ELIMINAR un perfil (quitar gente de prueba).
-- 2) Tabla de asistencia (checador): entradas/salidas, horario esperado y horas
--    pagadas. Aislada por empresa. Idempotente.
-- ============================================================================

-- 1) Política de borrado de perfiles para administradores -------------------
DROP POLICY IF EXISTS "profiles admin delete" ON public.profiles;
CREATE POLICY "profiles admin delete" ON public.profiles
    FOR DELETE TO authenticated
    USING (
        public.is_admin()
        OR (EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_platform_owner') AND public.is_platform_owner())
    );

-- 2) Checador / asistencia ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_records (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id    UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    profile_id   UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    work_date    DATE NOT NULL,
    expected_in  TEXT DEFAULT '09:00',
    expected_out TEXT DEFAULT '18:00',
    check_in     TEXT,            -- 'HH:MM'
    check_out    TEXT,            -- 'HH:MM'
    paid_hours   NUMERIC,         -- override de horas a pagar
    status       TEXT DEFAULT 'pendiente',
    notes        TEXT,
    created_by   UUID,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (profile_id, work_date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_tenant ON public.attendance_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance_records(work_date);
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attendance write" ON public.attendance_records;
CREATE POLICY "attendance write" ON public.attendance_records
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_tenant') THEN
        EXECUTE 'DROP POLICY IF EXISTS "tenant isolation attendance_records" ON public.attendance_records;
                 CREATE POLICY "tenant isolation attendance_records" ON public.attendance_records
                 AS RESTRICTIVE FOR ALL TO authenticated
                 USING (tenant_id = public.current_tenant() OR public.is_platform_owner())
                 WITH CHECK (tenant_id = public.current_tenant() OR public.is_platform_owner())';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_tenant_id') THEN
        EXECUTE 'DROP TRIGGER IF EXISTS trg_set_tenant_attendance ON public.attendance_records;
                 CREATE TRIGGER trg_set_tenant_attendance BEFORE INSERT ON public.attendance_records
                 FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id()';
    END IF;
END$$;

NOTIFY pgrst, 'reload schema';
-- ============================================================================
