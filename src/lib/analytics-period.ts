import { toJST } from "./datetime";

/** 営業日（UTC 0時 = JST 日付）から JST の年月を取得 */
export function getJstYearMonth(date: Date): { year: number; month: number } {
  const jst = toJST(date);
  return { year: jst.getFullYear(), month: jst.getMonth() + 1 };
}

/** 現在の JST 年月 */
export function getCurrentJstYearMonth() {
  return getJstYearMonth(new Date());
}

/** JST の月の開始・終了（businessDate 用 UTC 境界） */
export function jstMonthRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return {
    start,
    end,
    label: `${year}年${month}月`,
    year,
    month,
  };
}

export function prevJstMonth(year: number, month: number) {
  const d = new Date(Date.UTC(year, month - 2, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

export function isSameJstMonth(a: Date, b: Date): boolean {
  const ja = getJstYearMonth(a);
  const jb = getJstYearMonth(b);
  return ja.year === jb.year && ja.month === jb.month;
}

export function isDateInJstMonth(date: Date, year: number, month: number): boolean {
  const d = getJstYearMonth(date);
  return d.year === year && d.month === month;
}
