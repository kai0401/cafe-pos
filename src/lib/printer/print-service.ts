import net from "net";
import { spawn } from "child_process";
import { existsSync } from "fs";
import { EscPosBuilder, dashHr, hr, padLine, textWidth } from "./escpos";
import { isPrintAgentMode, loadPrinterConfig, type PrinterConfig } from "./printer-config";
import { formatYen } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export type PrintJobKind = "kitchen" | "receipt" | "bill" | "closing" | "test" | "print";

/** クラウド運用：印刷データをキューに入れ、店舗 Mac の印刷エージェントに任せる */
export async function enqueuePrintJob(data: Buffer, kind: PrintJobKind = "print"): Promise<string> {
  const job = await prisma.printJob.create({
    data: { kind, data: new Uint8Array(data) },
    select: { id: true },
  });
  return job.id;
}

const TIMEOUT_MS = 5000;
const NC_BIN = "/usr/bin/nc";

/**
 * macOS の「ローカルネットワーク」プライバシー制限で node の直接接続が
 * EHOSTUNREACH になる場合に、Apple 製 nc 経由で送信するフォールバック。
 */
function sendViaNc(data: Buffer, ip: string, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(NC_BIN, ["-w", "5", ip, String(port)], { stdio: ["pipe", "ignore", "pipe"] });
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`プリンター(${ip}:${port})に接続できません(nc timeout)`));
    }, TIMEOUT_MS + 3000);
    child.stderr?.on("data", (d) => (stderr += String(d)));
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`印刷エラー(nc): ${err.message}`));
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`印刷エラー(nc exit ${code}): ${stderr.trim()}`));
    });
    child.stdin.on("error", () => {
      // exit ハンドラで処理
    });
    child.stdin.end(data);
  });
}

function isLocalNetworkDenied(err: Error): boolean {
  return /EHOSTUNREACH|ENETUNREACH|EPERM/.test(err.message);
}

/** RAW (port 9100) で TM-m30 にデータを送信 */
export async function sendToPrinter(
  data: Buffer,
  config?: PrinterConfig,
  kind: PrintJobKind = "print",
): Promise<void> {
  const cfg = config ?? loadPrinterConfig();
  if (!cfg.ip) {
    throw new Error("プリンターのIPアドレスが未設定です");
  }
  if (isPrintAgentMode(cfg)) {
    await enqueuePrintJob(data, kind);
    return;
  }
  try {
    await sendDirect(data, cfg);
  } catch (err) {
    if (err instanceof Error && isLocalNetworkDenied(err) && process.platform === "darwin" && existsSync(NC_BIN)) {
      console.warn(`[printer] 直接接続が拒否されました(${err.message}) → nc 経由で再送`);
      await sendViaNc(data, cfg.ip, cfg.port);
      return;
    }
    throw err;
  }
}

function sendDirect(data: Buffer, cfg: PrinterConfig): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`プリンター(${cfg.ip}:${cfg.port})に接続できません`));
    }, TIMEOUT_MS);

    socket.connect(cfg.port, cfg.ip, () => {
      socket.write(data, () => {
        socket.end();
      });
    });
    socket.on("close", () => {
      clearTimeout(timer);
      resolve();
    });
    socket.on("error", (err) => {
      clearTimeout(timer);
      socket.destroy();
      reject(new Error(`印刷エラー: ${err.message}`));
    });
  });
}

function ticketDateTime(at?: Date | string): string {
  const d = at ? new Date(at) : new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const g = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")} ${g("hour")}:${g("minute")}:${g("second")}`;
}

function includedTax(amount: number): number {
  return Math.floor((amount * 10) / 110);
}

function typeLabel(eatInType: string): string {
  return eatInType === "TAKEOUT" ? "テイクアウト" : "イートイン";
}

function reverseBanner(b: EscPosBuilder, label: string, cols: number): void {
  const pad = Math.max(0, cols - textWidth(label));
  const left = Math.floor(pad / 2);
  const right = pad - left;
  b.align(0)
    .size(1, 2)
    .reverse(true)
    .bold(true)
    .line(`${" ".repeat(left)}${label}${" ".repeat(right)}`)
    .bold(false)
    .reverse(false)
    .size(1, 1);
}

function printItemLine(
  b: EscPosBuilder,
  name: string,
  quantity: number,
  unitPrice: number,
  lineTotal: number,
  note: string | null,
  cols: number,
): void {
  const left = `□ ${name}`;
  const right = `@${unitPrice.toLocaleString("ja-JP")} x ${quantity}  ${formatYen(lineTotal)}`;
  if (textWidth(left) + 1 + textWidth(right) <= cols) {
    b.line(padLine(left, right, cols));
  } else {
    b.line(left);
    b.line(padLine("", right, cols));
  }
  if (note) b.line(`  ※ ${note}`);
}

function selfCheckoutQrPayload(orderNumber: string): string {
  // セルフレジ未使用。端末連携時にこの文字列を差し替える
  return `POS:${orderNumber}`;
}

export type KitchenTicketData = {
  tableName: string;
  eatInType: string;
  orderNumber: string;
  customerCount: number;
  staffName?: string | null;
  reprint?: boolean;
  items: { name: string; quantity: number; unitPrice: number; lineTotal: number; note: string | null }[];
};

/** 注文伝票（キッチン送信時・スマレジ風） */
export function buildKitchenTicket(data: KitchenTicketData, cols = 48): Buffer {
  const b = new EscPosBuilder().init();
  const subtotal = data.items.reduce((s, i) => s + i.lineTotal, 0);
  const itemCount = data.items.reduce((s, i) => s + i.quantity, 0);
  const staff = data.staffName?.trim() || "—";

  if (data.reprint) reverseBanner(b, "再発行", cols);

  b.align(0).size(2, 2).bold(true).line(`${typeLabel(data.eatInType)} : ${data.tableName}`).bold(false).size(1, 1);
  b.line(padLine(`スタッフ：${staff}`, ticketDateTime(), cols));
  b.line(padLine("", `${data.customerCount}人`, cols));
  b.line(dashHr(cols));

  for (const item of data.items) {
    printItemLine(b, item.name, item.quantity, item.unitPrice, item.lineTotal, item.note, cols);
  }

  b.line(dashHr(cols));
  b.line(padLine("小計", formatYen(subtotal), cols));
  b.size(1, 2).bold(true).line(padLine("合計金額", formatYen(subtotal), cols)).bold(false).size(1, 1);
  b.line(padLine("内消費税", `(${formatYen(includedTax(subtotal))})`, cols));
  b.line(padLine("合計点数", `${itemCount}点`, cols));
  b.line(hr(cols));
  b.align(1).qr(selfCheckoutQrPayload(data.orderNumber), 6).feed(1);
  b.cut();
  return b.build();
}

export type ReceiptData = {
  storeName: string;
  invoiceRegNumber?: string | null;
  tableName: string;
  orderNumber: string;
  customerCount: number;
  items: { name: string; quantity: number; unitPrice: number }[];
  subtotalAmount?: number;
  discountAmount?: number;
  totalAmount: number;
  taxAmount: number;
  paymentLabel: string;
  tendered?: number;
  change?: number;
};

/** レシート（会計時） */
export function buildReceipt(data: ReceiptData, cols = 48): Buffer {
  const b = new EscPosBuilder().init();

  b.align(1).size(2, 2).bold(true).line(data.storeName).bold(false).size(1, 1);
  if (data.invoiceRegNumber) b.line(`登録番号: ${data.invoiceRegNumber}`);
  b.line("領収書");
  b.line(ticketDateTime());
  b.align(0).line(hr(cols));
  b.line(`テーブル: ${data.tableName}  ${data.customerCount}人`);
  b.line(`注文No: ${data.orderNumber}`);
  b.line(hr(cols));

  for (const item of data.items) {
    const label = item.quantity > 1 ? `${item.name} x${item.quantity}` : item.name;
    b.line(padLine(label, formatYen(item.unitPrice * item.quantity), cols));
  }

  b.line(hr(cols));
  if (data.discountAmount && data.discountAmount > 0) {
    b.line(padLine("小計", formatYen(data.subtotalAmount ?? data.totalAmount + data.discountAmount), cols));
    b.line(padLine("値引き", `-${formatYen(data.discountAmount)}`, cols));
  }
  b.size(1, 2).bold(true).line(padLine("合計", formatYen(data.totalAmount), cols)).bold(false).size(1, 1);
  b.line(padLine("内消費税", `(${formatYen(data.taxAmount)})`, cols));
  b.line(padLine(`お支払い(${data.paymentLabel})`, formatYen(data.tendered ?? data.totalAmount), cols));
  if (data.change != null && data.change > 0) {
    b.line(padLine("お釣り", formatYen(data.change), cols));
  }

  b.line(hr(cols));
  b.align(1).line("ご来店ありがとうございました");
  b.feed(3).cut();
  return b.build();
}

export type ClosingReportData = {
  storeName: string;
  businessDate: string;
  salesCount: number;
  salesTotal: number;
  refundCount: number;
  refundTotal: number;
  netTotal: number;
  customerCount: number;
  avgSpend: number;
  payments: { label: string; amount: number }[];
  discountTotal: number;
  taxTotal: number;
};

/** 日次締めレポート */
export function buildClosingReport(data: ClosingReportData, cols = 48): Buffer {
  const b = new EscPosBuilder().init();

  b.align(1).size(1, 2).bold(true).line("＜日次締めレポート＞").bold(false).size(1, 1);
  b.line(data.storeName);
  b.line(`営業日: ${data.businessDate}`);
  b.line(`発行: ${ticketDateTime()}`);
  b.align(0).line(hr(cols));

  b.line(padLine("売上件数", `${data.salesCount}件`, cols));
  b.size(1, 2).bold(true).line(padLine("売上合計", formatYen(data.salesTotal), cols)).bold(false).size(1, 1);
  if (data.refundCount > 0) {
    b.line(padLine("返金件数", `${data.refundCount}件`, cols));
    b.line(padLine("返金合計", `-${formatYen(Math.abs(data.refundTotal))}`, cols));
    b.bold(true).line(padLine("純売上", formatYen(data.netTotal), cols)).bold(false);
  }
  b.line(padLine("値引き合計", formatYen(data.discountTotal), cols));
  b.line(padLine("内消費税", `(${formatYen(data.taxTotal)})`, cols));
  b.line(hr(cols));

  b.line(padLine("客数", `${data.customerCount}名`, cols));
  b.line(padLine("客単価", formatYen(data.avgSpend), cols));
  b.line(hr(cols));

  b.line("支払い方法別");
  for (const p of data.payments) {
    b.line(padLine(`  ${p.label}`, formatYen(p.amount), cols));
  }

  b.line(hr(cols));
  b.feed(3).cut();
  return b.build();
}

export type BillData = {
  storeName: string;
  tableName: string;
  eatInType?: string;
  staffName?: string | null;
  orderNumber: string;
  customerCount: number;
  items: { name: string; quantity: number; unitPrice: number; note?: string | null }[];
  totalAmount: number;
  reprint?: boolean;
};

/** お会計伝票（会計前の明細・注文伝票と同じ体裁） */
export function buildBill(data: BillData, cols = 48): Buffer {
  return buildKitchenTicket(
    {
      tableName: data.tableName,
      eatInType: data.eatInType ?? "DINE_IN",
      orderNumber: data.orderNumber,
      customerCount: data.customerCount,
      staffName: data.staffName,
      reprint: data.reprint ?? true,
      items: data.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.unitPrice * item.quantity,
        note: item.note ?? null,
      })),
    },
    cols,
  );
}

/** テスト印刷（本番伝票と同じレイアウト） */
export function buildTestPrint(cols = 48): Buffer {
  return buildKitchenTicket(
    {
      tableName: "T8",
      eatInType: "DINE_IN",
      orderNumber: "TEST",
      customerCount: 1,
      staffName: "そう",
      reprint: true,
      items: [
        { name: "コーヒー", quantity: 1, unitPrice: 550, lineTotal: 550, note: null },
        { name: "クリームあんみつ", quantity: 1, unitPrice: 900, lineTotal: 900, note: null },
      ],
    },
    cols,
  );
}

export function buildDrawerKick(): Buffer {
  return new EscPosBuilder().kickDrawer().build();
}
