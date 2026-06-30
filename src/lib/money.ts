export function parseYen(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Math.round(value);
  const cleaned = String(value).replace(/[,¥￥]/g, "").trim();
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? Math.round(num) : 0;
}

export function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

export function calcPercentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function calcConsumptionTaxInclusive(amount: number, rate: 10 | 8): number {
  const divisor = rate === 10 ? 110 : 108;
  return Math.floor((amount * rate) / divisor);
}
