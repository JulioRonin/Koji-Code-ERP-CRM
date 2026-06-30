import React, { useEffect, useState } from 'react';
import {
  Building2,
  FileText,
  MapPin,
  Phone,
  Palette,
  Save,
  CheckCircle2,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useUpdateCompanySettings, type CompanySettingsInput } from '@/lib/api';
import { cn } from '@/lib/utils';

const ADMIN_ROLES = ['Administrador', 'Administración / PM'];

// Regímenes fiscales SAT más comunes (persona moral / física).
const TAX_REGIMES = [
  '601 - General de Ley Personas Morales',
  '603 - Personas Morales con Fines no Lucrativos',
  '605 - Sueldos y Salarios e Ingresos Asimilados a Salarios',
  '606 - Arrendamiento',
  '612 - Personas Físicas con Actividades Empresariales y Profesionales',
  '620 - Sociedades Cooperativas de Producción',
  '621 - Incorporación Fiscal',
  '626 - Régimen Simplificado de Confianza (RESICO)',
];

const COLOR_PRESETS = [
  { name: 'Azul industrial', value: '#0369a1' },
  { name: 'Acero', value: '#1e3a5f' },
  { name: 'Verde', value: '#15803d' },
  { name: 'Índigo', value: '#4338ca' },
  { name: 'Violeta', value: '#7c3aed' },
  { name: 'Cian', value: '#0891b2' },
  { name: 'Naranja', value: '#c2410c' },
  { name: 'Rojo', value: '#b91c1c' },
];

export function CompanySettingsPage() {
  const { company, refresh } = useCompany();
  const { user } = useAuth();
  const { update, loading } = useUpdateCompanySettings();
  const isAdmin = !!user && ADMIN_ROLES.includes(user.role);

  const [form, setForm] = useState<CompanySettingsInput>({});
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  // Hidrata el formulario con la empresa actual.
  useEffect(() => {
    setForm({
      legal_name: company.legal_name,
      commercial_name: company.commercial_name,
      tagline: company.tagline ?? '',
      rfc: company.rfc ?? '',
      tax_regime: company.tax_regime ?? '',
      legal_rep: company.legal_rep ?? '',
      currency: company.currency ?? 'MXN',
      address_street: company.address_street ?? '',
      address_ext: company.address_ext ?? '',
      address_int: company.address_int ?? '',
      address_neighborhood: company.address_neighborhood ?? '',
      address_zip: company.address_zip ?? '',
      address_city: company.address_city ?? '',
      address_state: company.address_state ?? '',
      address_country: company.address_country ?? 'México',
      phone: company.phone ?? '',
      email: company.email ?? '',
      website: company.website ?? '',
      logo_url: company.logo_url ?? '',
      primary_color: company.primary_color ?? '#0369a1',
    });
  }, [company.id, company.updated_at]);

  const set = (patch: CompanySettingsInput) => setForm(prev => ({ ...prev, ...patch }));

  const flash = (text: string, tone: 'success' | 'error' = 'success') => {
    setFeedback({ tone, text });
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleSave = async () => {
    if (!form.legal_name?.trim()) {
      flash('La razón social es obligatoria.', 'error');
      return;
    }
    try {
      await update(company, form);
      await refresh();
      flash('Configuración guardada. La marca se aplicó en toda la app.');
    } catch (err) {
      flash((err as Error).message || 'No se pudo guardar.', 'error');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-app-text)]">Configuración</h1>
          <p className="text-sm text-[var(--color-app-text-muted)] mt-0.5">
            Datos de la empresa, fiscales (México) y preferencias de marca. Este nombre se muestra en
            la app y los reportes (KANRI es el nombre de la plataforma y no se muestra al cliente).
          </p>
        </div>
        {isAdmin && (
          <Button onClick={handleSave} disabled={loading}>
            <Save className="h-4 w-4 mr-1.5" />
            {loading ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        )}
      </div>

      {!isAdmin && (
        <div className="p-3 rounded-md bg-[var(--color-app-warning-soft)] text-sm text-[var(--color-app-warning)] flex items-center gap-2">
          <Lock className="h-4 w-4 shrink-0" />
          Solo los administradores pueden editar la configuración de la empresa. Puedes ver los datos
          pero no modificarlos.
        </div>
      )}

      {feedback && (
        <div
          className={cn(
            'p-3 rounded-md text-sm flex items-center gap-2',
            feedback.tone === 'success'
              ? 'bg-[var(--color-app-success-soft)] text-[var(--color-app-success)]'
              : 'bg-[var(--color-app-danger-soft)] text-[var(--color-app-danger)]'
          )}
        >
          {feedback.tone === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          )}
          {feedback.text}
        </div>
      )}

      {/* Identidad / marca */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4 text-[var(--color-app-text-muted)]" /> Identidad de la empresa
          </CardTitle>
          <CardDescription>Nombre que verán tus usuarios y clientes en la app y reportes.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Razón social *" value={form.legal_name} onChange={v => set({ legal_name: v })} disabled={!isAdmin} placeholder="IMC Design S.A. de C.V." />
          <Field label="Nombre comercial" value={form.commercial_name} onChange={v => set({ commercial_name: v })} disabled={!isAdmin} placeholder="IMC Design" />
          <Field label="Tagline / giro" value={form.tagline} onChange={v => set({ tagline: v })} disabled={!isAdmin} placeholder="Manufactura CNC de precisión" />
          <Field label="Logo (URL)" value={form.logo_url} onChange={v => set({ logo_url: v })} disabled={!isAdmin} placeholder="https://…/logo.png" />
        </CardContent>
      </Card>

      {/* Datos fiscales */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-[var(--color-app-text-muted)]" /> Datos fiscales (México)
          </CardTitle>
          <CardDescription>Información para CFDI, facturación y cumplimiento ante el SAT.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="RFC" value={form.rfc} onChange={v => set({ rfc: v.toUpperCase() })} disabled={!isAdmin} placeholder="XAXX010101000" mono />
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Régimen fiscal</label>
            <select
              value={form.tax_regime ?? ''}
              onChange={e => set({ tax_regime: e.target.value })}
              disabled={!isAdmin}
              className="w-full h-9 px-3 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40 disabled:opacity-60"
            >
              <option value="">Selecciona…</option>
              {TAX_REGIMES.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <Field label="Representante legal" value={form.legal_rep} onChange={v => set({ legal_rep: v })} disabled={!isAdmin} placeholder="Nombre completo" />
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Moneda</label>
            <select
              value={form.currency ?? 'MXN'}
              onChange={e => set({ currency: e.target.value })}
              disabled={!isAdmin}
              className="w-full h-9 px-3 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40 disabled:opacity-60"
            >
              <option value="MXN">MXN — Peso mexicano</option>
              <option value="USD">USD — Dólar</option>
              <option value="EUR">EUR — Euro</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Domicilio fiscal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4 text-[var(--color-app-text-muted)]" /> Domicilio fiscal
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <Field label="Calle" value={form.address_street} onChange={v => set({ address_street: v })} disabled={!isAdmin} />
          </div>
          <Field label="No. exterior" value={form.address_ext} onChange={v => set({ address_ext: v })} disabled={!isAdmin} />
          <Field label="No. interior" value={form.address_int} onChange={v => set({ address_int: v })} disabled={!isAdmin} />
          <Field label="Colonia" value={form.address_neighborhood} onChange={v => set({ address_neighborhood: v })} disabled={!isAdmin} />
          <Field label="C.P." value={form.address_zip} onChange={v => set({ address_zip: v })} disabled={!isAdmin} mono />
          <Field label="Municipio / alcaldía" value={form.address_city} onChange={v => set({ address_city: v })} disabled={!isAdmin} />
          <Field label="Estado" value={form.address_state} onChange={v => set({ address_state: v })} disabled={!isAdmin} />
          <Field label="País" value={form.address_country} onChange={v => set({ address_country: v })} disabled={!isAdmin} />
        </CardContent>
      </Card>

      {/* Contacto */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Phone className="h-4 w-4 text-[var(--color-app-text-muted)]" /> Contacto
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Teléfono" value={form.phone} onChange={v => set({ phone: v })} disabled={!isAdmin} placeholder="+52 ..." />
          <Field label="Correo" value={form.email} onChange={v => set({ email: v })} disabled={!isAdmin} placeholder="contacto@empresa.com" />
          <Field label="Sitio web" value={form.website} onChange={v => set({ website: v })} disabled={!isAdmin} placeholder="https://empresa.com" />
        </CardContent>
      </Card>

      {/* Tema / color */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="h-4 w-4 text-[var(--color-app-text-muted)]" /> Tema y color de la plataforma
          </CardTitle>
          <CardDescription>El color primario se aplica en botones, acentos y la marca de la app.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {COLOR_PRESETS.map(p => (
              <button
                key={p.value}
                type="button"
                disabled={!isAdmin}
                onClick={() => set({ primary_color: p.value })}
                title={p.name}
                className={cn(
                  'h-9 w-9 rounded-md border-2 transition-transform disabled:opacity-60',
                  form.primary_color === p.value
                    ? 'border-[var(--color-app-text)] scale-110'
                    : 'border-transparent hover:scale-105'
                )}
                style={{ backgroundColor: p.value }}
              />
            ))}
          </div>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={form.primary_color ?? '#0369a1'}
              onChange={e => set({ primary_color: e.target.value })}
              disabled={!isAdmin}
              className="h-9 w-12 rounded border border-[var(--color-app-border)] cursor-pointer disabled:opacity-60"
            />
            <Field label="" value={form.primary_color} onChange={v => set({ primary_color: v })} disabled={!isAdmin} mono placeholder="#0369a1" />
            <div className="flex-1 flex items-center gap-2">
              <span className="text-xs text-[var(--color-app-text-muted)]">Vista previa:</span>
              <span
                className="inline-flex items-center h-8 px-3 rounded-md text-white text-xs font-medium"
                style={{ backgroundColor: form.primary_color ?? '#0369a1' }}
              >
                Botón primario
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {isAdmin && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={loading}>
            <Save className="h-4 w-4 mr-1.5" />
            {loading ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
  placeholder,
  mono,
}: {
  label: string;
  value?: string | null;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      {label && <label className="text-sm font-medium">{label}</label>}
      <Input
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className={cn(mono && 'font-mono', 'disabled:opacity-60')}
      />
    </div>
  );
}
