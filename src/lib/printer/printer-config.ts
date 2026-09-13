import fs from "fs";
import path from "path";
import { isPrinterSupported } from "@/lib/runtime-config";

export type PrinterConfig = {
  /** TM-m30 の IPアドレス（例: 192.168.1.50） */
  ip: string;
  /** RAW印刷ポート（TM-m30 デフォルト 9100） */
  port: number;
  /** 注文送信時にキッチン伝票を自動印刷 */
  printKitchenTicket: boolean;
  /** 会計時にレシートを自動印刷 */
  printReceipt: boolean;
  /** 現金会計時にキャッシュドロワーを開く */
  kickDrawer: boolean;
  /** 用紙幅の桁数（80mm=48, 58mm=32） */
  cols: number;
  /** レシートに印字する店名 */
  storeName: string;
};

export const DEFAULT_CONFIG: PrinterConfig = {
  ip: "",
  port: 9100,
  printKitchenTicket: true,
  printReceipt: true,
  kickDrawer: true,
  cols: 48,
  storeName: "あづま家",
};

const CONFIG_PATH = path.join(process.cwd(), "printer-config.json");

/**
 * クラウド運用時の疑似 IP。これが設定されていると sendToPrinter は
 * 直接送信せず印刷キュー（PrintJob）に入れ、店舗 Mac の印刷エージェントが印刷する。
 */
export const PRINT_AGENT_IP = "agent";

export function isPrintAgentMode(config: Pick<PrinterConfig, "ip">): boolean {
  return config.ip === PRINT_AGENT_IP;
}

/** クラウドで印刷キューを使うか（PRINT_AGENT_ENABLED=0 で無効） */
export function isPrintAgentEnabled(): boolean {
  return process.env.PRINT_AGENT_ENABLED !== "0";
}

function envBool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  return v === "1" || v.toLowerCase() === "true";
}

export function loadPrinterConfig(): PrinterConfig {
  if (!isPrinterSupported()) {
    if (!isPrintAgentEnabled()) {
      return { ...DEFAULT_CONFIG, ip: "" };
    }
    return {
      ...DEFAULT_CONFIG,
      ip: PRINT_AGENT_IP,
      printKitchenTicket: envBool("PRINT_KITCHEN_TICKET", DEFAULT_CONFIG.printKitchenTicket),
      printReceipt: envBool("PRINT_RECEIPT", DEFAULT_CONFIG.printReceipt),
      kickDrawer: envBool("PRINT_KICK_DRAWER", DEFAULT_CONFIG.kickDrawer),
      cols: Number(process.env.PRINT_COLS ?? DEFAULT_CONFIG.cols) || DEFAULT_CONFIG.cols,
      storeName: process.env.PRINT_STORE_NAME || DEFAULT_CONFIG.storeName,
    };
  }
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function savePrinterConfig(config: Partial<PrinterConfig>): PrinterConfig {
  const cleaned = Object.fromEntries(
    Object.entries(config).filter(([, v]) => v !== undefined),
  );
  const merged = { ...loadPrinterConfig(), ...cleaned };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2), "utf8");
  return merged;
}
