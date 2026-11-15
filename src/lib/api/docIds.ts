/**
 * Folios legibles (PREFIJO-AÑO-NNNN). Son llave primaria global, así que con
 * pocos dígitos aleatorios chocan entre empresas: usamos 4 dígitos y, si la
 * base responde "duplicate key", se reintenta con otro folio.
 */
export function newDocId(prefix: string): string {
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
}

export function isDuplicateKey(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === '23505' || /duplicate key/i.test(error.message ?? '');
}

/**
 * Inserta `row` cambiando su `id` mientras el folio ya exista (hasta 6 intentos).
 * `insert` debe ejecutar el insert y devolver { data, error } de Supabase.
 */
export async function insertWithUniqueId<T extends { id: string }, R>(
  row: T,
  prefix: string,
  insert: (row: T) => PromiseLike<{ data: R | null; error: { code?: string; message?: string } | null }>,
): Promise<{ data: R | null; error: { code?: string; message?: string } | null }> {
  let current = row;
  let result = await insert(current);
  for (let attempt = 0; attempt < 5 && isDuplicateKey(result.error); attempt++) {
    current = { ...current, id: newDocId(prefix) };
    result = await insert(current);
  }
  return result;
}
