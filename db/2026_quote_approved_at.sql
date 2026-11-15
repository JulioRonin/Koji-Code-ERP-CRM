-- ============================================================================
-- KANRI · Fecha de aprobación de cotizaciones (fecha real de la venta)
-- Idempotente. Ejecutar en Supabase → SQL Editor.
--
-- Antes la venta se fechaba con updated_at: editar una cotización aprobada
-- (fotos, notas, encabezado) la movía al día de la edición. Ahora:
--   * approved_at se fija automáticamente (trigger) la PRIMERA vez que la
--     cotización pasa a 'Aprobada' (o directo a 'Convertida').
--   * Se conserva al pasar de 'Aprobada' a 'Convertida' y en ediciones.
--   * Se limpia si la cotización regresa a Borrador / Enviada / Rechazada /
--     Expirada (deja de ser venta).
-- ============================================================================

ALTER TABLE public.quotes
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.quotes_set_approved_at()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status IN ('Aprobada', 'Convertida') THEN
        IF TG_OP = 'INSERT' THEN
            NEW.approved_at := COALESCE(NEW.approved_at, now());
        ELSIF OLD.status NOT IN ('Aprobada', 'Convertida') OR OLD.approved_at IS NULL THEN
            -- Recién aprobada: fecha de ahora (o la que mande la app).
            NEW.approved_at := COALESCE(NEW.approved_at, now());
        ELSE
            -- Ya era venta: la fecha original no se toca.
            NEW.approved_at := OLD.approved_at;
        END IF;
    ELSE
        NEW.approved_at := NULL;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quotes_approved_at ON public.quotes;
CREATE TRIGGER trg_quotes_approved_at
    BEFORE INSERT OR UPDATE OF status, approved_at ON public.quotes
    FOR EACH ROW EXECUTE FUNCTION public.quotes_set_approved_at();

-- Histórico: para las ventas existentes la mejor aproximación es la fecha
-- más temprana entre su última edición y la creación del proyecto al que se
-- convirtieron (la conversión ocurre justo después de aprobar).
UPDATE public.quotes q
SET approved_at = LEAST(
        q.updated_at,
        COALESCE((SELECT p.created_at FROM public.projects p WHERE p.id = q.converted_project_id), q.updated_at)
    )
WHERE q.status IN ('Aprobada', 'Convertida')
  AND q.approved_at IS NULL;

NOTIFY pgrst, 'reload schema';
-- ============================================================================
