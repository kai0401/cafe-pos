/**
 * クラウド本番（Vercel / Render 等のホスティング）かどうか。
 * 以前は「DATABASE_URL が postgresql ならクラウド」と判定していたが、
 * 店舗 Mac でもローカル Postgres を使うため、ホスティング環境変数で判定する。
 * （CLOUD_RUNTIME=1 で明示的にクラウド扱いにもできる）
 */
export function isCloudRuntime(): boolean {
  if (process.env.CLOUD_RUNTIME === "1") return true;
  if (process.env.VERCEL === "1") return true;
  if (process.env.RENDER === "true" || process.env.RENDER === "1") return true;
  return false;
}

/** TM-m30 は LAN 直結のため、クラウドサーバーからは印刷不可（店舗 Mac サーバーなら可） */
export function isPrinterSupported(): boolean {
  return !isCloudRuntime();
}

export function runtimeModeLabel(): "cloud" | "local" {
  return isCloudRuntime() ? "cloud" : "local";
}
