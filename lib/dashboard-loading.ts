/** Keep reads complete even when a selected week exceeds the Data API row limit.
 * Callers must use a stable, unique order and apply their identity/week filters
 * before range(). Failed pages never become a misleading partial report.
 */
export async function readDashboardPages<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  size = 500,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += size) {
    const result = await page(from, from + size - 1);
    if (result.error) throw result.error;
    if (!Array.isArray(result.data)) throw new Error("The dashboard data could not be verified.");
    rows.push(...result.data);
    if (result.data.length < size) return rows;
  }
}
