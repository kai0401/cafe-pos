#!/usr/bin/env node
import { openSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkPublicUrl } from "./preview-health.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPort = Number(process.env.PREVIEW_PORT ?? 3100);
const logFile = path.join(root, ".preview-logs", "cloudflared.log");

async function waitForTunnel() {
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

async function writePreview(publicUrl) {
  const preview = {
    publicUrl,
    waiterTables: `${publicUrl}/waiter/tables`,
    adminDashboard: `${publicUrl}/admin/dashboard`,
    localUrl: `http://127.0.0.1:${appPort}`,
    updatedAt: new Date().toISOString(),
  };
  await writeFile(path.join(root, "PREVIEW_URL.json"), JSON.stringify(preview, null, 2));
  return preview;
}

async function main() {
  const health = await fetch(`http://127.0.0.1:${appPort}/waiter/tables`).catch(() => null);
  if (!health?.ok) {
    console.error(`Preview server is not running on port ${appPort}.`);
    console.error("Run: npm run preview:public");
    process.exit(1);
  }

  spawn("pkill", ["-f", "cloudflared"], { stdio: "ignore" }).on("exit", () => {});
  await new Promise((r) => setTimeout(r, 2000));

  const logFd = openSync(logFile, "w");
  const child = spawn(
    "npx",
    ["--yes", "cloudflared", "tunnel", "--url", `http://127.0.0.1:${appPort}`],
    { detached: true, stdio: ["ignore", logFd, logFd] },
  );
  child.unref();

  const publicUrl = await waitForTunnel();
  if (!publicUrl) {
    console.error("Could not obtain public URL. See .preview-logs/cloudflared.log");
    process.exit(1);
  }

  const preview = await writePreview(publicUrl);

  for (let i = 0; i < 90; i++) {
    if (checkPublicUrl(publicUrl)) {
      console.log(preview.waiterTables);
      return;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.warn("Tunnel URL created but external check is still pending. Try:");
  console.log(preview.waiterTables);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
