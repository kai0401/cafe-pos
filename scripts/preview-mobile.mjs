#!/usr/bin/env node
/**
 * Mobile-friendly public preview via Pinggy (no IP/password page).
 * Keeps tunnel alive while this process runs.
 *
 * Usage: npm run preview:mobile
 */
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPort = Number(process.env.PREVIEW_PORT ?? 3100);
const logDir = path.join(root, ".preview-logs");
const logFile = path.join(logDir, "pinggy.log");
const CHECK_MS = 45_000;

async function checkLocal() {
  try {
    const res = await fetch(`http://127.0.0.1:${appPort}/waiter/tables`, {
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function extractUrls(text) {
  return [...text.matchAll(/https:\/\/[a-z0-9-]+\.(?:pinggy-free\.link|free\.pinggy\.net)/gi)].map(
    (m) => m[0],
  );
}

async function writePreview(publicUrl) {
  const preview = {
    publicUrl,
    waiterTables: `${publicUrl}/waiter/tables`,
    adminDashboard: `${publicUrl}/admin/dashboard`,
    localUrl: `http://127.0.0.1:${appPort}`,
    tunnelType: "pinggy",
    note: "スマホからそのまま開けます（パスワード画面なし）。無料は約60分ごとにURLが変わる場合があります。",
    updatedAt: new Date().toISOString(),
  };
  await writeFile(path.join(root, "PREVIEW_URL.json"), JSON.stringify(preview, null, 2));
  return preview;
}

async function checkPublic(url) {
  try {
    const res = await fetch(`${url}/waiter/tables`, { signal: AbortSignal.timeout(20000) });
    return res.ok;
  } catch {
    return false;
  }
}

function startPinggy() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "ssh",
      [
        "-o",
        "StrictHostKeyChecking=no",
        "-o",
        "ServerAliveInterval=30",
        "-p",
        "443",
        "-R0",
        `127.0.0.1:${appPort}`,
        "a.pinggy.io",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );

    let buffer = "";
    let settled = false;

    const onData = async (chunk) => {
      const text = chunk.toString();
      buffer += text;
      await appendFile(logFile, text).catch(() => undefined);

      const urls = extractUrls(buffer);
      const https = urls.find((u) => u.startsWith("https://"));
      if (!settled && https) {
        settled = true;
        resolve({ child, url: https });
      }
    };

    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("exit", (code) => {
      if (!settled) reject(new Error(`pinggy exited with ${code}`));
    });

    setTimeout(() => {
      if (!settled) reject(new Error("pinggy timeout"));
    }, 90_000);
  });
}

async function main() {
  await mkdir(logDir, { recursive: true });

  if (!(await checkLocal())) {
    console.error(`アプリが :${appPort} で起動していません。`);
    console.error("先に: npm run preview:public  または  preview-app セッションで next start");
    process.exit(1);
  }

  let current = null;

  async function connect() {
    if (current?.child) {
      try {
        current.child.kill();
      } catch {
        // ignore
      }
    }

    spawn("pkill", ["-f", "a.pinggy.io"], { stdio: "ignore" });
    await new Promise((r) => setTimeout(r, 1500));

    const tunnel = await startPinggy();
    const preview = await writePreview(tunnel.url);
    current = tunnel;
    console.log(`\n📱 スマホ用プレビュー:`);
    console.log(`   ${preview.waiterTables}`);
    console.log(`   ${preview.adminDashboard}`);
    console.log(`\n（ブックマーク推奨。無料トンネルは約60分で切れることがあります）\n`);
    return tunnel.url;
  }

  let url = await connect();

  setInterval(async () => {
    if (!(await checkLocal())) {
      console.error(`[${new Date().toISOString()}] ローカルアプリが停止しています :${appPort}`);
      return;
    }
    if (await checkPublic(url)) return;

    console.warn(`[${new Date().toISOString()}] トンネル再接続中...`);
    try {
      url = await connect();
    } catch (err) {
      console.error(`[${new Date().toISOString()}] 再接続失敗:`, err.message);
    }
  }, CHECK_MS);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
