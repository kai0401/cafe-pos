#!/usr/bin/env node
/**
 * 店舗用常駐サーバー — Mac 起動時に自動起動し、iPhone から常時アクセス可能にする。
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

async function findPort(preferred) {
  for (let p = preferred; p < preferred + 20; p++) {
    if (await isPortFree(p)) return p;
  }
  throw new Error(`ポート ${preferred}〜${preferred + 19} がすべて使用中です`);
}

async function readEnvConfig() {
  try {
    const env = await readFile(path.join(root, ".env"), "utf8");
    const urlMatch = env.match(/^PUBLIC_BASE_URL="?([^"\n]+)"?/m);
    if (urlMatch) {
      const baseUrl = urlMatch[1].replace(/\/$/, "");
      const portMatch = baseUrl.match(/:(\d+)$/);
      return {
        baseUrl,
        port: portMatch ? Number(portMatch[1]) : Number(process.env.PORT ?? 3001),
      };
    }
  } catch {
    // ignore
  }
  const preferred = Number(process.env.PORT ?? 3001);
  const port = await findPort(preferred);
  const ip = getLanIp();
  return { baseUrl: ip ? `http://${ip}:${port}` : `http://localhost:${port}`, port };
}

async function main() {
  const nextDir = path.join(root, ".next");

  if (!existsSync(nextDir)) {
    console.error("\n✗ .next がありません。先に npm run build を実行してください。\n");
    process.exit(1);
  }

  const { baseUrl, port: configuredPort } = await readEnvConfig();
  let port = configuredPort;
  if (!(await isPortFree(port))) {
    const alt = await findPort(port + 1);
    console.warn(`\n⚠  ポート ${port} は使用中 → ${alt} で起動（PUBLIC_BASE_URL と不一致の可能性）\n`);
    port = alt;
  }

  const ip = getLanIp();

  console.log("\n🏪 Cafe POS — 店舗サーバー（常駐）\n");
  if (port !== configuredPort) {
    console.log(`⚠  設定ポート ${configuredPort} と実際のポート ${port} が異なります\n`);
  }
  console.log("📱 iPhone（同じ Wi‑Fi）:");
  console.log(`   ${baseUrl}/waiter/tables`);
  console.log(`   ${baseUrl}/waiter/open  ← 接続確認`);
  console.log("🍳 iPad キッチン:");
  console.log(`   ${baseUrl}/kitchen/open  ← 接続確認`);
  console.log(`   ${baseUrl}/kitchen/connect ← QR・URL\n`);
  console.log("停止: Ctrl+C\n");

  spawn("npx", ["next", "start", "-H", "0.0.0.0", "-p", String(port)], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, PORT: String(port) },
  });
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
