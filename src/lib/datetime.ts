import { formatInTimeZone, toZonedTime } from "date-fns-tz";

export const TIMEZONE = "Asia/Tokyo";

export function toJST(date: Date): Date {
  return toZonedTime(date, TIMEZONE);
}

export function formatJST(date: Date, pattern: string): string {
  return formatInTimeZone(date, TIMEZONE, pattern);
}

export function parseSmaregiDateTime(value: string): Date {
  const normalized = value.trim().replace(/\//g, "-");
  return new Date(normalized);
}

export function formatJSTToday(): string {
  return formatJST(new Date(), "yyyy-MM-dd");
}

/** 経費計上日（YYYY-MM-DD）を businessDate 形式の UTC Date に変換 */
export function parseExpenseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

export function getBusinessDate(date: Date): Date {
  const jst = toJST(date);
  return new Date(
    Date.UTC(jst.getFullYear(), jst.getMonth(), jst.getDate()),
  );
}

export function getHourJST(date: Date): number {
  return toJST(date).getHours();
}

export function getDayOfWeekJST(date: Date): number {
  const day = toJST(date).getDay();
  return day === 0 ? 6 : day - 1;
}

export function isWithinBusinessHours(
  date: Date,
  openTime: string,
  closeTime: string,
): boolean {
  const jst = toJST(date);
  const [openH, openM] = openTime.split(":").map(Number);
  const [closeH, closeM] = closeTime.split(":").map(Number);
  const minutes = jst.getHours() * 60 + jst.getMinutes();
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;
  return minutes >= openMinutes && minutes < closeMinutes;
}

export function isRegularClosedDay(
  date: Date,
  regularClosedDays: number[],
): boolean {
  return regularClosedDays.includes(getDayOfWeekJST(date));
}

export function countBusinessDays(
  start: Date,
  end: Date,
  regularClosedDays: number[],
): number {
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    if (!isRegularClosedDay(current, regularClosedDays)) count++;
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return count;
}

/** 前年の同じ曜日（52週前） */
export function getYoYSameWeekdayDate(date: Date): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() - 364);
  return d;
}

export function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const DOW_LABELS = ["月", "火", "水", "木", "金", "土", "日"] as const;

/** 月曜始まりの週（YYYY-MM-DD の配列7日） */
export function getWeekDaysJST(anchor = new Date()): {
  weekStart: string;
  weekEnd: string;
  days: { date: string; label: string; dow: string }[];
} {
  const jst = toJST(anchor);
  const jsDay = jst.getDay();
  const mondayOffset = jsDay === 0 ? -6 : 1 - jsDay;
  const monday = new Date(jst);
  monday.setDate(jst.getDate() + mondayOffset);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const date = formatJST(d, "yyyy-MM-dd");
    return { date, label: formatJST(d, "M/d"), dow: DOW_LABELS[i]! };
  });

  return { weekStart: days[0]!.date, weekEnd: days[6]!.date, days };
}

export type MonthGridCell = {
  date: string;
  label: string;
  dow: string;
  inMonth: boolean;
  isToday: boolean;
};

/** 月曜始まりの月間カレンダー（6週×7日） */
export function getMonthGridJST(anchor = new Date()): {
  monthKey: string;
  monthLabel: string;
  monthStart: string;
  monthEnd: string;
  rangeStart: string;
  rangeEnd: string;
  cells: MonthGridCell[];
} {
  const jst = toJST(anchor);
  const year = jst.getFullYear();
  const month = jst.getMonth();
  const monthKey = formatJST(jst, "yyyy-MM");
  const monthLabel = formatJST(jst, "yyyy年M月");

  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);
  const monthStart = formatJST(firstOfMonth, "yyyy-MM-dd");
  const monthEnd = formatJST(lastOfMonth, "yyyy-MM-dd");
  const today = formatJST(new Date(), "yyyy-MM-dd");

  const firstJsDay = firstOfMonth.getDay();
  const startOffset = firstJsDay === 0 ? -6 : 1 - firstJsDay;
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() + startOffset);

  const cells: MonthGridCell[] = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const date = formatJST(d, "yyyy-MM-dd");
    return {
      date,
      label: formatJST(d, "d"),
      dow: DOW_LABELS[i % 7]!,
      inMonth: d.getMonth() === month,
      isToday: date === today,
    };
  });

  return {
    monthKey,
    monthLabel,
    monthStart,
    monthEnd,
    rangeStart: cells[0]!.date,
    rangeEnd: cells[41]!.date,
    cells,
  };
}

export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function shiftDurationMinutes(startTime: string, endTime: string): number {
  const diff = parseTimeToMinutes(endTime) - parseTimeToMinutes(startTime);
  return diff > 0 ? diff : 0;
}
