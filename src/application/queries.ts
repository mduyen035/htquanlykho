import type { Database, User } from '../domain/model';
import { loss } from '../domain/rules';
export function lossReport(
  db: Database,
  user: User,
  period: string,
  branchId: string,
  materialId: string,
) {
  if (user.role === 'staff') return [];
  const latest = new Map<
    string,
    Database['counts'][number]['lines'][number] & { branchId: string; countSalesVersion?: string }
  >();
  for (const count of [...db.counts].sort((a, b) => a.date.localeCompare(b.date))) {
    if (
      !periodContains(period, count.period) ||
      (user.role !== 'owner' && count.branchId !== user.branchId) ||
      (branchId !== 'all' && count.branchId !== branchId)
    )
      continue;
    if (
      !db.sales.some(
        (s) =>
          s.branchId === count.branchId &&
          periodContains(period, s.period) &&
          s.id === count.salesVersion,
      )
    )
      continue;
    for (const line of count.lines)
      if (materialId === 'all' || line.materialId === materialId)
        latest.set(`${count.branchId}:${line.materialId}`, {
          ...line,
          branchId: count.branchId,
          countSalesVersion: count.salesVersion,
        });
  }
  return [...latest.values()].map((line) => {
    const m = db.materials.find((m) => m.id === line.materialId)!;
    const sale = db.sales.find((s) => s.id === line.countSalesVersion);
    const theoretical =
      line.theoretical -
      (sale?.consumption.find((i) => i.materialId === line.materialId)?.quantity || 0);
    return {
      ...line,
      countSalesVersion: undefined,
      theoretical,
      name: m.name,
      unit: m.unit,
      allowance: m.allowance,
      ...loss(theoretical, line.actual, m.allowance),
    };
  });
}
export function periodContains(period: string, candidate: string) {
  if (period === candidate) return true;
  if (!period.includes('Q') || candidate.includes('Q')) return false;
  const quarter = Number(period.slice(-1));
  const month = Number(candidate.slice(5));
  return (
    candidate.slice(0, 4) === period.slice(0, 4) &&
    month >= (quarter - 1) * 3 + 1 &&
    month <= quarter * 3
  );
}
export function periodsOverlap(a: string, b: string) {
  if (a.slice(0, 4) !== b.slice(0, 4)) return false;
  const range = (p: string) =>
    p.includes('Q')
      ? [(Number(p.slice(-1)) - 1) * 3 + 1, Number(p.slice(-1)) * 3]
      : [Number(p.slice(5)), Number(p.slice(5))];
  const [as, ae] = range(a),
    [bs, be] = range(b);
  return as <= be && bs <= ae;
}
export function salesPreview(
  db: Database,
  lines: { recipeId: string; quantity: number; name?: string }[],
) {
  const consumption = new Map<string, number>();
  const missing: string[] = [];
  for (const l of lines) {
    const recipe = db.recipes.find((r) => r.id === l.recipeId && r.active);
    if (!recipe) {
      missing.push(l.recipeId);
      continue;
    }
    for (const ingredient of recipe.lines)
      consumption.set(
        ingredient.materialId,
        (consumption.get(ingredient.materialId) ?? 0) + l.quantity * ingredient.quantity,
      );
  }
  return {
    total: lines.reduce((sum, l) => sum + l.quantity, 0),
    missing,
    consumption: [...consumption].map(([materialId, quantity]) => ({ materialId, quantity })),
  };
}
export function stockReport(
  db: Database,
  user: User,
  date: string,
  branchId: string,
  materialId: string,
) {
  if (user.role === 'staff') return [];
  const end = new Date(`${date}T23:59:59.999+07:00`).getTime();
  const snapshot = [...(db.stockSnapshots ?? [])]
    .filter((s) => new Date(s.date).getTime() <= end)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const stocks =
    snapshot?.stocks ??
    (date === new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10) ? db.stocks : []);
  return stocks.filter(
    (s) =>
      (user.role === 'owner' || user.branchId === s.branchId) &&
      (branchId === 'all' || branchId === s.branchId) &&
      (materialId === 'all' || materialId === s.materialId),
  );
}
