import { DataSource, ExpenseCategory, TransactionType } from "@prisma/client";
import { getExpenseSummary } from "@/domain/expense/expense-service";
import { getShiftLaborCostForPeriod } from "@/domain/shift/shift-service";
import {
  getAnalyticsSummary,
  getDailySales,
  getHourlySales,
  getProductSales,
  getWeekdaySales,
} from "@/domain/analytics/analytics-service";
import { getDailyClosing } from "@/domain/sales/sales-service";
import {
  getCurrentJstYearMonth,
  getJstYearMonth,
  jstMonthRange,
  prevJstMonth,
} from "@/lib/analytics-period";
import { calcPercentChange } from "@/lib/money";
import { prisma } from "@/lib/prisma";

function monthRange(year: number, month: number) {
  const { start, end, label } = jstMonthRange(year, month);
  return { start, end, label };
}

function prevMonth(year: number, month: number) {
  return prevJstMonth(year, month);
}

/** 売上原価（取引明細の原価 × 数量） */
export async function getCostOfGoodsSold(storeId: string, start: Date, end: Date) {
  const items = await prisma.salesTransactionItem.findMany({
    where: {
      salesTransaction: {
        storeId,
        businessDate: { gte: start, lte: end },
        transactionType: { in: [TransactionType.SALE, TransactionType.REFUND] },
        dataSource: { in: [DataSource.SMAREGI, DataSource.OWN_POS] },
      },
    },
    include: { product: { select: { costAmount: true } } },
  });

  let total = 0;
  let coveredQty = 0;
  let totalQty = 0;
  for (const item of items) {
    const unitCost = item.costAmount ?? item.product?.costAmount ?? null;
    totalQty += Math.abs(item.quantity);
    if (unitCost != null && unitCost > 0) {
      total += unitCost * item.quantity;
      coveredQty += Math.abs(item.quantity);
    }
  }

  return {
    total: Math.max(0, total),
    coverageRate: totalQty > 0 ? Math.round((coveredQty / totalQty) * 1000) / 10 : 0,
  };
}

/** 期間の純売上（日次サマリー統合） */
async function getNetSales(storeId: string, start: Date, end: Date) {
  const rows = await prisma.salesDailySummary.findMany({
    where: {
      storeId,
      businessDate: { gte: start, lte: end },
      dataSource: { in: [DataSource.SMAREGI, DataSource.OWN_POS] },
    },
  });

  const map = new Map<string, number>();
  for (const r of rows) {
    const key = r.businessDate.toISOString().slice(0, 10);
    map.set(key, (map.get(key) ?? 0) + r.netSales);
  }
  return Array.from(map.values()).reduce((s, v) => s + v, 0);
}

/** イートイン / テイクアウト比率 */
async function getEatInSplit(storeId: string, start: Date, end: Date) {
  const rows = await prisma.salesDailySummary.findMany({
    where: {
      storeId,
      businessDate: { gte: start, lte: end },
      dataSource: { in: [DataSource.SMAREGI, DataSource.OWN_POS] },
    },
  });

  const merged = new Map<string, { dineIn: number; takeout: number }>();
  for (const r of rows) {
    const key = r.businessDate.toISOString().slice(0, 10);
    const e = merged.get(key) ?? { dineIn: 0, takeout: 0 };
    e.dineIn += r.dineInSales;
    e.takeout += r.takeoutSales;
    merged.set(key, e);
  }

  let dineIn = 0;
  let takeout = 0;
  for (const v of merged.values()) {
    dineIn += v.dineIn;
    takeout += v.takeout;
  }
  const total = dineIn + takeout;
  return {
    dineIn,
    takeout,
    dineInRatio: total > 0 ? Math.round((dineIn / total) * 1000) / 10 : 0,
    takeoutRatio: total > 0 ? Math.round((takeout / total) * 1000) / 10 : 0,
  };
}

export type ProfitLossPeriod = {
  label: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMargin: number;
  expenses: number;
  operatingProfit: number;
  operatingMargin: number;
  expenseByCategory: { category: ExpenseCategory; amount: number }[];
  cogsCoverage: number;
};

export async function getProfitLossForPeriod(
  storeId: string,
  start: Date,
  end: Date,
  label: string,
): Promise<ProfitLossPeriod> {
  const [revenue, cogsResult, expenseSummary] = await Promise.all([
    getNetSales(storeId, start, end),
    getCostOfGoodsSold(storeId, start, end),
    getExpenseSummary(storeId, start, end),
  ]);

  const cogs = cogsResult.total;
  const grossProfit = revenue - cogs;
  const operatingProfit = grossProfit - expenseSummary.total;

  return {
    label,
    revenue,
    cogs,
    grossProfit,
    grossMargin: revenue > 0 ? Math.round((grossProfit / revenue) * 1000) / 10 : 0,
    expenses: expenseSummary.total,
    operatingProfit,
    operatingMargin: revenue > 0 ? Math.round((operatingProfit / revenue) * 1000) / 10 : 0,
    expenseByCategory: expenseSummary.byCategory,
    cogsCoverage: cogsResult.coverageRate,
  };
}

/** 直近Nヶ月の損益トレンド（最新データ月まで、未来の空月は除外） */
export async function getProfitLossTrend(storeId: string, months = 6) {
  const lastSummary = await prisma.salesDailySummary.findFirst({
    where: { storeId },
    orderBy: { businessDate: "desc" },
    select: { businessDate: true },
  });

  const anchor = lastSummary
    ? getJstYearMonth(lastSummary.businessDate)
    : getCurrentJstYearMonth();

  const periods = Array.from({ length: months }, (_, index) => {
    const i = months - 1 - index;
    const d = new Date(Date.UTC(anchor.year, anchor.month - 1 - i, 1));
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    return monthRange(y, m);
  });

  return Promise.all(
    periods.map((period) =>
      getProfitLossForPeriod(storeId, period.start, period.end, period.label),
    ),
  );
}

export type DashboardBundle = {
  store: { name: string; openTime: string; closeTime: string };
  todayPos: Awaited<ReturnType<typeof getDailyClosing>>;
  summary: Awaited<ReturnType<typeof getAnalyticsSummary>>;
  /** カレンダー上の今月 */
  currentMonth: ProfitLossPeriod;
  /** 表示用（今月にデータがなければ前月） */
  displayMonth: ProfitLossPeriod;
  displayMonthIsFallback: boolean;
  /** 表示月の前月 */
  displayPrevMonth: ProfitLossPeriod;
  prevMonth: ProfitLossPeriod;
  plTrend: ProfitLossPeriod[];
  eatInSplit: Awaited<ReturnType<typeof getEatInSplit>>;
  weekday: Awaited<ReturnType<typeof getWeekdaySales>>;
  hourly: Awaited<ReturnType<typeof getHourlySales>>;
  daily: Awaited<ReturnType<typeof getDailySales>>;
  products: Awaited<ReturnType<typeof getProductSales>>;
  recentExpenses: Awaited<ReturnType<typeof getExpenseSummary>>["recent"];
  benchmarks: {
    foodCostRatio: number;
    laborCostRatio: number;
    rentCostRatio: number;
    shiftLaborCost: number;
    manualLaborExpense: number;
    targetFoodCost: number;
    targetLaborCost: number;
  };
  comparisons: {
    revenueMoM: number | null;
    profitMoM: number | null;
    expenseMoM: number | null;
  };
};

/** ダッシュボード用の統合データ */
export async function getDashboardBundle(storeId: string): Promise<DashboardBundle> {
  const { year: cy, month: cm } = getCurrentJstYearMonth();
  const { start: curStart, end: curEnd } = monthRange(cy, cm);
  const pm = prevMonth(cy, cm);
  const { start: prevStart, end: prevEnd } = monthRange(pm.year, pm.month);

  const yearStart = new Date(Date.UTC(cy, 0, 1)).toISOString().slice(0, 10);
  const yearEnd = curEnd.toISOString().slice(0, 10);

  const [
    summary,
    todayPos,
    currentMonth,
    prevMonthPl,
    plTrend,
    weekday,
    hourly,
    daily,
    products,
  ] = await Promise.all([
    getAnalyticsSummary({ businessDaysOnly: true }),
    getDailyClosing(storeId),
    getProfitLossForPeriod(storeId, curStart, curEnd, `${cy}年${cm}月`),
    getProfitLossForPeriod(storeId, prevStart, prevEnd, `${pm.year}年${pm.month}月`),
    getProfitLossTrend(storeId, 6),
    getWeekdaySales({
      businessDaysOnly: true,
      startDate: yearStart,
      endDate: yearEnd,
    }),
    getHourlySales({ businessHoursOnly: true, businessDaysOnly: true }),
    getDailySales({ businessDaysOnly: true }),
    getProductSales({ businessDaysOnly: true }, 10),
  ]);

  const displayMonthIsFallback =
    currentMonth.revenue === 0 && prevMonthPl.revenue > 0;
  const displayMonth = displayMonthIsFallback ? prevMonthPl : currentMonth;

  const ppm = prevMonth(pm.year, pm.month);
  const { start: ppmStart, end: ppmEnd } = monthRange(ppm.year, ppm.month);
  const monthBeforePrev = displayMonthIsFallback
    ? await getProfitLossForPeriod(storeId, ppmStart, ppmEnd, `${ppm.year}年${ppm.month}月`)
    : prevMonthPl;

  const displayStart = displayMonthIsFallback ? prevStart : curStart;
  const displayEnd = displayMonthIsFallback ? prevEnd : curEnd;
  const eatInSplit = await getEatInSplit(storeId, displayStart, displayEnd);
  const [expenseRecent, shiftLabor] = await Promise.all([
    getExpenseSummary(storeId, displayStart, displayEnd),
    getShiftLaborCostForPeriod(storeId, displayStart, displayEnd),
  ]);

  const ingredientExpense =
    displayMonth.expenseByCategory.find((c) => c.category === ExpenseCategory.INGREDIENTS)?.amount ?? 0;
  const manualLaborExpense =
    displayMonth.expenseByCategory.find((c) => c.category === ExpenseCategory.LABOR)?.amount ?? 0;
  const laborExpense = manualLaborExpense + shiftLabor.total;
  const rentExpense =
    displayMonth.expenseByCategory.find((c) => c.category === ExpenseCategory.RENT)?.amount ?? 0;

  const totalFoodCost = displayMonth.cogs + ingredientExpense;
  const rev = displayMonth.revenue;

  return {
    store: {
      name: summary.store.name,
      openTime: summary.store.openTime,
      closeTime: summary.store.closeTime,
    },
    todayPos,
    summary,
    currentMonth,
    displayMonth,
    displayMonthIsFallback,
    displayPrevMonth: monthBeforePrev,
    prevMonth: prevMonthPl,
    plTrend,
    eatInSplit,
    weekday,
    hourly,
    daily: daily.slice(-60),
    products,
    recentExpenses: expenseRecent.recent,
    benchmarks: {
      foodCostRatio: rev > 0 ? Math.round((totalFoodCost / rev) * 1000) / 10 : 0,
      laborCostRatio: rev > 0 ? Math.round((laborExpense / rev) * 1000) / 10 : 0,
      rentCostRatio: rev > 0 ? Math.round((rentExpense / rev) * 1000) / 10 : 0,
      shiftLaborCost: shiftLabor.total,
      manualLaborExpense,
      targetFoodCost: 35,
      targetLaborCost: 30,
    },
    comparisons: {
      revenueMoM: calcPercentChange(displayMonth.revenue, monthBeforePrev.revenue),
      profitMoM: calcPercentChange(displayMonth.operatingProfit, monthBeforePrev.operatingProfit),
      expenseMoM: calcPercentChange(displayMonth.expenses, monthBeforePrev.expenses),
    },
  };
}
