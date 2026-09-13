#!/usr/bin/env node
/**
 * 店舗用常駐サーバー（launchd / Terminal から起動・自動復旧）
 * - 埋め込み PostgreSQL を先に起動して待つ
 * - next start を起動し、落ちたら自動で再起動
 * - ヘルスチェックは連続失敗時のみ再起動（誤検知で落とさない）
 * - Mac のスリープを抑止（caffeinate）
 */
import { spawn } from "node:child_process";
import { existsSync, writeFileSync, unlinkSync } from "node:fs";
import { readFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT ?? 3000);
const HEALTH_INTERVAL_MS = 30_000;
const HEALTH_TIMEOUT_MS = 10_000;
/** この回数連続で失敗したときだけ next を再起動 */
const HEALTH_FAIL_LIMIT = 3;
const RESTART_BACKOFF_MS = 5_000;
const DEPLOY_LOCK = path.join(root, ".preview-logs", "deploying.lock");

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function getLanIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    if (name.startsWith("lo")) continue;
    for (const iface of nets[name] ?? []) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return null;
}

function isPortOpen(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.setTimeout(800, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function waitForPort(port, timeoutMs, label) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isPortOpen(port)) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  log(`⚠ ${label} がポート ${port} で応答しません`);
  return false;
}

async function waitForPortClosed(port, timeoutMs = 15_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!(await isPortOpen(port))) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  return !(await isPortOpen(port));
}

async function readDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const env = await readFile(path.join(root, ".env"), "utf8");
    const m = env.match(/^DATABASE_URL="?([^"\n]+)"?/m);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

function parseLocalPg(url) {
  try {
    const u = new URL(url);
    const host = u.hostname;
    if (host !== "127.0.0.1" && host !== "localhost") return null;
    return { port: Number(u.port || 5432) };
  } catch {
    return null;
  }
}

let pgChild = null;
let nextChild = null;
let caffeinate = null;
let shuttingDown = false;
let healthFails = 0;
let restartingNext = false;
let lastRestartAt = 0;

async function ensureEmbeddedPg() {
  // Pi 本番などシステム PostgreSQL 利用時は埋め込みを絶対に起動しない
  if (process.env.CAFE_POS_SYSTEM_PG === "1" || process.env.CAFE_POS_SKIP_EMBEDDED === "1") {
    log("システム PostgreSQL モード（埋め込み起動なし）");
    const dbUrl = await readDatabaseUrl();
    const local = dbUrl ? parseLocalPg(dbUrl) : null;
    if (local && !(await isPortOpen(local.port))) {
      log(`⚠ PostgreSQL :${local.port} が未起動です（systemd postgresql を確認）`);
    }
    return;
  }

  const dbUrl = await readDatabaseUrl();
  const local = dbUrl ? parseLocalPg(dbUrl) : null;
  if (!local) return;

  if (await isPortOpen(local.port)) {
    log(`PostgreSQL 既に稼働中 (:${local.port})`);
    return;
  }

  log(`埋め込み PostgreSQL を起動 (:${local.port})…`);
  pgChild = spawn(process.execPath, [path.join(root, "scripts", "start-embedded-pg.mjs")], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, TEST_PG_PORT: String(local.port) },
  });
  pgChild.on("exit", (code) => {
    pgChild = null;
    if (shuttingDown) return;
    log(`⚠ PostgreSQL が終了 (code=${code}) → 5秒後に再起動`);
    setTimeout(() => void ensureEmbeddedPg(), 5000);
  });

  await waitForPort(local.port, 30000, "PostgreSQL");
}

function killProcessTree(child, signal = "SIGKILL") {
  if (!child?.pid) return;
  try {
    // プロセスグループごと落とす（next の子プロセス残りを防ぐ）
    process.kill(-child.pid, signal);
  } catch {
    try {
      child.kill(signal);
    } catch {
      // ignore
    }
  }
}

function killNext(reason) {
  const child = nextChild;
  if (!child || restartingNext) return;
  restartingNext = true;
  log(`next を停止 (${reason})`);
  // 営業中の固まり防止: すぐ SIGKILL（graceful 待ちで5秒落ちるのを避ける）
  killProcessTree(child, "SIGKILL");
  setTimeout(() => {
    restartingNext = false;
  }, 2000);
}

async function startNext() {
  if (shuttingDown) return;
  if (nextChild) return;

  // 直前の next がポートを掴んだまま残っていると起動失敗する
  if (await isPortOpen(PORT)) {
    log(`⚠ ポート ${PORT} が使用中 → 解放待ち`);
    const freed = await waitForPortClosed(PORT, 10_000);
    if (!freed) {
      log(`⚠ ポート ${PORT} が解放されないため起動を延期`);
      setTimeout(() => void startNext(), RESTART_BACKOFF_MS);
      return;
    }
  }

  const sinceLast = Date.now() - lastRestartAt;
  if (lastRestartAt && sinceLast < RESTART_BACKOFF_MS) {
    await new Promise((r) => setTimeout(r, RESTART_BACKOFF_MS - sinceLast));
  }

  log(`next start :${PORT}`);
  lastRestartAt = Date.now();
  healthFails = 0;

  nextChild = spawn(
    path.join(root, "node_modules", ".bin", "next"),
    ["start", "-H", "0.0.0.0", "-p", String(PORT)],
    {
      cwd: root,
      stdio: "inherit",
      detached: true, // プロセスグループ化（kill -pid 用）
      env: { ...process.env, PORT: String(PORT), NODE_ENV: "production" },
    },
  );

  nextChild.on("exit", (code, signal) => {
    nextChild = null;
    if (shuttingDown) return;
    log(`⚠ next が終了 (code=${code}, signal=${signal ?? "—"}) → 再起動`);
    setTimeout(() => void startNext(), RESTART_BACKOFF_MS);
  });

  await waitForPort(PORT, 20_000, "next");
}

function startCaffeinate() {
  try {
    caffeinate = spawn("caffeinate", ["-s", "-i", "-m"], { stdio: "ignore" });
    caffeinate.on("error", () => {
      caffeinate = null;
    });
  } catch {
    caffeinate = null;
  }
}

function shutdown() {
  shuttingDown = true;
  try {
    unlinkSync(DEPLOY_LOCK);
  } catch {
    // ignore
  }
  for (const c of [nextChild, pgChild, caffeinate]) {
    try {
      if (c === nextChild) killProcessTree(c, "SIGTERM");
      else c?.kill("SIGTERM");
    } catch {
      // ignore
    }
  }
  setTimeout(() => process.exit(0), 1500);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

async function checkHealth() {
  if (shuttingDown || !nextChild || restartingNext) return;

  // デプロイ／ビルド中は落とさない
  if (existsSync(DEPLOY_LOCK)) {
    healthFails = 0;
    return;
  }

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), HEALTH_TIMEOUT_MS);
    const res = await fetch(`http://127.0.0.1:${PORT}/api/health`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error(`health ${res.status}`);
    const body = await res.json().catch(() => ({}));
    if (body?.db && body.db !== "ok") throw new Error(`db ${body.db}`);
    if (healthFails > 0) log(`ヘルス復帰（連続失敗 ${healthFails} → 0）`);
    healthFails = 0;
  } catch (err) {
    healthFails += 1;
    log(`⚠ ヘルス失敗 ${healthFails}/${HEALTH_FAIL_LIMIT} (${err?.message ?? err})`);
    if (healthFails >= HEALTH_FAIL_LIMIT) {
      healthFails = 0;
      killNext("health check ×3");
    }
  }
}

async function pushOpsHeartbeat() {
  const cloudUrl = (process.env.OPS_CLOUD_URL || "").replace(/\/$/, "");
  const key = process.env.OPS_HEARTBEAT_KEY || "";
  if (!cloudUrl || !key || key.length < 8) return;
  try {
    const snapRes = await fetch(`http://127.0.0.1:${PORT}/api/ops/snapshot`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!snapRes.ok) return;
    const snapshot = await snapRes.json();
    const res = await fetch(`${cloudUrl}/api/ops/heartbeat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-ops-key": key,
      },
      body: JSON.stringify({ ...snapshot, source: "pi" }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      log(`⚠ 心拍送信失敗 HTTP ${res.status}`);
    }
  } catch (err) {
    log(`⚠ 心拍送信エラー (${err?.message ?? err})`);
  }
}

async function main() {
  if (!existsSync(path.join(root, ".next"))) {
    console.error("\n✗ .next がありません。先に npm run build を実行してください。\n");
    process.exit(1);
  }

  // 既に next が動いている場合は奪わず監視だけ、は危険なので拒否
  if (await isPortOpen(PORT)) {
    log(`⚠ ポート ${PORT} は既に使用中です。既存プロセスを止めてから起動してください。`);
    process.exit(1);
  }

  try {
    writeFileSync(path.join(root, ".preview-logs", "shop-server.pid"), String(process.pid));
  } catch {
    // ignore
  }

  startCaffeinate();
  await ensureEmbeddedPg();
  await startNext();

  const ip = getLanIp();
  const base = ip ? `http://${ip}:${PORT}` : `http://localhost:${PORT}`;
  log("🏪 Cafe POS 店舗サーバー（常駐・強化版）");
  log(`   ハブ:        ${base}/`);
  log(`   ウェイター:  ${base}/waiter/tables`);
  log(`   キッチン:    ${base}/kitchen`);
  log(`   モニター:    ${base}/monitor`);
  log(`   管理:        ${base}/admin/dashboard`);
  log(`   ヘルス:      ${HEALTH_INTERVAL_MS / 1000}秒ごと / ${HEALTH_FAIL_LIMIT}回連続失敗で再起動`);
  if (process.env.OPS_CLOUD_URL && process.env.OPS_HEARTBEAT_KEY) {
    log(`   遠隔心拍:    ${process.env.OPS_CLOUD_URL} へ60秒ごと`);
  }

  setInterval(() => void checkHealth(), HEALTH_INTERVAL_MS);
  setInterval(() => void pushOpsHeartbeat(), 60_000);
  setTimeout(() => void pushOpsHeartbeat(), 8_000);
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
