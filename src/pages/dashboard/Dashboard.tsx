import type { DashboardMode } from '@/types/database';
import { useCompany } from '@/contexts/CompanyContext';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { canSeeAmounts } from '@/lib/permissions';
import { SalesDashboard } from './SalesDashboard';
import { PlantDashboard } from './PlantDashboard';

/** Giros que por defecto usan el tablero de ventas (venden artículos). */
const SALES_INDUSTRIES = ['herramientas', 'mro'];

export function resolveDashboardMode(
  mode: DashboardMode | null | undefined,
  industry: string | undefined,
): DashboardMode {
  if (mode) return mode;
  return industry && SALES_INDUSTRIES.includes(industry) ? 'sales' : 'operations';
}

/** Selecciona la variante de tablero según el giro / la configuración. */
export function Dashboard() {
  const { company } = useCompany();
  const { tenant } = useTenant();
  const { user } = useAuth();
  const mode = resolveDashboardMode(company.dashboard_mode, tenant?.industry);
  // El tablero de ventas es todo montos: solo para quien puede verlos.
  return mode === 'sales' && canSeeAmounts(user?.role, user?.isPlatformOwner)
    ? <SalesDashboard />
    : <PlantDashboard />;
}

