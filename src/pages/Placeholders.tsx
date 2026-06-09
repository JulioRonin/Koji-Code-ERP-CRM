import React from 'react';
import { FileText, Settings as SettingsIcon, Construction } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

function Placeholder({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-app-text)]">{title}</h1>
        <p className="text-sm text-[var(--color-app-text-muted)] mt-0.5">{description}</p>
      </div>
      <Card>
        <CardContent className="p-12 flex flex-col items-center justify-center text-center gap-3">
          <div className="h-12 w-12 rounded-full bg-[var(--color-app-surface-alt)] flex items-center justify-center">
            <Icon className="h-5 w-5 text-[var(--color-app-text-muted)]" />
          </div>
          <h3 className="text-base font-medium text-[var(--color-app-text)]">Módulo en construcción</h3>
          <p className="text-sm text-[var(--color-app-text-muted)] max-w-sm">
            Este módulo estará disponible próximamente como parte del roadmap de la plataforma.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export function Projects() {
  return <Placeholder title="Proyectos" description="Gestión de proyectos y órdenes de trabajo." icon={Construction} />;
}

export function Chat() {
  return <Placeholder title="Chat interno" description="Comunicación entre departamentos." icon={Construction} />;
}

export function Billing() {
  return <Placeholder title="Facturación" description="Emisión de CFDI 4.0 y control de pagos." icon={FileText} />;
}

export function Settings() {
  return <Placeholder title="Configuración" description="Ajustes del sistema, branding y gestión de usuarios." icon={SettingsIcon} />;
}
