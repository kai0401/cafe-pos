import { KitchenTicketStatus, OrderStatus, Prisma, TableStatus } from "@prisma/client";
import { getDailyClosing } from "@/domain/sales/sales-service";
import { isCloudRuntime, isPrinterSupported } from "@/lib/runtime-config";
import { loadPrinterConfig } from "@/lib/printer/printer-config";
import { prisma, getDefaultStore } from "@/lib/prisma";
import net from "node:net";
import os from "node:os";

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

function probeTcp(host: string, port: number, timeoutMs = 1200): Promise<boolean> {
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

/** このホストのライブ状態（Pi / ローカル） */
export async function buildLiveOpsSnapshot(): Promise<OpsSnapshot> {
  const cloud = isCloudRuntime();
  let db: "ok" | "error" = "ok";
  let setup = { ready: false, products: 0, tables: 0 };
  let sales: OpsSnapshot["sales"] = null;
  let floor = { occupiedTables: 0, emptyTables: 0, openOrders: 0 };
  let kitchen = { waiting: 0, ready: 0, totalOpen: 0 };
  let printerReachable: boolean | null = null;
  const printerCfg = loadPrinterConfig();
  const printerIp = printerCfg.ip && printerCfg.ip !== "agent" ? printerCfg.ip : null;

  try {
    const store = await getDefaultStore();
    const [products, tables, openOrders, occupied, waiting, ready] = await Promise.all([
      prisma.product.count({ where: { storeId: store.id } }),
      prisma.table.count({ where: { storeId: store.id } }),
      prisma.order.count({
        where: { storeId: store.id, status: { in: [OrderStatus.OPEN, OrderStatus.SENT_TO_KITCHEN, OrderStatus.READY] } },
      }),
      prisma.table.count({ where: { storeId: store.id, status: { not: TableStatus.EMPTY } } }),
      prisma.kitchenTicket.count({
        where: { status: { in: [KitchenTicketStatus.NEW, KitchenTicketStatus.COOKING] } },
      }),
      prisma.kitchenTicket.count({ where: { status: KitchenTicketStatus.DONE } }),
    ]);
    setup = { ready: tables >= 9 && products > 0, products, tables };
    floor = {
      occupiedTables: occupied,
      emptyTables: Math.max(0, tables - occupied),
      openOrders,
    };
    kitchen = { waiting, ready, totalOpen: waiting + ready };

    const closing = await getDailyClosing(store.id);
    sales = {
      businessDate: closing.businessDate,
      salesCount: closing.salesCount,
      salesTotal: closing.salesTotal,
      netTotal: closing.netTotal,
      customerCount: closing.customerCount,
      openOrderCount: closing.openOrderCount,
    };
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
    /* table may not exist yet on old DBs */
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
    printer: {
      supported: isPrinterSupported(),
      ip: printerIp,
      reachable: printerReachable,
    },
    heartbeat: heartbeatMeta,
  };
}

/** クラウド側: 直近の心拍をモニター用スナップショットに変換 */
export async function buildHeartbeatOpsSnapshot(): Promise<OpsSnapshot | null> {
  const hb = await prisma.opsHeartbeat.findUnique({ where: { id: "shop" } });
  if (!hb) return null;
  const payload = hb.payload as Partial<OpsSnapshot>;
  const age = Math.round((Date.now() - hb.receivedAt.getTime()) / 1000);
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
    printer: payload.printer ?? { supported: true, ip: null, reachable: null },
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
