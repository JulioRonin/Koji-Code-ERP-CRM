-- ============================================================================
-- KANRI · CRM de clientes (seguimiento, ranking y roadmap)
-- ----------------------------------------------------------------------------
-- Campos para dar seguimiento comercial a cada cliente. Idempotente.
-- ============================================================================
ALTER TABLE public.customers
    ADD COLUMN IF NOT EXISTS stage           TEXT,       -- prospecto|contacto|propuesta|activo|inactivo
    ADD COLUMN IF NOT EXISTS tier            TEXT,       -- A|B|C (rango manual)
    ADD COLUMN IF NOT EXISTS industry        TEXT,
    ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMPTZ;

-- Clientes existentes activos → etapa 'activo' por defecto.
UPDATE public.customers SET stage = 'activo'
WHERE stage IS NULL AND is_active IS TRUE;
UPDATE public.customers SET stage = 'inactivo'
WHERE stage IS NULL AND (is_active IS FALSE);

NOTIFY pgrst, 'reload schema';
-- ============================================================================
