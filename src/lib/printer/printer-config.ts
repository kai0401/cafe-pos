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
  storeName: "喫茶店",
};

const CONFIG_PATH = path.join(process.cwd(), "printer-config.json");

export function loadPrinterConfig(): PrinterConfig {
  if (!isPrinterSupported()) {
    return { ...DEFAULT_CONFIG, ip: "" };
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
