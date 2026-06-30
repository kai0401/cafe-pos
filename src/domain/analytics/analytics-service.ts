import { DataSource, PaymentMethodType } from "@prisma/client";
import {
  countBusinessDays,
  dateKey,
  formatJST,
  getDayOfWeekJST,
  getYoYSameWeekdayDate,
  isRegularClosedDay,
} from "@/lib/datetime";
import { calcPercentChange } from "@/lib/money";
import { getDefaultStore, prisma } from "@/lib/prisma";
import {
  loadDailySalesFromTransactions,
  loadHourlySalesFromTransactions,
  nonDemoSalesWhere,
  type DailySalesRow,
} from "@/lib/sales-query";
import { getClosedDays } from "@/lib/store-config";
import { STORE_LOCATION } from "@/lib/store-location";
import { getWeatherForDates } from "@/domain/weather/weather-service";

export type AnalyticsFilter = {
  startDate?: string;
  endDate?: string;
  businessHoursOnly?: boolean;
  businessDaysOnly?: boolean;
  dataSource?: DataSource;
};

const DOW_LABELS = ["月", "火", "水", "木", "金", "土", "日"];

function resolveDataSources(filter: AnalyticsFilter): DataSource[] {
  return filter.dataSource ? [filter.dataSource] : [DataSource.SMAREGI, DataSource.OWN_POS];
}

type DailySummaryRow = DailySalesRow;

function salesByDateMap(summaries: DailySummaryRow[]) {
  return new Map(summaries.map((s) => [dateKey(s.businessDate), s]));
}

async function resolveFilter(filter: AnalyticsFilter) {
  const store = await getDefaultStore();
  const dataSources = resolveDataSources(filter);
  const summaries = await loadDailySalesFromTransactions(store.id, dataSources);

  const startDate = filter.startDate
    ? new Date(filter.startDate)
    : summaries[0]?.businessDate ?? new Date();
  const endDate = filter.endDate
    ? new Date(filter.endDate)
    : summaries[summaries.length - 1]?.businessDate ?? new Date();

  return { store, startDate, endDate, summaries, dataSources };
}

function inRange(date: Date, start: Date, end: Date): boolean {
  return date >= start && date <= end;
}

export async function getAnalyticsSummary(filter: AnalyticsFilter = {}) {
  const { store, startDate, endDate, summaries, dataSources } = await resolveFilter(filter);
  const businessHoursOnly = filter.businessHoursOnly ?? false;
  const businessDaysOnly = filter.businessDaysOnly ?? true;

  const closedDays = getClosedDays(store.regularClosedDays);
  const byDate = salesByDateMap(summaries);

  const filtered = summaries.filter((s) => {
    if (!inRange(s.businessDate, startDate, endDate)) return false;
    if (businessDaysOnly && isRegularClosedDay(s.businessDate, closedDays)) {
      return false;
    }
    return true;
  });

  const totalSales = filtered.reduce((sum, s) => sum + s.netSales, 0);
  const totalCustomers = filtered.reduce((sum, s) => sum + s.customerCount, 0);
  const totalOrders = filtered.reduce((sum, s) => sum + s.orderCount, 0);

  const today = filtered[filtered.length - 1];
  const yoyRefDate = today ? getYoYSameWeekdayDate(today.businessDate) : null;
  const yoyRefDay = yoyRefDate ? byDate.get(dateKey(yoyRefDate)) : undefined;

  const thisMonth = filtered.filter(
    (s) =>
      s.businessDate.getUTCMonth() === endDate.getUTCMonth() &&
      s.businessDate.getUTCFullYear() === endDate.getUTCFullYear(),
  );
  const lastYearSameMonth = summaries.filter((s) => {
    if (businessDaysOnly && isRegularClosedDay(s.businessDate, closedDays)) return false;
    return (
      s.businessDate.getUTCMonth() === endDate.getUTCMonth() &&
      s.businessDate.getUTCFullYear() === endDate.getUTCFullYear() - 1
    );
  });

  const monthSales = thisMonth.reduce((sum, s) => sum + s.netSales, 0);
  const prevYearMonthSales = lastYearSameMonth.reduce((sum, s) => sum + s.netSales, 0);

  const payments = await prisma.salesTransactionPayment.groupBy({
    by: ["method"],
    where: {
      salesTransaction: {
        ...nonDemoSalesWhere(store.id, dataSources),
        businessDate: { gte: startDate, lte: endDate },
      },
    },
    _sum: { amount: true },
  });

  return {
    store: {
      name: store.name,
      openTime: store.openTime,
      closeTime: store.closeTime,
      regularClosedDays: closedDays,
      location: STORE_LOCATION.name,
    },
    period: { start: startDate, end: endDate },
    today: today
      ? {
          date: dateKey(today.businessDate),
          dayOfWeek: DOW_LABELS[getDayOfWeekJST(today.businessDate)]!,
          sales: today.netSales,
          customers: today.customerCount,
          orders: today.orderCount,
          avgSpend: today.avgSpend,
          yoyDate: yoyRefDate ? dateKey(yoyRefDate) : null,
          yoySales: yoyRefDay?.netSales ?? null,
          vsYoYSameWeekday: yoyRefDay
            ? calcPercentChange(today.netSales, yoyRefDay.netSales)
            : null,
        }
      : null,
    month: {
      sales: monthSales,
      vsPrevYearSameMonth: calcPercentChange(monthSales, prevYearMonthSales),
      prevYearSales: prevYearMonthSales,
      businessDays: countBusinessDays(
        new Date(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1),
        endDate,
        closedDays,
      ),
    },
    totals: {
      sales: totalSales,
      customers: totalCustomers,
      orders: totalOrders,
      avgSpend: totalCustomers > 0 ? Math.round(totalSales / totalCustomers) : 0,
    },
    payments: payments.map((p) => ({
      method: p.method,
      amount: p._sum.amount ?? 0,
    })),
    businessHoursOnly,
    businessDaysOnly,
  };
}

export async function getDailySales(filter: AnalyticsFilter = {}) {
  const { store, startDate, endDate, summaries } = await resolveFilter(filter);
  const businessDaysOnly = filter.businessDaysOnly ?? true;
  const closedDays = getClosedDays(store.regularClosedDays);
  const byDate = salesByDateMap(summaries);

  return summaries
    .filter((s) => {
      if (!inRange(s.businessDate, startDate, endDate)) return false;
      if (businessDaysOnly && isRegularClosedDay(s.businessDate, closedDays)) {
        return false;
      }
      return true;
    })
    .map((s) => {
      const yoyDate = getYoYSameWeekdayDate(s.businessDate);
      const yoyRow = byDate.get(dateKey(yoyDate));
      return {
        date: formatJST(s.businessDate, "yyyy-MM-dd"),
        dayOfWeek: DOW_LABELS[getDayOfWeekJST(s.businessDate)]!,
        sales: s.netSales,
        customers: s.customerCount,
        orders: s.orderCount,
        avgSpend: s.avgSpend,
        isClosedDay: isRegularClosedDay(s.businessDate, closedDays),
        yoyDate: dateKey(yoyDate),
        yoySales: yoyRow?.netSales ?? null,
        vsYoYSameWeekday: yoyRow ? calcPercentChange(s.netSales, yoyRow.netSales) : null,
      };
    });
}

export async function getDashboardData(filter: AnalyticsFilter = {}) {
  const [summary, daily, hourly, products] = await Promise.all([
    getAnalyticsSummary(filter),
    getDailySales(filter),
    getHourlySales({ ...filter, businessHoursOnly: true }),
    getProductSales(filter, 10),
  ]);

  const recent = daily.slice(-21);
  const weatherDates = [
    ...recent.map((d) => d.date),
    ...recent.map((d) => d.yoyDate),
  ];
  const store = await getDefaultStore();
  const weather = await getWeatherForDates(store.id, weatherDates);

  return {
    summary,
    daily: recent,
    hourly: hourly.filter((h) => h.sales > 0),
    products,
    weather: Object.fromEntries(weather),
  };
}

export async function getHourlySales(filter: AnalyticsFilter = {}) {
  const { store, startDate, endDate, dataSources } = await resolveFilter(filter);
  const businessHoursOnly = filter.businessHoursOnly ?? true;

  return loadHourlySalesFromTransactions(
    store.id,
    dataSources,
    startDate,
    endDate,
    store.openTime,
    store.closeTime,
    businessHoursOnly,
  );
}

export async function getWeekdaySales(filter: AnalyticsFilter = {}) {
  const daily = await getDailySales(filter);
  const map = new Map<number, { sales: number; customers: number; days: number }>();

  for (let i = 0; i < 7; i++) map.set(i, { sales: 0, customers: 0, days: 0 });

  for (const row of daily) {
    const dow = DOW_LABELS.indexOf(row.dayOfWeek);
    if (dow < 0) continue;
    const current = map.get(dow)!;
    current.sales += row.sales;
    current.customers += row.customers;
    current.days += 1;
  }

  return Array.from(map.entries()).map(([dow, data]) => ({
    dayOfWeek: dow,
    label: DOW_LABELS[dow]!,
    sales: data.sales,
    customers: data.customers,
    avgSales: data.days > 0 ? Math.round(data.sales / data.days) : 0,
    avgCustomers: data.days > 0 ? Math.round(data.customers / data.days) : 0,
  }));
}

export async function getProductSales(filter: AnalyticsFilter = {}, limit = 20) {
  const { store, startDate, endDate, dataSources } = await resolveFilter(filter);

  const items = await prisma.salesTransactionItem.findMany({
    where: {
      salesTransaction: {
        ...nonDemoSalesWhere(store.id, dataSources),
        businessDate: { gte: startDate, lte: endDate },
      },
    },
  });

  const map = new Map<string, { name: string; category: string | null; qty: number; sales: number }>();
  for (const item of items) {
    const key = item.productName;
    if (!map.has(key)) {
      map.set(key, { name: item.productName, category: item.categoryName, qty: 0, sales: 0 });
    }
    const current = map.get(key)!;
    current.qty += item.quantity;
    current.sales += item.totalAmount;
  }

  const total = Array.from(map.values()).reduce((s, p) => s + p.sales, 0);
  return Array.from(map.values())
    .sort((a, b) => b.sales - a.sales)
    .slice(0, limit)
    .map((p, i) => ({
      rank: i + 1,
      ...p,
      share: total > 0 ? Math.round((p.sales / total) * 1000) / 10 : 0,
    }));
}

export async function getPaymentBreakdown(filter: AnalyticsFilter = {}) {
  const summary = await getAnalyticsSummary(filter);
  const total = summary.payments.reduce((s, p) => s + p.amount, 0);
  const labels: Record<PaymentMethodType, string> = {
    CASH: "現金",
    CREDIT_CARD: "クレジット",
    TRANSIT_IC: "交通系IC",
    QR: "QR決済",
    OTHER: "その他",
  };

  return summary.payments.map((p) => ({
    method: p.method,
    label: labels[p.method],
    amount: p.amount,
    ratio: total > 0 ? Math.round((p.amount / total) * 1000) / 10 : 0,
  }));
}

export async function getMonthlyReport(filter: AnalyticsFilter = {}) {
  const { store, endDate } = await resolveFilter(filter);
  const monthStart = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth() + 1, 0));

  const daily = await getDailySales({
    ...filter,
    startDate: monthStart.toISOString().slice(0, 10),
    endDate: monthEnd.toISOString().slice(0, 10),
  });

  const products = await getProductSales(filter, 20);
  const weekday = await getWeekdaySales(filter);
  const hourly = await getHourlySales(filter);
  const payments = await getPaymentBreakdown(filter);

  const monthSales = daily.reduce((s, d) => s + d.sales, 0);
  const monthCustomers = daily.reduce((s, d) => s + d.customers, 0);
  const businessDays = daily.length;

  const prevMonthStart = new Date(monthStart);
  prevMonthStart.setUTCMonth(prevMonthStart.getUTCMonth() - 1);
  const prevDaily = await getDailySales({
    ...filter,
    startDate: prevMonthStart.toISOString().slice(0, 10),
    endDate: new Date(Date.UTC(prevMonthStart.getUTCFullYear(), prevMonthStart.getUTCMonth() + 1, 0))
      .toISOString()
      .slice(0, 10),
  });
  const prevMonthSales = prevDaily.reduce((s, d) => s + d.sales, 0);

  return {
    store: store.name,
    period: formatJST(monthStart, "yyyy年M月"),
    monthSales,
    prevMonthRatio: calcPercentChange(monthSales, prevMonthSales),
    businessDays,
    avgDailySales: businessDays > 0 ? Math.round(monthSales / businessDays) : 0,
    customers: monthCustomers,
    avgSpend: monthCustomers > 0 ? Math.round(monthSales / monthCustomers) : 0,
    topProducts: products,
    weekday,
    hourly,
    payments,
  };
}

export async function getSalesTrend(filter: AnalyticsFilter = {}) {
  const daily = await getDailySales(filter);
  let cumulative = 0;
  return daily.map((d) => {
    cumulative += d.sales;
    return { ...d, cumulative };
  });
}

export type ProfitLossGrade = "S" | "A" | "B" | "C" | "D";

function gradeFromMargin(marginPercent: number): ProfitLossGrade {
  if (marginPercent >= 70) return "S";
  if (marginPercent >= 60) return "A";
  if (marginPercent >= 50) return "B";
  if (marginPercent >= 40) return "C";
  return "D";
}

export async function getProfitLossReport(filter: AnalyticsFilter = {}) {
  const { store, endDate } = await resolveFilter(filter);
  const monthStart = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth() + 1, 0));

  const monthFilter: AnalyticsFilter = {
    ...filter,
    startDate: monthStart.toISOString().slice(0, 10),
    endDate: monthEnd.toISOString().slice(0, 10),
  };

  const daily = await getDailySales(monthFilter);
  const revenue = daily.reduce((sum, row) => sum + row.sales, 0);
  const customers = daily.reduce((sum, row) => sum + row.customers, 0);
  const businessDays = daily.length;

  const prevMonthStart = new Date(monthStart);
  prevMonthStart.setUTCMonth(prevMonthStart.getUTCMonth() - 1);
  const prevDaily = await getDailySales({
    ...filter,
    startDate: prevMonthStart.toISOString().slice(0, 10),
    endDate: new Date(Date.UTC(prevMonthStart.getUTCFullYear(), prevMonthStart.getUTCMonth() + 1, 0))
      .toISOString()
      .slice(0, 10),
  });
  const prevRevenue = prevDaily.reduce((sum, row) => sum + row.sales, 0);

  const prevItems = await prisma.salesTransactionItem.findMany({
    where: {
      salesTransaction: {
        ...nonDemoSalesWhere(store.id, resolveDataSources(filter)),
        businessDate: { gte: prevMonthStart, lte: new Date(Date.UTC(prevMonthStart.getUTCFullYear(), prevMonthStart.getUTCMonth() + 1, 0)) },
      },
    },
    include: { product: { select: { costAmount: true } } },
  });

  let prevCostOfGoods = 0;
  for (const item of prevItems) {
    const unitCost = item.costAmount ?? item.product?.costAmount ?? 0;
    prevCostOfGoods += unitCost * item.quantity;
  }
  const prevGrossProfit = prevRevenue - prevCostOfGoods;

  const items = await prisma.salesTransactionItem.findMany({
    where: {
      salesTransaction: {
        ...nonDemoSalesWhere(store.id, resolveDataSources(filter)),
        businessDate: { gte: monthStart, lte: monthEnd },
      },
    },
    include: { product: { select: { costAmount: true } } },
  });

  let costOfGoods = 0;
  let itemsWithCost = 0;
  const categoryMap = new Map<
    string,
    { name: string; revenue: number; cost: number; quantity: number }
  >();

  for (const item of items) {
    const unitCost = item.costAmount ?? item.product?.costAmount ?? 0;
    const lineCost = unitCost * item.quantity;
    costOfGoods += lineCost;
    if (unitCost > 0) itemsWithCost += 1;

    const category = item.categoryName ?? "その他";
    if (!categoryMap.has(category)) {
      categoryMap.set(category, { name: category, revenue: 0, cost: 0, quantity: 0 });
    }
    const row = categoryMap.get(category)!;
    row.revenue += item.totalAmount;
    row.cost += lineCost;
    row.quantity += item.quantity;
  }

  const grossProfit = revenue - costOfGoods;
  const marginPercent = revenue > 0 ? Math.round((grossProfit / revenue) * 1000) / 10 : 0;
  const grade = gradeFromMargin(marginPercent);

  const categories = Array.from(categoryMap.values())
    .map((row) => ({
      ...row,
      profit: row.revenue - row.cost,
      marginPercent: row.revenue > 0 ? Math.round(((row.revenue - row.cost) / row.revenue) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.profit - a.profit);

  const targetRevenue = prevRevenue > 0 ? Math.round(prevRevenue * 1.05) : revenue;
  const targetProgress = targetRevenue > 0 ? Math.min(100, Math.round((revenue / targetRevenue) * 1000) / 10) : 0;

  return {
    store: store.name,
    period: formatJST(monthStart, "yyyy年M月"),
    revenue,
    costOfGoods,
    grossProfit,
    marginPercent,
    grade,
    prevRevenue,
    revenueChange: calcPercentChange(revenue, prevRevenue),
    profitChange: calcPercentChange(grossProfit, prevGrossProfit),
    businessDays,
    customers,
    avgDailyRevenue: businessDays > 0 ? Math.round(revenue / businessDays) : 0,
    avgSpend: customers > 0 ? Math.round(revenue / customers) : 0,
    costCoverage: items.length > 0 ? Math.round((itemsWithCost / items.length) * 1000) / 10 : 0,
    targetRevenue,
    targetProgress,
    categories,
    daily: daily.map((row) => ({
      date: row.date,
      dayOfWeek: row.dayOfWeek,
      revenue: row.sales,
      customers: row.customers,
    })),
  };
}
