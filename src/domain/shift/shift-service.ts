import { ShiftRole, ShiftStatus } from "@prisma/client";
import {
  formatJST,
  getMonthGridJST,
  getWeekDaysJST,
  parseExpenseDate,
  parseTimeToMinutes,
  shiftDurationMinutes,
} from "@/lib/datetime";
import { prisma } from "@/lib/prisma";

const STAFF_COLORS = ["#9a5c38", "#5c6b54", "#6b5b95", "#4a7c8c", "#b84a3a", "#7d6b4f"];

export type StaffInput = {
  name: string;
  hourlyWage?: number | null;
  role?: ShiftRole;
  color?: string | null;
  isActive?: boolean;
  sortOrder?: number;
};

export type ShiftInput = {
  staffId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  role?: ShiftRole;
  status?: ShiftStatus;
  note?: string | null;
};

function normalizeTime(value: string): string {
  const m = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) throw new Error("時刻は HH:MM 形式で入力してください");
  const h = parseInt(m[1]!, 10);
  const mo = parseInt(m[2]!, 10);
  if (h < 0 || h > 23 || mo < 0 || mo > 59) throw new Error("時刻が不正です");
  return `${String(h).padStart(2, "0")}:${String(mo).padStart(2, "0")}`;
}

function validateShiftTimes(startTime: string, endTime: string) {
  const start = normalizeTime(startTime);
  const end = normalizeTime(endTime);
  if (parseTimeToMinutes(end) <= parseTimeToMinutes(start)) {
    throw new Error("終了時刻は開始時刻より後にしてください");
  }
  return { startTime: start, endTime: end };
}

async function assertNoOverlap(
  storeId: string,
  staffId: string,
  shiftDate: string,
  startTime: string,
  endTime: string,
  excludeId?: string,
) {
  const date = parseExpenseDate(shiftDate);
  const existing = await prisma.shift.findMany({
    where: {
      storeId,
      staffId,
      shiftDate: date,
      status: { not: ShiftStatus.CANCELLED },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });

  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);

  for (const shift of existing) {
    const s = parseTimeToMinutes(shift.startTime);
    const e = parseTimeToMinutes(shift.endTime);
    if (start < e && end > s) {
      throw new Error("同じスタッフのシフトが重なっています");
    }
  }
}

export async function ensureDefaultStaff(storeId: string) {
  const count = await prisma.staffMember.count({ where: { storeId } });
  if (count > 0) return;

  const defaults = [
    { name: "店長", role: ShiftRole.MANAGER, hourlyWage: 1200 },
    { name: "ホール", role: ShiftRole.HALL, hourlyWage: 1100 },
    { name: "キッチン", role: ShiftRole.KITCHEN, hourlyWage: 1100 },
  ];

  for (let i = 0; i < defaults.length; i++) {
    const item = defaults[i]!;
    await prisma.staffMember.create({
      data: {
        storeId,
        name: item.name,
        role: item.role,
        hourlyWage: item.hourlyWage,
        color: STAFF_COLORS[i % STAFF_COLORS.length],
        sortOrder: i + 1,
      },
    });
  }
}

export async function listStaff(storeId: string, activeOnly = false) {
  await ensureDefaultStaff(storeId);
  return prisma.staffMember.findMany({
    where: { storeId, ...(activeOnly ? { isActive: true } : {}) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function createStaff(storeId: string, input: StaffInput) {
  const name = input.name.trim();
  if (!name) throw new Error("スタッフ名を入力してください");

  const count = await prisma.staffMember.count({ where: { storeId } });
  return prisma.staffMember.create({
    data: {
      storeId,
      name,
      hourlyWage: input.hourlyWage ?? null,
      role: input.role ?? ShiftRole.HALL,
      color: input.color ?? STAFF_COLORS[count % STAFF_COLORS.length],
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? count + 1,
    },
  });
}

export async function updateStaff(id: string, storeId: string, input: Partial<StaffInput>) {
  const existing = await prisma.staffMember.findFirst({ where: { id, storeId } });
  if (!existing) throw new Error("スタッフが見つかりません");

  return prisma.staffMember.update({
    where: { id },
    data: {
      name: input.name?.trim() || undefined,
      hourlyWage: input.hourlyWage !== undefined ? input.hourlyWage : undefined,
      role: input.role,
      color: input.color !== undefined ? input.color : undefined,
      isActive: input.isActive,
      sortOrder: input.sortOrder,
    },
  });
}

export async function deleteStaff(id: string, storeId: string) {
  const existing = await prisma.staffMember.findFirst({ where: { id, storeId } });
  if (!existing) throw new Error("スタッフが見つかりません");

  const shiftCount = await prisma.shift.count({ where: { staffId: id } });
  if (shiftCount > 0) {
    return prisma.staffMember.update({
      where: { id },
      data: { isActive: false },
    });
  }
  await prisma.staffMember.delete({ where: { id } });
  return null;
}

export async function listShifts(storeId: string, startDate: string, endDate: string) {
  return prisma.shift.findMany({
    where: {
      storeId,
      shiftDate: {
        gte: parseExpenseDate(startDate),
        lte: parseExpenseDate(endDate),
      },
    },
    include: { staff: true },
    orderBy: [{ shiftDate: "asc" }, { startTime: "asc" }],
  });
}

export async function createShift(storeId: string, input: ShiftInput) {
  const { startTime, endTime } = validateShiftTimes(input.startTime, input.endTime);
  await assertNoOverlap(storeId, input.staffId, input.shiftDate, startTime, endTime);

  const staff = await prisma.staffMember.findFirst({
    where: { id: input.staffId, storeId, isActive: true },
  });
  if (!staff) throw new Error("スタッフが見つかりません");

  return prisma.shift.create({
    data: {
      storeId,
      staffId: input.staffId,
      shiftDate: parseExpenseDate(input.shiftDate),
      startTime,
      endTime,
      role: input.role ?? staff.role,
      status: input.status ?? ShiftStatus.SCHEDULED,
      note: input.note?.trim() || null,
    },
    include: { staff: true },
  });
}

export async function updateShift(id: string, storeId: string, input: Partial<ShiftInput>) {
  const existing = await prisma.shift.findFirst({
    where: { id, storeId },
    include: { staff: true },
  });
  if (!existing) throw new Error("シフトが見つかりません");

  const startTime = input.startTime ?? existing.startTime;
  const endTime = input.endTime ?? existing.endTime;
  const validated = validateShiftTimes(startTime, endTime);
  const shiftDate = input.shiftDate ?? formatJST(existing.shiftDate, "yyyy-MM-dd");
  const staffId = input.staffId ?? existing.staffId;

  await assertNoOverlap(
    storeId,
    staffId,
    shiftDate,
    validated.startTime,
    validated.endTime,
    id,
  );

  return prisma.shift.update({
    where: { id },
    data: {
      staffId: input.staffId,
      shiftDate: input.shiftDate ? parseExpenseDate(input.shiftDate) : undefined,
      startTime: validated.startTime,
      endTime: validated.endTime,
      role: input.role,
      status: input.status,
      note: input.note !== undefined ? input.note?.trim() || null : undefined,
    },
    include: { staff: true },
  });
}

export async function deleteShift(id: string, storeId: string) {
  const existing = await prisma.shift.findFirst({ where: { id, storeId } });
  if (!existing) throw new Error("シフトが見つかりません");
  await prisma.shift.delete({ where: { id } });
}

export async function getShiftWeekBundle(storeId: string, weekAnchor?: string) {
  const anchor = weekAnchor ? parseExpenseDate(weekAnchor) : new Date();
  const week = getWeekDaysJST(anchor);
  const [staff, shifts] = await Promise.all([
    listStaff(storeId),
    listShifts(storeId, week.weekStart, week.weekEnd),
  ]);

  return {
    view: "week" as const,
    week,
    staff,
    shifts: serializeShifts(shifts),
    summary: summarizeShifts(shifts, staff),
  };
}

export async function getShiftMonthBundle(storeId: string, monthKey?: string) {
  const anchor = monthKey ? parseExpenseDate(`${monthKey}-01`) : new Date();
  const month = getMonthGridJST(anchor);
  const [staff, shifts] = await Promise.all([
    listStaff(storeId),
    listShifts(storeId, month.rangeStart, month.rangeEnd),
  ]);

  return {
    view: "month" as const,
    month,
    staff,
    shifts: serializeShifts(shifts),
    summary: summarizeShifts(
      shifts.filter((s) => {
        const d = formatJST(s.shiftDate, "yyyy-MM-dd");
        return d >= month.monthStart && d <= month.monthEnd;
      }),
      staff,
    ),
  };
}

function serializeShifts(
  shifts: Awaited<ReturnType<typeof listShifts>>,
) {
  return shifts.map((s) => ({
    ...s,
    shiftDate: formatJST(s.shiftDate, "yyyy-MM-dd"),
  }));
}

function summarizeShifts(
  shifts: Awaited<ReturnType<typeof listShifts>>,
  staff: Awaited<ReturnType<typeof listStaff>>,
) {
  const staffHours = new Map<string, number>();
  let totalMinutes = 0;
  let laborCost = 0;

  for (const shift of shifts) {
    if (shift.status === ShiftStatus.CANCELLED) continue;
    const mins = shiftDurationMinutes(shift.startTime, shift.endTime);
    totalMinutes += mins;
    staffHours.set(shift.staffId, (staffHours.get(shift.staffId) ?? 0) + mins);
    if (shift.staff.hourlyWage) {
      laborCost += Math.round((shift.staff.hourlyWage * mins) / 60);
    }
  }

  const staffSummary = staff
    .filter((s) => s.isActive)
    .map((s) => ({
      id: s.id,
      name: s.name,
      minutes: staffHours.get(s.id) ?? 0,
      hours: Math.round(((staffHours.get(s.id) ?? 0) / 60) * 10) / 10,
    }))
    .filter((s) => s.minutes > 0);

  return {
    shiftCount: shifts.filter((s) => s.status !== ShiftStatus.CANCELLED).length,
    totalHours: Math.round((totalMinutes / 60) * 10) / 10,
    laborCost,
    staffSummary,
  };
}

/** 指定日の出勤スタッフ（ウェイター選択用） */
export async function getOnDutyStaffNames(storeId: string, date = formatJST(new Date(), "yyyy-MM-dd")) {
  const shifts = await prisma.shift.findMany({
    where: {
      storeId,
      shiftDate: parseExpenseDate(date),
      status: { in: [ShiftStatus.SCHEDULED, ShiftStatus.CONFIRMED, ShiftStatus.COMPLETED] },
    },
    include: { staff: true },
    orderBy: { startTime: "asc" },
  });

  const names = [
    ...new Set(shifts.filter((s) => s.staff.isActive).map((s) => s.staff.name)),
  ];
  if (names.length > 0) return names;

  const all = await listStaff(storeId, true);
  return all.map((s) => s.name);
}

/** 期間内のシフト人件費見込み（時給登録スタッフのみ） */
export async function getShiftLaborCostForPeriod(
  storeId: string,
  start: Date,
  end: Date,
) {
  const shifts = await prisma.shift.findMany({
    where: {
      storeId,
      status: { not: ShiftStatus.CANCELLED },
      shiftDate: { gte: start, lte: end },
    },
    include: { staff: true },
  });

  let total = 0;
  let minutes = 0;
  for (const shift of shifts) {
    const mins = shiftDurationMinutes(shift.startTime, shift.endTime);
    minutes += mins;
    if (shift.staff.hourlyWage) {
      total += Math.round((shift.staff.hourlyWage * mins) / 60);
    }
  }

  return { total, minutes, shiftCount: shifts.length };
}
