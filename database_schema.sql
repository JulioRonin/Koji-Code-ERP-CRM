-- KOJI ERP - MASTER DATABASE SCHEMA (Supabase/PostgreSQL)
-- This script sets up all tables, relationships, and security policies.

-- 0. ENABLE EXTENSIONS --
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CRM & USER PROFILES --
-- Extends Supabase auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    avatar_url TEXT,
    role TEXT DEFAULT 'Operador',
    department TEXT DEFAULT 'Producción',
    phone TEXT,
    status TEXT DEFAULT 'Activo',
    join_date TIMESTAMPTZ DEFAULT NOW(),
    bio TEXT,
    salary NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to create profile on new auth user
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

-- 2. PROJECTS --
CREATE TABLE IF NOT EXISTS public.projects (
    id TEXT PRIMARY KEY, -- Format: IMC-2026-042
    name TEXT NOT NULL,
    client TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Cotización', -- Cotización, Diseño, En Producción, Calidad, Entregado
    progress INTEGER DEFAULT 0,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    deadline DATE NOT NULL,
    manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. BOM (BILL OF MATERIALS) & PARTS --
CREATE TABLE IF NOT EXISTS public.bom_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id TEXT REFERENCES public.projects(id) ON DELETE CASCADE,
    part_number TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'General', -- Materia Prima, Herramental, Hardware, etc.
    quantity NUMERIC NOT NULL DEFAULT 1,
    uom TEXT NOT NULL DEFAULT 'Pzas',
    bom_status TEXT NOT NULL DEFAULT 'Pendiente', -- Pendiente, Solicitado, Tránsito, Recibido, Stock
    manufacturing_status TEXT NOT NULL DEFAULT 'PENDIENTE', -- PENDIENTE, EN PROCESO, CALIDAD, TERMINADO
    drawing_url TEXT,
    model_url TEXT,
    assigned_technician_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. QUALITY ASSURANCE --
-- Inspection Logs
CREATE TABLE IF NOT EXISTS public.quality_inspections (
    id TEXT PRIMARY KEY, -- Format: QA-2026-XXX
    project_id TEXT REFERENCES public.projects(id) ON DELETE CASCADE,
    bom_item_id UUID REFERENCES public.bom_items(id) ON DELETE CASCADE,
    inspection_type TEXT NOT NULL, -- Primera Pieza, En Proceso, Final, Recibo Material
    inspector_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    inspection_date TIMESTAMPTZ DEFAULT NOW(),
    result TEXT NOT NULL, -- Aprobado, Rechazado (NCR)
    notes TEXT,
    report_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Non-Conformance Reports (NCR)
CREATE TABLE IF NOT EXISTS public.ncrs (
    id TEXT PRIMARY KEY, -- Format: NCR-2026-XXX
    project_id TEXT REFERENCES public.projects(id) ON DELETE CASCADE,
    bom_item_id UUID REFERENCES public.bom_items(id) ON DELETE CASCADE,
    issue_description TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'Baja', -- Baja, Media, Alta, Crítica
    status TEXT NOT NULL DEFAULT 'Abierta', -- Abierta, En Investigación, Cerrada
    root_cause TEXT,
    action_plan TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

-- Measurement Instruments
CREATE TABLE IF NOT EXISTS public.measurement_instruments (
    id TEXT PRIMARY KEY, -- Format: INS-XXX
    name TEXT NOT NULL,
    brand TEXT,
    last_calibration DATE,
    next_calibration DATE,
    status TEXT NOT NULL DEFAULT 'Calibrado',
    serial_number TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. CHAT & COMMUNICATION --
CREATE TABLE IF NOT EXISTS public.chat_channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL, -- e.g., 'calidad', 'anuncios', 'ingenieria'
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id UUID REFERENCES public.chat_channels(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Null if system message
    content TEXT NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'USER', -- USER, SYSTEM, PROJECT, QUALITY
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. AUDIT LOGS --
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    action TEXT NOT NULL, -- INSERT, UPDATE, DELETE
    old_data JSONB,
    new_data JSONB,
    changed_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. ENABLE ROW LEVEL SECURITY (RLS) --
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ncrs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurement_instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 8. POLICIES --
-- Generic policy: All authenticated users can read everything
CREATE POLICY "Authenticated users can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view projects" ON public.projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view bom_items" ON public.bom_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view quality" ON public.quality_inspections FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view ncrs" ON public.ncrs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view instruments" ON public.measurement_instruments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view channels" ON public.chat_channels FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read messages" ON public.chat_messages FOR SELECT TO authenticated USING (true);

-- Insert policies for chat and updates (example)
CREATE POLICY "Users can send messages" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Admins can update anything" ON public.projects FOR ALL TO authenticated USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('Administrador', 'Administración / PM')
);

-- 9. INITIAL DATA SEED --
INSERT INTO public.chat_channels (name, description) VALUES 
('general', 'Canal principal de comunicación'),
('calidad', 'Alertas y discusiones de aseguramiento de calidad'),
('anuncios', 'Notificaciones críticas del sistema Koji'),
('produccion', 'Coordinación diaria de manufactura')
ON CONFLICT (name) DO NOTHING;
