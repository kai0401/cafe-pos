const DOW_LABELS = ["月", "火", "水", "木", "金", "土", "日"];

export function getClosedDays(raw: unknown): number[] {
  if (Array.isArray(raw)) return raw as number[];
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as number[];
    } catch {
      return [3];
    }
  }
  return [3];
}

export function formatClosedDaysLabel(raw: unknown): string {
  const closed = getClosedDays(raw);
  if (closed.length === 0) return "定休なし";
  return `${closed.map((i) => `${DOW_LABELS[i] ?? ""}曜`).join("・")}定休`;
}
