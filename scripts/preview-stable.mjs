#!/usr/bin/env node
/**
 * Stable preview via localtunnel (fixed subdomain).
 * Run in tmux: npm run preview:stable
 */
import { readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPort = Number(process.env.PREVIEW_PORT ?? 3100);
const subdomain = process.env.PREVIEW_SUBDOMAIN ?? "cafe-pos-kai0401";
const logFile = path.join(root, ".preview-logs", "localtunnel.log");
const CHECK_INTERVAL_MS = 60_000;

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
  try {
    const res = await fetch(`${url}/waiter/tables`, {
      headers: { "Bypass-Tunnel-Reminder": "true" },
      signal: AbortSignal.timeout(20000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function writePreview(publicUrl) {
  const preview = {
    publicUrl,
    waiterTables: `${publicUrl}/waiter/tables`,
    adminDashboard: `${publicUrl}/admin/dashboard`,
    localUrl: `http://127.0.0.1:${appPort}`,
    tunnelType: "localtunnel",
    updatedAt: new Date().toISOString(),
  };
  await writeFile(path.join(root, "PREVIEW_URL.json"), JSON.stringify(preview, null, 2));
  return preview;
}

function startLocaltunnel() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "npx",
      ["--yes", "localtunnel", "--port", String(appPort), "--subdomain", subdomain],
      { stdio: ["ignore", "pipe", "pipe"] },
    );

    let output = "";
    const onData = (chunk) => {
      output += chunk.toString();
      const match = output.match(/https:\/\/[^\s]+\.loca\.lt/);
      if (match) resolve({ child, url: match[0] });
    };

    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("exit", (code) => reject(new Error(`localtunnel exited with ${code}`)));

    setTimeout(() => reject(new Error("localtunnel timeout")), 60_000);
  });
}

async function main() {
  if (!(await checkLocal())) {
    console.error(`App not running on port ${appPort}. Start preview server first.`);
    process.exit(1);
  }

  const { child, url } = await startLocaltunnel();
  child.unref();

  const preview = await writePreview(url);
  console.log(`[${new Date().toISOString()}] Stable preview: ${preview.waiterTables}`);

  setInterval(async () => {
    if (!(await checkLocal())) {
      console.error(`[${new Date().toISOString()}] Local app down on :${appPort}`);
      return;
    }
    if (await checkPublic(url)) return;
    console.warn(`[${new Date().toISOString()}] Tunnel check failed — restart localtunnel`);
    try {
      child.kill();
    } catch {
      // ignore
    }
    try {
      const restarted = await startLocaltunnel();
      restarted.child.unref();
      await writePreview(restarted.url);
      console.log(`[${new Date().toISOString()}] Restarted: ${restarted.url}/waiter/tables`);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Restart failed:`, err.message);
    }
  }, CHECK_INTERVAL_MS);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
