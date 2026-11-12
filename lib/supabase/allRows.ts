/**
 * Every row of a query. PostgREST caps a response at 1000 rows, so a plain
 * select silently drops the rest. `page(from, to)` builds the query for one
 * range; give it a stable order (a unique column last) so pages don't overlap.
 */
export async function allRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}
