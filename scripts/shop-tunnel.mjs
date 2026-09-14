#!/usr/bin/env node
/**
 * 店舗サーバーを HTTPS で公開 — お客様QRは携帯回線から接続。
 * ウェイター / キッチンはお店の Wi-Fi（LAN）を使う。
 * Pi: systemd cafe-pos-tunnel
 *
 * 印刷QRは PUBLIC_BASE_URL（Vercel固定）。クラウドがトンネルURLへ転送する。
 */
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
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

async function loadEnvFile() {
  try {
    const raw = await readFile(path.join(root, ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)="?([^"\n]*)"?\s*$/);
      if (!m) continue;
      if (!process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    // ignore
  }
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

async function pushHeartbeatSoon(port) {
  const cloudUrl = (process.env.OPS_CLOUD_URL || "").replace(/\/$/, "");
  const key = process.env.OPS_HEARTBEAT_KEY || "";
  if (!cloudUrl || !key || key.length < 8) return;
  try {
    await new Promise((r) => setTimeout(r, 800));
    const snapRes = await fetch(`http://127.0.0.1:${port}/api/ops/snapshot`, {
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
      body: JSON.stringify({ ...snapshot, source: "pi-tunnel" }),
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) console.log(`[tunnel] 心拍更新 OK → ${cloudUrl}`);
    else console.warn(`[tunnel] 心拍更新失敗 HTTP ${res.status}`);
  } catch (err) {
    console.warn(`[tunnel] 心拍更新エラー: ${err?.message ?? err}`);
  }
}

function spawnCloudflared(port) {
  const bin = process.env.CLOUDFLARED_BIN || "cloudflared";
  const args = ["tunnel", "--no-autoupdate", "--url", `http://127.0.0.1:${port}`];
  try {
    return spawn(bin, args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
  } catch {
    return spawn(
      "npx",
      ["--yes", "cloudflared", "tunnel", "--no-autoupdate", "--url", `http://127.0.0.1:${port}`],
      { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
    );
  }
}

async function startTunnel(port) {
  await mkdir(logDir, { recursive: true });
  await writeFile(logFile, "");

  return new Promise((resolve, reject) => {
    let tunnel = spawnCloudflared(port);
    let buf = "";
    let resolved = false;
    let usedNpxFallback = false;

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

    const attach = (child) => {
      child.stdout?.on("data", onData);
      child.stderr?.on("data", onData);
      child.on("exit", (code) => {
        if (!resolved) {
          if (!usedNpxFallback && code !== 0) {
            usedNpxFallback = true;
            buf = "";
            tunnel = spawn(
              "npx",
              [
                "--yes",
                "cloudflared",
                "tunnel",
                "--no-autoupdate",
                "--url",
                `http://127.0.0.1:${port}`,
              ],
              { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
            );
            attach(tunnel);
            return;
          }
          reject(new Error(`cloudflared exited (${code})`));
        }
      });
    };

    attach(tunnel);

    setTimeout(() => {
      if (!resolved) {
        try {
          tunnel.kill();
        } catch {
          /* ignore */
        }
        reject(new Error("トンネル URL の取得がタイムアウトしました"));
      }
    }, 120_000);
  });
}

async function main() {
  await loadEnvFile();
  const port = await detectPort();

  console.log("\nCafe POS — お客様QR用 HTTPS トンネル（Pi）\n");
  console.log(`店舗サーバー (127.0.0.1:${port}) を待機中…`);

  const ready = await waitForServer(port);
  if (!ready) {
    console.error("店舗サーバーが起動していません。先に cafe-pos-shop を起動してください。");
    process.exit(1);
  }

  console.log("HTTPS トンネルを起動中…\n");

  while (true) {
    try {
      const { tunnel, url } = await startTunnel(port);
      await saveRemoteUrl(url);
      void pushHeartbeatSoon(port);

      console.log("お客様（携帯回線）:");
      console.log(`  印刷QR入口: ${process.env.PUBLIC_BASE_URL || "(PUBLIC_BASE_URL未設定)"}/qr/...`);
      console.log(`  トンネル先: ${url}/qr/...`);
      console.log("ウェイター / キッチンは LAN URL のまま。\n");

      await new Promise((resolve) => {
        tunnel.on("exit", () => resolve());
      });
    } catch (err) {
      console.error(err.message ?? err);
    }

    console.log("トンネル再接続中… (8秒)");
    await new Promise((r) => setTimeout(r, 8_000));

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
