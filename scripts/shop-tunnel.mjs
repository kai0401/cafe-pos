#!/usr/bin/env node
/**
 * 店舗サーバーを HTTPS で公開 — お客様QR・管理画面は携帯回線から接続。
 * ウェイター / キッチンはお店の Wi-Fi（LAN）を使う。
 * Mac 常駐（launchd）で動かす想定。
 */
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const logDir = path.join(root, ".preview-logs");
const logFile = path.join(logDir, "shop-tunnel.log");
const remoteFile = path.join(root, ".shop-remote-url.json");

function isPortListening(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

async function detectPort() {
  const preferred = Number(process.env.PORT ?? 3000);
  const candidates = [...new Set([preferred, 3000, 3001, 3002])];
  for (const port of candidates) {
    if (await isPortListening(port)) return port;
  }
  return preferred;
}

async function saveRemoteUrl(url) {
  const payload = { url, updatedAt: new Date().toISOString() };
  await writeFile(remoteFile, JSON.stringify(payload, null, 2));
}

function extractTunnelUrl(text) {
  const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  return match ? match[0] : null;
}

async function waitForServer(port) {
  for (let i = 0; i < 120; i++) {
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

async function startTunnel(port) {
  await mkdir(logDir, { recursive: true });
  await writeFile(logFile, "");

  return new Promise((resolve, reject) => {
    const tunnel = spawn(
      "npx",
      ["--yes", "cloudflared", "tunnel", "--url", `http://127.0.0.1:${port}`],
      { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
    );

    let buf = "";
    let resolved = false;
    const onData = async (chunk) => {
      const text = chunk.toString();
      buf += text;
      await appendFile(logFile, text).catch(() => {});

      const url = extractTunnelUrl(buf);
      if (url && !resolved) {
        resolved = true;
        resolve({ tunnel, url });
      }
    };

    tunnel.stdout?.on("data", onData);
    tunnel.stderr?.on("data", onData);

    tunnel.on("exit", (code) => {
      if (!extractTunnelUrl(buf)) {
        reject(new Error(`cloudflared exited (${code})`));
      }
    });

    setTimeout(() => {
      if (!extractTunnelUrl(buf)) {
        tunnel.kill();
        reject(new Error("トンネル URL の取得がタイムアウトしました"));
      }
    }, 120_000);
  });
}

async function main() {
  const port = await detectPort();

  console.log("\nCafe POS — お客様・管理画面用 HTTPS トンネル\n");
  console.log(`店舗サーバー (127.0.0.1:${port}) を待機中…`);

  const ready = await waitForServer(port);
  if (!ready) {
    console.error("店舗サーバーが起動していません。先に店内サーバーを起動してください。");
    process.exit(1);
  }

  console.log("HTTPS トンネルを起動中…\n");

  while (true) {
    try {
      const { tunnel, url } = await startTunnel(port);
      await saveRemoteUrl(url);

      console.log("お客様（携帯回線）と管理画面（外出先）:\n");
      console.log(`  QR:    ${url}/qr/...`);
      console.log(`  管理:  ${url}/admin`);
      console.log("\nウェイター / キッチンはお店の Wi-Fi の LAN URL を使ってください。\n");
      console.log("（Mac 再起動後は公開URLが変わることがあります。管理画面の QR ページで確認）\n");

      await new Promise((resolve) => {
        tunnel.on("exit", () => resolve());
      });
    } catch (err) {
      console.error(err.message ?? err);
    }

    console.log("トンネル再接続中… (10秒)");
    await new Promise((r) => setTimeout(r, 10_000));

    if (!(await isPortListening(port))) {
      console.error("店舗サーバーが停止しました。トンネルも終了します。");
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
