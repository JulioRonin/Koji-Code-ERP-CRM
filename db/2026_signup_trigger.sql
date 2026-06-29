-- ============================================================================
-- KANRI · Auto-registro de empresas SIN Edge Function
-- ----------------------------------------------------------------------------
-- Reemplaza handle_new_user para que, cuando un usuario se registra desde el
-- onboarding (auth.signUp con metadata kanri_signup='true'), se cree de forma
-- automática y atómica:
--   1) la empresa (tenant) en estado de prueba,
--   2) su perfil con tenant_id + rol Administrador.
-- Para usuarios normales (invitados por un admin) conserva el comportamiento
-- previo. SECURITY DEFINER permite crear el tenant saltando la RLS de forma
-- segura. Idempotente.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    is_signup   BOOLEAN := (NEW.raw_user_meta_data->>'kanri_signup') = 'true';
    base_slug   TEXT;
    final_slug  TEXT;
    new_tenant  UUID;
    trial_end   TIMESTAMPTZ;
BEGIN
    IF is_signup THEN
        base_slug := COALESCE(NULLIF(NEW.raw_user_meta_data->>'slug',''), 'empresa');
        final_slug := base_slug;
        -- Evita colisión de slug.
        IF EXISTS (SELECT 1 FROM public.tenants WHERE slug = final_slug) THEN
            final_slug := base_slug || '-' || substr(NEW.id::text, 1, 6);
        END IF;

        trial_end := COALESCE((NEW.raw_user_meta_data->>'trial_ends_at')::timestamptz, NOW() + INTERVAL '14 days');

        INSERT INTO public.tenants (name, slug, industry, plan, status, enabled_modules, billing_cycle, trial_ends_at, current_period_end)
        VALUES (
            COALESCE(NULLIF(NEW.raw_user_meta_data->>'tenant_name',''), 'Empresa'),
            final_slug,
            COALESCE(NEW.raw_user_meta_data->>'industry', 'cnc'),
            COALESCE(NEW.raw_user_meta_data->>'plan', 'profesional'),
            'trialing',
            COALESCE((NEW.raw_user_meta_data->'enabled_modules'), '[]'::jsonb),
            'monthly',
            trial_end,
            trial_end
        )
        RETURNING id INTO new_tenant;

        INSERT INTO public.profiles (id, full_name, email, avatar_url, tenant_id, role, department)
        VALUES (
            NEW.id,
            COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name',''), NEW.email),
            NEW.email,
            NEW.raw_user_meta_data->>'avatar_url',
            new_tenant,
            'Administrador',
            'Administrador'
        );
    ELSE
        -- Usuario normal (alta por admin): perfil base, sin empresa asignada aquí.
        INSERT INTO public.profiles (id, full_name, email, avatar_url)
        VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
            NEW.email,
            NEW.raw_user_meta_data->>'avatar_url'
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- El trigger ya existe (on_auth_user_created); esto solo refresca la función.
NOTIFY pgrst, 'reload schema';
-- ============================================================================
