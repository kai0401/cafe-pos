#!/usr/bin/env node
/**
 * 開発中のスマホ接続用 — cloudflared で HTTPS 公開 URL を発行。
 * Wi‑Fi が違っても、LTE からでも開けます。
 */
import { spawn } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const logDir = path.join(root, ".preview-logs");
const logFile = path.join(logDir, "dev-tunnel.log");

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

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, "0.0.0.0");
  });
}

async function findPort(start) {
  for (let p = start; p < start + 20; p++) {
    if (await isPortFree(p)) return p;
  }
  throw new Error("空きポートがありません");
}

async function waitForTunnelUrl() {
  for (let i = 0; i < 90; i++) {
    try {
      const text = await readFile(logFile, "utf8");
      const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (match) return match[0];
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return null;
}

async function waitForServer(port) {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (res.ok) return true;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function main() {
  await mkdir(logDir, { recursive: true });

  const preferred = Number(process.env.PORT ?? 3000);
  const port = await findPort(preferred);
  const ip = getLanIp();

  console.log("\n🚀 Cafe POS — スマホ接続モード\n");

  if (port !== preferred) {
    console.log(`⚠  ポート ${preferred} は使用中 → ${port} で起動\n`);
  }

  const dev = spawn("npx", ["next", "dev", "-H", "0.0.0.0", "-p", String(port)], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, PORT: String(port) },
  });

  const ready = await waitForServer(port);
  if (!ready) {
    console.error("サーバーが起動しませんでした");
    dev.kill();
    process.exit(1);
  }

  if (ip) {
    console.log("📶 同じ Wi‑Fi（LAN）:");
    console.log(`   http://${ip}:${port}/waiter/open\n`);
  }

  console.log("🌐 公開 URL（HTTPS）を取得中…\n");

  const tunnel = spawn(
    "npx",
    ["--yes", "cloudflared", "tunnel", "--url", `http://127.0.0.1:${port}`],
    { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
  );

  let log = "";
  tunnel.stdout?.on("data", (d) => {
    log += d.toString();
  });
  tunnel.stderr?.on("data", (d) => {
    log += d.toString();
  });
  const flushLog = setInterval(async () => {
    if (log) {
      const { writeFile, appendFile } = await import("node:fs/promises");
      await appendFile(logFile, log).catch(() => writeFile(logFile, log));
      log = "";
    }
  }, 500);

  const publicUrl = await waitForTunnelUrl();
  clearInterval(flushLog);

  if (!publicUrl) {
    console.error("公開 URL を取得できませんでした。cloudflared を確認してください。");
    console.error(`ログ: ${logFile}`);
    process.exit(1);
  }

  console.log("✅ スマホでこの URL を Safari で開いてください:\n");
  console.log(`   ${publicUrl}/waiter/open\n`);
  console.log("   → 接続 OK なら「テーブル一覧を開く」");
  console.log("   → 共有 → ホーム画面に追加 でアプリ化\n");
  console.log("（Ctrl+C で停止）\n");

  process.on("SIGINT", () => {
    tunnel.kill();
    dev.kill();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
