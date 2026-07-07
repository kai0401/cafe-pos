/** 本番は Vercel + PostgreSQL（店舗に Mac 不要） */
export function isCloudRuntime(): boolean {
  if (process.env.VERCEL === "1") return true;
  const url = process.env.DATABASE_URL ?? "";
  return url.startsWith("postgresql://") || url.startsWith("postgres://");
}

/** TM-m30 は LAN 直結のためクラウドサーバーからは印刷不可 */
export function isPrinterSupported(): boolean {
  return !isCloudRuntime();
}

export function runtimeModeLabel(): "cloud" | "local" {
  return isCloudRuntime() ? "cloud" : "local";
}
