-- ============================================================================
-- KANRI · Términos y condiciones (anexo de cotización) por empresa
-- Idempotente.
-- ============================================================================
ALTER TABLE public.company_settings
    ADD COLUMN IF NOT EXISTS quote_terms_enabled BOOLEAN,
    ADD COLUMN IF NOT EXISTS terms_payment  TEXT,   -- términos de pago
    ADD COLUMN IF NOT EXISTS terms_advance  TEXT,   -- términos de anticipo
    ADD COLUMN IF NOT EXISTS terms_special  TEXT;   -- condiciones especiales / NDA

NOTIFY pgrst, 'reload schema';
-- ============================================================================
