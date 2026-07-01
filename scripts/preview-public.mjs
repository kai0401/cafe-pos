#!/usr/bin/env node
import { openSync } from "node:fs";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, ".preview-data");
const smaregiDir = path.join(root, "data", "smaregi");
const pgPort = 55432;
const appPort = 3100;
const logDir = path.join(root, ".preview-logs");

const productCandidates = ["商品.csv", "products.csv", "product.csv"];
const transactionCandidates = ["取引.csv", "transactions.csv", "transaction.csv"];

const dbUser = "cafe";
const dbPass = "cafe";
const dbName = "cafe_pos";
const databaseUrl = `postgresql://${dbUser}:${dbPass}@127.0.0.1:${pgPort}/${dbName}?schema=public`;

function hasSmaregiCsv() {
  const hasProduct = productCandidates.some((name) => existsSync(path.join(smaregiDir, name)));
  const hasTransaction = transactionCandidates.some((name) => existsSync(path.join(smaregiDir, name)));
  return hasProduct && hasTransaction;
}

function run(cmd, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: root,
      env: { ...process.env, ...env },
      stdio: "inherit",
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(" ")} exited with ${code}`));
    });
  });
}

function spawnDetached(cmd, args, env = {}, logFile) {
  const logFd = openSync(logFile, "a");
  const child = spawn(cmd, args, {
    cwd: root,
    env: { ...process.env, ...env },
    detached: true,
    stdio: ["ignore", logFd, logFd],
  });
  child.unref();
  return child.pid;
}

async function waitForHttp(url, attempts = 60) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function readPinggyUrl(logFile) {
  for (let i = 0; i < 90; i++) {
    try {
      const text = await readFile(logFile, "utf8");
      const match = text.match(/https:\/\/[a-z0-9-]+\.(?:pinggy-free\.link|free\.pinggy\.net)/i);
      if (match) return match[0];
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return null;
}

async function main() {
  await mkdir(dataDir, { recursive: true });
  await mkdir(logDir, { recursive: true });

  console.log("Starting embedded PostgreSQL...");
  const pgDir = path.join(dataDir, "postgres");
  if (hasSmaregiCsv() && process.env.KEEP_PREVIEW_DB !== "1") {
    console.log("Smaregi CSV detected — resetting preview database for a clean import...");
    await rm(pgDir, { recursive: true, force: true });
  }
  const pg = new EmbeddedPostgres({
    databaseDir: pgDir,
    user: dbUser,
    password: dbPass,
    port: pgPort,
    persistent: true,
  });

  if (!existsSync(path.join(pgDir, "PG_VERSION"))) {
    await pg.initialise();
  }
  await pg.start();
  await pg.createDatabase(dbName).catch(() => undefined);

  const env = { DATABASE_URL: databaseUrl };
  console.log("Applying schema...");
  await run("npx", ["prisma", "db", "push"], env);

  console.log("Importing Smaregi menu and sales data...");
  await run("npx", ["tsx", "scripts/seed-demo.ts"], env);

  console.log("Building app...");
  await run("npm", ["run", "build"], env);

  const appLog = path.join(logDir, "app.log");
  const pinggyLog = path.join(logDir, "pinggy.log");
  console.log("Starting production server...");
  spawnDetached("npm", ["run", "start", "--", "-p", String(appPort), "-H", "0.0.0.0"], env, appLog);

  const ready = await waitForHttp(`http://127.0.0.1:${appPort}/waiter/tables`);
  if (!ready) throw new Error("App did not become ready");

  console.log("Starting mobile tunnel (Pinggy)...");
  spawn("pkill", ["-f", "a.pinggy.io"], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 1500));
  const pinggyFd = openSync(pinggyLog, "w");
  spawnDetached(
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
    {},
    pinggyLog,
  );

  const publicUrl = await readPinggyUrl(pinggyLog);
  if (!publicUrl) throw new Error("Could not obtain public URL. See .preview-logs/pinggy.log");

  const preview = {
    publicUrl,
    waiterTables: `${publicUrl}/waiter/tables`,
    adminDashboard: `${publicUrl}/admin/dashboard`,
    localUrl: `http://127.0.0.1:${appPort}`,
    tunnelType: "pinggy",
    note: "スマホからそのまま開けます。ホーム画面に追加してください。",
    updatedAt: new Date().toISOString(),
  };

  await writeFile(path.join(root, "PREVIEW_URL.json"), JSON.stringify(preview, null, 2));
  console.log("\n📱 スマホ用プレビュー:");
  console.log(`  ${preview.waiterTables}`);
  console.log(`  ${preview.adminDashboard}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
