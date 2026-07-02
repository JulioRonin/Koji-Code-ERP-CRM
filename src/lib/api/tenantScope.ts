/**
 * Alcance multi-tenant del lado del cliente.
 *
 * La RLS de Supabase deja que el DUEÑO DE PLATAFORMA vea todas las empresas
 * (para el panel y el "entrar como"). Por eso, en los módulos operativos NO basta
 * con la RLS: filtramos explícitamente por la empresa activa para que nadie —ni
 * siquiera el dueño de plataforma— vea datos de otra empresa por accidente.
 *
 * `TenantProvider` mantiene este id sincronizado con la empresa activa.
 */
let _activeTenantId: string | null = null;

/** Define la empresa activa (null = sin filtro, p. ej. el tenant genérico). */
export function setActiveTenant(id: string | null | undefined): void {
  _activeTenantId = id && id !== 'tenant-default' ? id : null;
}

/** Id de la empresa activa (o null si aún no se resuelve / es el genérico). */
export function activeTenantId(): string | null {
  return _activeTenantId;
}

/**
 * Aplica el filtro `tenant_id = <empresa activa>` a un query de Supabase si hay
 * una empresa activa. Si no la hay, devuelve el query sin tocar.
 *
 *   let q = scopeByTenant(supabase.from('inventory_items').select('*'));
 *   q = q.order('name');
 */
export function scopeByTenant<T>(query: T, column = 'tenant_id'): T {
  if (!_activeTenantId) return query;
  // El builder de Supabase encadena .eq devolviendo el mismo tipo.
  return (query as unknown as { eq: (c: string, v: string) => T }).eq(column, _activeTenantId);
}
