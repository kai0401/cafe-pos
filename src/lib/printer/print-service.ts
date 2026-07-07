import net from "net";
import { EscPosBuilder, hr, padLine } from "./escpos";
import { loadPrinterConfig, type PrinterConfig } from "./printer-config";
import { formatOrderItemNote } from "@/lib/order-modifiers";
import { formatYen } from "@/lib/format";

const TIMEOUT_MS = 5000;

/** RAW (port 9100) で TM-m30 にデータを送信 */
export function sendToPrinter(data: Buffer, config?: PrinterConfig): Promise<void> {
  const cfg = config ?? loadPrinterConfig();
  if (!cfg.ip) {
    return Promise.reject(new Error("プリンターのIPアドレスが未設定です"));
  }

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

function nowJst(): string {
  return new Date().toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export type KitchenTicketData = {
  tableName: string;
  eatInType: string;
  orderNumber: string;
  customerCount: number;
  items: { name: string; quantity: number; note: string | null }[];
};

/** キッチン伝票（注文送信時） */
export function buildKitchenTicket(data: KitchenTicketData, cols = 48): Buffer {
  const b = new EscPosBuilder().init();
  const typeLabel = data.eatInType === "TAKEOUT" ? "テイクアウト" : "イートイン";

  b.align(1).size(1, 2).bold(true).line("＜注文伝票＞").bold(false).size(1, 1);
  b.line(nowJst());
  b.align(0).line(hr(cols));
  b.size(2, 2).bold(true).line(`${typeLabel} ${data.tableName}`).bold(false).size(1, 1);
  b.line(`注文No: ${data.orderNumber}  ${data.customerCount}名`);
  b.line(hr(cols));

  for (const item of data.items) {
    b.size(1, 2).line(padLine(item.name, `x${item.quantity}`, cols)).size(1, 1);
    const label = formatOrderItemNote(item.note);
    if (label) b.line(`  ※ ${label}`);
  }

  b.line(hr(cols));
  b.feed(3).cut();
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
  b.line(nowJst());
  b.align(0).line(hr(cols));
  b.line(`テーブル: ${data.tableName}  ${data.customerCount}名`);
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
  b.line(padLine("(内消費税10%", `${formatYen(data.taxAmount)})`, cols));
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
  b.line(`発行: ${nowJst()}`);
  b.align(0).line(hr(cols));

  b.line(padLine("売上件数", `${data.salesCount}件`, cols));
  b.size(1, 2).bold(true).line(padLine("売上合計", formatYen(data.salesTotal), cols)).bold(false).size(1, 1);
  if (data.refundCount > 0) {
    b.line(padLine("返金件数", `${data.refundCount}件`, cols));
    b.line(padLine("返金合計", `-${formatYen(Math.abs(data.refundTotal))}`, cols));
    b.bold(true).line(padLine("純売上", formatYen(data.netTotal), cols)).bold(false);
  }
  b.line(padLine("値引き合計", formatYen(data.discountTotal), cols));
  b.line(padLine("(内消費税10%", `${formatYen(data.taxTotal)})`, cols));
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
  orderNumber: string;
  customerCount: number;
  items: { name: string; quantity: number; unitPrice: number }[];
  totalAmount: number;
};

/** お会計伝票（会計前の明細） */
export function buildBill(data: BillData, cols = 48): Buffer {
  const b = new EscPosBuilder().init();

  b.align(1).size(1, 2).bold(true).line("お会計伝票").bold(false).size(1, 1);
  b.line(data.storeName);
  b.line(nowJst());
  b.align(0).line(hr(cols));
  b.line(`テーブル: ${data.tableName}  ${data.customerCount}名`);
  b.line(`注文No: ${data.orderNumber}`);
  b.line(hr(cols));

  for (const item of data.items) {
    const label = item.quantity > 1 ? `${item.name} x${item.quantity}` : item.name;
    b.line(padLine(label, formatYen(item.unitPrice * item.quantity), cols));
  }

  b.line(hr(cols));
  b.size(1, 2).bold(true).line(padLine("合計(税込)", formatYen(data.totalAmount), cols)).bold(false).size(1, 1);
  b.line(hr(cols));
  b.feed(3).cut();
  return b.build();
}

/** テスト印刷 */
export function buildTestPrint(cols = 48): Buffer {
  const b = new EscPosBuilder().init();
  b.align(1).size(1, 2).bold(true).line("テスト印刷").bold(false).size(1, 1);
  b.line(nowJst());
  b.align(0).line(hr(cols));
  b.line("日本語テスト: あんみつ ソフトクリーム");
  b.line(padLine("左寄せ", "右寄せ", cols));
  b.line(hr(cols));
  b.align(1).line("印刷設定は正常です");
  b.feed(3).cut();
  return b.build();
}

export function buildDrawerKick(): Buffer {
  return new EscPosBuilder().kickDrawer().build();
}
