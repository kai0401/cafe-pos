#!/usr/bin/env node
/**
 * Keep preview tunnel alive: restart cloudflared when the public URL stops working.
 * Run in tmux: npm run preview:keepalive
 */
import { openSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkPublicUrl } from "./preview-health.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPort = Number(process.env.PREVIEW_PORT ?? 3100);
const logDir = path.join(root, ".preview-logs");
const tunnelLog = path.join(logDir, "cloudflared.log");
const previewFile = path.join(root, "PREVIEW_URL.json");
const CHECK_INTERVAL_MS = 30_000;
const FAIL_THRESHOLD = 2;

let failCount = 0;
let currentUrl = null;

async function readPreviewUrl() {
  try {
    const data = JSON.parse(await readFile(previewFile, "utf8"));
    return data.publicUrl ?? null;
  } catch {
    return null;
  }
}

async function waitForTunnelUrl() {
  for (let i = 0; i < 90; i++) {
    try {
      const text = await readFile(tunnelLog, "utf8");
      const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (match) return match[0];
    } catch {
      // retry
    }
    await sleep(1000);
  }
  return null;
}

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

async function checkPublic(url) {
  return checkPublicUrl(url);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function killCloudflared() {
  return new Promise((resolve) => {
    spawn("pkill", ["-f", "cloudflared"], { stdio: "ignore" }).on("exit", () => resolve());
  });
}

async function startTunnel() {
  await killCloudflared();
  await sleep(1500);

  const logFd = openSync(tunnelLog, "w");
  const child = spawn(
    "npx",
    [
      "--yes",
      "cloudflared",
      "tunnel",
      "--protocol",
      "http2",
      "--url",
      `http://127.0.0.1:${appPort}`,
    ],
    { detached: true, stdio: ["ignore", logFd, logFd] },
  );
  child.unref();

  const publicUrl = await waitForTunnelUrl();
  if (!publicUrl) throw new Error("Could not obtain tunnel URL");

  for (let i = 0; i < 30; i++) {
    if (await checkPublic(publicUrl)) break;
    await sleep(2000);
    if (i === 29) throw new Error(`Tunnel URL not reachable: ${publicUrl}`);
  }

  const preview = {
    publicUrl,
    waiterTables: `${publicUrl}/waiter/tables`,
    adminDashboard: `${publicUrl}/admin/dashboard`,
    localUrl: `http://127.0.0.1:${appPort}`,
    updatedAt: new Date().toISOString(),
  };

  await writeFile(previewFile, JSON.stringify(preview, null, 2));
  currentUrl = publicUrl;
  failCount = 0;
  console.log(`[${new Date().toISOString()}] Tunnel ready: ${preview.waiterTables}`);
  return publicUrl;
}

async function main() {
  await import("node:fs/promises").then((fs) => fs.mkdir(logDir, { recursive: true }));

  if (!(await checkLocal())) {
    console.error(`App not running on port ${appPort}. Run: npm run preview:public`);
    process.exit(1);
  }

  currentUrl = await readPreviewUrl();
  if (!currentUrl || !(await checkPublic(currentUrl))) {
    await startTunnel();
  } else {
    console.log(`[${new Date().toISOString()}] Reusing tunnel: ${currentUrl}`);
  }

  setInterval(async () => {
    try {
      if (!(await checkLocal())) {
        console.error(`[${new Date().toISOString()}] Local app down on :${appPort}`);
        return;
      }

      if (currentUrl && (await checkPublic(currentUrl))) {
        failCount = 0;
        return;
      }

      failCount += 1;
      console.warn(
        `[${new Date().toISOString()}] Tunnel check failed (${failCount}/${FAIL_THRESHOLD})`,
      );

      if (failCount >= FAIL_THRESHOLD) {
        console.warn(`[${new Date().toISOString()}] Restarting tunnel...`);
        await startTunnel();
      }
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Keepalive error:`, err.message);
      try {
        await startTunnel();
      } catch (e) {
        console.error(`[${new Date().toISOString()}] Restart failed:`, e.message);
      }
    }
  }, CHECK_INTERVAL_MS);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
