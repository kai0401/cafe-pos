#!/usr/bin/env node
/**
 * 店舗サーバーを HTTPS で全世界公開 — LTE・外出先からも接続可。
 * Mac 常駐（launchd）で動かす想定。
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
const envFile = path.join(root, ".env");

function readPortFromEnv(text) {
  const base = text.match(/^PUBLIC_BASE_URL="?([^"\n]+)"?/m)?.[1];
  if (base) {
    const m = base.match(/:(\d+)$/);
    if (m) return Number(m[1]);
  }
  return Number(process.env.PORT ?? 3001);
}

async function readEnv() {
  try {
    return await readFile(envFile, "utf8");
  } catch {
    return 'DATABASE_URL="file:./dev.db"\n';
  }
}

async function updatePublicBaseUrl(url) {
  let env = await readEnv();
  const line = `PUBLIC_BASE_URL="${url}"`;
  if (/^PUBLIC_BASE_URL=/m.test(env)) {
    env = env.replace(/^PUBLIC_BASE_URL=.*$/m, line);
  } else {
    env = env.trimEnd() + `\n${line}\n`;
  }
  await writeFile(envFile, env);
}

async function saveRemoteUrl(url) {
  const payload = { url, updatedAt: new Date().toISOString() };
  await writeFile(remoteFile, JSON.stringify(payload, null, 2));
  await updatePublicBaseUrl(url);
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
    const onData = async (chunk) => {
      const text = chunk.toString();
      buf += text;
      await appendFile(logFile, text).catch(() => {});

      const url = extractTunnelUrl(buf);
      if (url) {
        tunnel.stdout?.off("data", onData);
        tunnel.stderr?.off("data", onData);
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
  const env = await readEnv();
  const port = readPortFromEnv(env);

  console.log("\n🌐 Cafe POS — どこでも接続トンネル\n");
  console.log(`店舗サーバー (127.0.0.1:${port}) を待機中…`);

  const ready = await waitForServer(port);
  if (!ready) {
    console.error("店舗サーバーが起動していません。先に npm run shop:install を実行してください。");
    process.exit(1);
  }

  console.log("HTTPS トンネルを起動中…\n");

  let current = null;
  while (true) {
    try {
      const { tunnel, url } = await startTunnel(port);
      await saveRemoteUrl(url);
      current = url;

      console.log("✅ どこからでも接続できます:\n");
      console.log("  ウェイター:");
      console.log(`   ${url}/waiter/open`);
      console.log(`   ${url}/waiter/tables`);
      console.log("  キッチン:");
      console.log(`   ${url}/kitchen/open`);
      console.log(`   ${url}/kitchen/connect`);
      console.log(`   ${url}/kitchen/install  ← iPad ホーム画面に追加\n`);
      console.log("（Mac 再起動後は URL が変わる場合があります。接続ページで最新 URL を確認）\n");

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
