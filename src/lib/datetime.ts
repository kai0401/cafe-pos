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
