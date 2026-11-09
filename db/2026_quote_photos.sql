-- ============================================================================
-- KANRI · Logo de empresa (archivo) y fotos anexas a cotizaciones (máx. 5)
-- Idempotente. Ejecutar en Supabase → SQL Editor.
--
--   * company-assets : bucket PÚBLICO para el logo (URL directa; se ve en la
--                      app, en el PDF y en los correos).
--   * quote-photos   : bucket PRIVADO para fotos de cotización (URLs firmadas).
--
-- En ambos, la primera carpeta de la ruta es el tenant_id de la empresa:
--   <tenant_id>/logo-<ts>.png      ·      <tenant_id>/<quote_id>/<uuid>.jpg
-- y las políticas solo dejan escribir/leer dentro de la carpeta propia.
-- ============================================================================

-- Fotos anexas: [{ id, path, name, caption }]
ALTER TABLE public.quotes
    ADD COLUMN IF NOT EXISTS photos JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ── Buckets ────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('company-assets', 'company-assets', TRUE, 2097152, ARRAY['image/png','image/jpeg','image/webp'])
ON CONFLICT (id) DO UPDATE SET public = TRUE;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('quote-photos', 'quote-photos', FALSE, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- ── Políticas de storage.objects ───────────────────────────────────────────
-- company-assets: lectura pública (bucket público); escritura solo en la
-- carpeta de la propia empresa.
DROP POLICY IF EXISTS "company-assets write own tenant" ON storage.objects;
CREATE POLICY "company-assets write own tenant" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'company-assets'
        AND ((storage.foldername(name))[1] = public.current_tenant()::text OR public.is_platform_owner())
    );

DROP POLICY IF EXISTS "company-assets update own tenant" ON storage.objects;
CREATE POLICY "company-assets update own tenant" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'company-assets'
        AND ((storage.foldername(name))[1] = public.current_tenant()::text OR public.is_platform_owner())
    );

DROP POLICY IF EXISTS "company-assets delete own tenant" ON storage.objects;
CREATE POLICY "company-assets delete own tenant" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'company-assets'
        AND ((storage.foldername(name))[1] = public.current_tenant()::text OR public.is_platform_owner())
    );

-- quote-photos: todo (leer, subir, borrar) solo dentro de la carpeta propia.
DROP POLICY IF EXISTS "quote-photos own tenant" ON storage.objects;
CREATE POLICY "quote-photos own tenant" ON storage.objects
    FOR ALL TO authenticated
    USING (
        bucket_id = 'quote-photos'
        AND ((storage.foldername(name))[1] = public.current_tenant()::text OR public.is_platform_owner())
    )
    WITH CHECK (
        bucket_id = 'quote-photos'
        AND ((storage.foldername(name))[1] = public.current_tenant()::text OR public.is_platform_owner())
    );

NOTIFY pgrst, 'reload schema';
-- ============================================================================
