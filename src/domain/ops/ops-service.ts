import { DataSource, KitchenTicketStatus, OrderStatus, Prisma, TableStatus } from "@prisma/client";
import { getDailyClosing } from "@/domain/sales/sales-service";
import { getWeatherForDates, type WeatherSnapshot } from "@/domain/weather/weather-service";
import { formatJST, formatJSTToday, getBusinessDate, parseExpenseDate } from "@/lib/datetime";
import { isCloudRuntime, isPrinterSupported } from "@/lib/runtime-config";
import { loadPrinterConfig } from "@/lib/printer/printer-config";
import { prisma, getDefaultStore } from "@/lib/prisma";
import { STORE_LOCATION } from "@/lib/store-location";
import net from "node:net";
import os from "node:os";

const DOW = ["日", "月", "火", "水", "木", "金", "土"] as const;

export type OpsSnapshot = {
  generatedAt: string;
  source: "live" | "heartbeat";
  mode: "cloud" | "local";
  cloud: boolean;
  ok: boolean;
  db: "ok" | "error";
  hostname: string | null;
  lanIp: string | null;
  setup: { ready: boolean; products: number; tables: number };
  sales: {
    businessDate: string;
    salesCount: number;
    salesTotal: number;
    netTotal: number;
    customerCount: number;
    openOrderCount: number;
  } | null;
  floor: {
    occupiedTables: number;
    emptyTables: number;
    openOrders: number;
  };
  kitchen: {
    waiting: number;
    ready: number;
    totalOpen: number;
  };
  printer: {
    supported: boolean;
    ip: string | null;
    reachable: boolean | null;
    status: "ok" | "offline" | "unchecked" | "cloud";
    detail: string;
  };
  weather: {
    locationName: string;
    today: WeatherSnapshot | null;
    tomorrow: WeatherSnapshot | null;
  };
  outlook: {
    todayDow: string;
    tomorrowDow: string;
    sameDateLastYear: { date: string; netSales: number | null };
    sameWeekdayLastYear: { date: string; netSales: number | null };
    ratioVsSameDate: number | null;
    ratioVsSameWeekday: number | null;
    projectedToday: number | null;
    projectedTomorrow: number | null;
    weekdayAvgToday: number | null;
    weekdayAvgTomorrow: number | null;
    sampleCountToday: number;
    sampleCountTomorrow: number;
  };
  heartbeat: {
    receivedAt: string | null;
    ageSeconds: number | null;
    stale: boolean;
    source: string | null;
  } | null;
};

function lanIp(): string | null {
  const nets = os.networkInterfaces();
  for (const list of Object.values(nets)) {
    for (const iface of list ?? []) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return null;
}

function probeTcp(host: string, port: number, timeoutMs = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (ok: boolean) => {
      try {
        socket.destroy();
      } catch {
        /* ignore */
      }
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

function addDaysKey(dateKey: string, days: number): string {
  const d = parseExpenseDate(dateKey);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function dowLabel(dateKey: string): string {
  const d = parseExpenseDate(dateKey);
  return DOW[d.getUTCDay()] ?? "?";
}

async function dayNetSales(storeId: string, dateKey: string): Promise<number | null> {
  const day = parseExpenseDate(dateKey);
  const summaries = await prisma.salesDailySummary.findMany({
    where: { storeId, businessDate: day },
  });
  if (summaries.length > 0) {
    const own = summaries.find((s) => s.dataSource === DataSource.OWN_POS);
    if (own) return own.netSales;
    const smaregi = summaries.find((s) => s.dataSource === DataSource.SMAREGI);
    if (smaregi) return smaregi.netSales;
    return summaries.reduce((s, r) => s + r.netSales, 0);
  }

  const txs = await prisma.salesTransaction.findMany({
    where: { storeId, businessDate: day },
    select: { totalAmount: true },
  });
  if (txs.length === 0) return null;
  return txs.reduce((s, t) => s + t.totalAmount, 0);
}

/** 直近 N 回の同曜日（当日除く）平均 */
async function weekdayAverage(
  storeId: string,
  fromDateKey: string,
  weekday: number,
  samples = 8,
): Promise<{ avg: number | null; count: number }> {
  const values: number[] = [];
  let cursor = addDaysKey(fromDateKey, -1);
  for (let guard = 0; guard < 400 && values.length < samples; guard++) {
    const d = parseExpenseDate(cursor);
    if (d.getUTCDay() === weekday) {
      const net = await dayNetSales(storeId, cursor);
      if (net != null && net > 0) values.push(net);
    }
    cursor = addDaysKey(cursor, -1);
  }
  if (values.length === 0) return { avg: null, count: 0 };
  return {
    avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
    count: values.length,
  };
}

function ratio(current: number, baseline: number | null): number | null {
  if (baseline == null || baseline <= 0) return null;
  return Math.round((current / baseline) * 1000) / 10; // 123.4%
}

async function buildOutlook(storeId: string, todayKey: string, todayNet: number) {
  const tomorrowKey = addDaysKey(todayKey, 1);
  const sameDateLastYear = addDaysKey(todayKey, -365);
  // 364日戻すと曜日が一致
  const sameWeekdayLastYear = addDaysKey(todayKey, -364);

  const todayDow = parseExpenseDate(todayKey).getUTCDay();
  const tomorrowDow = parseExpenseDate(tomorrowKey).getUTCDay();

  const [sameDateSales, sameWeekdaySales, todayAvg, tomorrowAvg] = await Promise.all([
    dayNetSales(storeId, sameDateLastYear),
    dayNetSales(storeId, sameWeekdayLastYear),
    weekdayAverage(storeId, todayKey, todayDow),
    weekdayAverage(storeId, tomorrowKey, tomorrowDow),
  ]);

  return {
    todayDow: DOW[todayDow]!,
    tomorrowDow: DOW[tomorrowDow]!,
    sameDateLastYear: { date: sameDateLastYear, netSales: sameDateSales },
    sameWeekdayLastYear: { date: sameWeekdayLastYear, netSales: sameWeekdaySales },
    ratioVsSameDate: ratio(todayNet, sameDateSales),
    ratioVsSameWeekday: ratio(todayNet, sameWeekdaySales),
    projectedToday: todayAvg.avg,
    projectedTomorrow: tomorrowAvg.avg,
    weekdayAvgToday: todayAvg.avg,
    weekdayAvgTomorrow: tomorrowAvg.avg,
    sampleCountToday: todayAvg.count,
    sampleCountTomorrow: tomorrowAvg.count,
  };
}

function emptyOutlook(): OpsSnapshot["outlook"] {
  const todayKey = formatJSTToday();
  return {
    todayDow: dowLabel(todayKey),
    tomorrowDow: dowLabel(addDaysKey(todayKey, 1)),
    sameDateLastYear: { date: addDaysKey(todayKey, -365), netSales: null },
    sameWeekdayLastYear: { date: addDaysKey(todayKey, -364), netSales: null },
    ratioVsSameDate: null,
    ratioVsSameWeekday: null,
    projectedToday: null,
    projectedTomorrow: null,
    weekdayAvgToday: null,
    weekdayAvgTomorrow: null,
    sampleCountToday: 0,
    sampleCountTomorrow: 0,
  };
}

function printerStatus(
  cloud: boolean,
  supported: boolean,
  ip: string | null,
  reachable: boolean | null,
): OpsSnapshot["printer"] {
  if (cloud || !supported) {
    return {
      supported: false,
      ip,
      reachable: null,
      status: "cloud",
      detail: "クラウドでは店内プリンターを直接確認しません",
    };
  }
  if (!ip) {
    return {
      supported: true,
      ip: null,
      reachable: null,
      status: "unchecked",
      detail: "printer-config.json にIPがありません",
    };
  }
  if (reachable === true) {
    return {
      supported: true,
      ip,
      reachable: true,
      status: "ok",
      detail: `${ip} · 応答あり`,
    };
  }
  if (reachable === false) {
    return {
      supported: true,
      ip,
      reachable: false,
      status: "offline",
      detail: `${ip} · 未応答（電源オフ／別LAN／店外の可能性）`,
    };
  }
  return {
    supported: true,
    ip,
    reachable: null,
    status: "unchecked",
    detail: `${ip} · 未確認`,
  };
}

/** このホストのライブ状態（Pi / ローカル） */
export async function buildLiveOpsSnapshot(): Promise<OpsSnapshot> {
  const cloud = isCloudRuntime();
  let db: "ok" | "error" = "ok";
  let setup = { ready: false, products: 0, tables: 0 };
  let sales: OpsSnapshot["sales"] = null;
  let floor = { occupiedTables: 0, emptyTables: 0, openOrders: 0 };
  let kitchen = { waiting: 0, ready: 0, totalOpen: 0 };
  let outlook = emptyOutlook();
  let weather: OpsSnapshot["weather"] = {
    locationName: STORE_LOCATION.name,
    today: null,
    tomorrow: null,
  };
  let printerReachable: boolean | null = null;
  const printerCfg = loadPrinterConfig();
  const printerIp = printerCfg.ip && printerCfg.ip !== "agent" ? printerCfg.ip : null;

  try {
    const store = await getDefaultStore();
    const todayKey = formatJST(getBusinessDate(new Date()), "yyyy-MM-dd");
    const tomorrowKey = addDaysKey(todayKey, 1);

    const [products, tables, openOrders, occupied, waiting, ready, weatherMap] = await Promise.all([
      prisma.product.count({ where: { storeId: store.id } }),
      prisma.table.count({ where: { storeId: store.id } }),
      prisma.order.count({
        where: {
          storeId: store.id,
          status: { in: [OrderStatus.OPEN, OrderStatus.SENT_TO_KITCHEN, OrderStatus.READY] },
        },
      }),
      prisma.table.count({ where: { storeId: store.id, status: { not: TableStatus.EMPTY } } }),
      prisma.kitchenTicket.count({
        where: { status: { in: [KitchenTicketStatus.NEW, KitchenTicketStatus.COOKING] } },
      }),
      prisma.kitchenTicket.count({ where: { status: KitchenTicketStatus.DONE } }),
      getWeatherForDates(store.id, [todayKey, tomorrowKey]),
    ]);
    setup = { ready: tables >= 9 && products > 0, products, tables };
    floor = {
      occupiedTables: occupied,
      emptyTables: Math.max(0, tables - occupied),
      openOrders,
    };
    kitchen = { waiting, ready, totalOpen: waiting + ready };
    weather = {
      locationName: STORE_LOCATION.name,
      today: weatherMap.get(todayKey) ?? null,
      tomorrow: weatherMap.get(tomorrowKey) ?? null,
    };

    const closing = await getDailyClosing(store.id);
    sales = {
      businessDate: closing.businessDate,
      salesCount: closing.salesCount,
      salesTotal: closing.salesTotal,
      netTotal: closing.netTotal,
      customerCount: closing.customerCount,
      openOrderCount: closing.openOrderCount,
    };
    outlook = await buildOutlook(store.id, closing.businessDate, closing.netTotal);
  } catch {
    db = "error";
  }

  if (!cloud && printerIp && isPrinterSupported()) {
    printerReachable = await probeTcp(printerIp, printerCfg.port || 9100);
  }

  let heartbeatMeta: OpsSnapshot["heartbeat"] = null;
  try {
    const hb = await prisma.opsHeartbeat.findUnique({ where: { id: "shop" } });
    if (hb) {
      const age = Math.round((Date.now() - hb.receivedAt.getTime()) / 1000);
      heartbeatMeta = {
        receivedAt: hb.receivedAt.toISOString(),
        ageSeconds: age,
        stale: age > 180,
        source: hb.source,
      };
    }
  } catch {
    /* ignore */
  }

  return {
    generatedAt: new Date().toISOString(),
    source: "live",
    mode: cloud ? "cloud" : "local",
    cloud,
    ok: db === "ok",
    db,
    hostname: os.hostname(),
    lanIp: lanIp(),
    setup,
    sales,
    floor,
    kitchen,
    printer: printerStatus(cloud, isPrinterSupported(), printerIp, printerReachable),
    weather,
    outlook,
    heartbeat: heartbeatMeta,
  };
}

/** クラウド側: 直近の心拍をモニター用スナップショットに変換 */
export async function buildHeartbeatOpsSnapshot(): Promise<OpsSnapshot | null> {
  const hb = await prisma.opsHeartbeat.findUnique({ where: { id: "shop" } });
  if (!hb) return null;
  const payload = hb.payload as Partial<OpsSnapshot>;
  const age = Math.round((Date.now() - hb.receivedAt.getTime()) / 1000);

  // 天気・見通しはクラウド側でも取得（心拍が古くても気象は最新に）
  let weather = payload.weather ?? {
    locationName: STORE_LOCATION.name,
    today: null,
    tomorrow: null,
  };
  let outlook = payload.outlook ?? emptyOutlook();
  try {
    const store = await getDefaultStore();
    const todayKey = formatJSTToday();
    const tomorrowKey = addDaysKey(todayKey, 1);
    const map = await getWeatherForDates(store.id, [todayKey, tomorrowKey]);
    weather = {
      locationName: STORE_LOCATION.name,
      today: map.get(todayKey) ?? null,
      tomorrow: map.get(tomorrowKey) ?? null,
    };
    const todayNet = payload.sales?.netTotal ?? 0;
    outlook = await buildOutlook(store.id, payload.sales?.businessDate ?? todayKey, todayNet);
  } catch {
    /* keep payload */
  }

  return {
    generatedAt: hb.receivedAt.toISOString(),
    source: "heartbeat",
    mode: "local",
    cloud: false,
    ok: payload.ok !== false && age <= 180,
    db: payload.db === "error" ? "error" : "ok",
    hostname: hb.hostname ?? payload.hostname ?? null,
    lanIp: hb.lanIp ?? payload.lanIp ?? null,
    setup: payload.setup ?? { ready: false, products: 0, tables: 0 },
    sales: payload.sales ?? null,
    floor: payload.floor ?? { occupiedTables: 0, emptyTables: 0, openOrders: 0 },
    kitchen: payload.kitchen ?? { waiting: 0, ready: 0, totalOpen: 0 },
    printer: payload.printer
      ? {
          ...printerStatus(
            false,
            payload.printer.supported !== false,
            payload.printer.ip ?? null,
            payload.printer.reachable ?? null,
          ),
          detail: payload.printer.detail ?? printerStatus(false, true, payload.printer.ip ?? null, payload.printer.reachable ?? null).detail,
        }
      : printerStatus(false, true, null, null),
    weather,
    outlook,
    heartbeat: {
      receivedAt: hb.receivedAt.toISOString(),
      ageSeconds: age,
      stale: age > 180,
      source: hb.source,
    },
  };
}

export async function upsertOpsHeartbeat(input: {
  source?: string;
  hostname?: string | null;
  lanIp?: string | null;
  payload: OpsSnapshot;
}) {
  const data = {
    source: input.source ?? "pi",
    hostname: input.hostname ?? null,
    lanIp: input.lanIp ?? null,
    payload: input.payload as unknown as Prisma.InputJsonValue,
    receivedAt: new Date(),
  };
  await prisma.opsHeartbeat.upsert({
    where: { id: "shop" },
    create: { id: "shop", ...data },
    update: data,
  });
}
