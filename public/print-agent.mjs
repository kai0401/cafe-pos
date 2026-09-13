#!/usr/bin/env node
/**
 * 店舗 Mac 印刷エージェント
 * クラウド（Vercel）の印刷キューを数秒ごとに取り出し、店内 LAN の TM-m30 に送る。
 *
 * 設定（.print-agent.json または環境変数）:
 *   PRINT_AGENT_URL   クラウドのベースURL（例 https://azumaya-pos.vercel.app）
 *   PRINT_AGENT_KEY   クラウド側 PRINT_AGENT_KEY と同じ値
 *   PRINTER_IP / PRINTER_PORT  未指定なら printer-config.json の値を使う
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const POLL_MS = 2000;
const IDLE_POLL_MS = 3000;
const NC_BIN = "/usr/bin/nc";

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

function loadConfig() {
  const agentCfg = readJson(path.join(root, ".print-agent.json"));
  const printerCfg = readJson(path.join(root, "printer-config.json"));
  const url = (process.env.PRINT_AGENT_URL || agentCfg.url || "").replace(/\/$/, "");
  const key = process.env.PRINT_AGENT_KEY || agentCfg.key || "";
  const ip = process.env.PRINTER_IP || agentCfg.printerIp || printerCfg.ip || "";
  const port = Number(process.env.PRINTER_PORT || agentCfg.printerPort || printerCfg.port || 9100);
  return { url, key, ip, port };
}

function sendDirect(data, ip, port, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`timeout ${ip}:${port}`));
    }, timeoutMs);
    socket.connect(port, ip, () => {
      socket.write(data, () => socket.end());
    });
    socket.on("close", () => {
      clearTimeout(timer);
      resolve();
    });
    socket.on("error", (err) => {
      clearTimeout(timer);
      socket.destroy();
      reject(err);
    });
  });
}

function sendViaNc(data, ip, port) {
  return new Promise((resolve, reject) => {
    const child = spawn(NC_BIN, ["-w", "5", ip, String(port)], { stdio: ["pipe", "ignore", "pipe"] });
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("nc timeout"));
    }, 8000);
    child.stderr.on("data", (d) => (stderr += String(d)));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      code === 0 ? resolve() : reject(new Error(`nc exit ${code} ${stderr.trim()}`));
    });
    child.stdin.on("error", () => {});
    child.stdin.end(data);
  });
}

async function printBuffer(data, ip, port) {
  try {
    await sendDirect(data, ip, port);
  } catch (err) {
    const denied = /EHOSTUNREACH|ENETUNREACH|EPERM/.test(String(err?.code ?? err?.message));
    if (denied && process.platform === "darwin" && existsSync(NC_BIN)) {
      await sendViaNc(data, ip, port);
      return;
    }
    throw err;
  }
}

async function api(cfg, method, body) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(`${cfg.url}/api/print-agent/jobs`, {
      method,
      headers: { "content-type": "application/json", "x-print-agent-key": cfg.key },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

let lastErr = "";
async function tick(cfg) {
  const { jobs } = await api(cfg, "GET");
  if (!jobs?.length) return 0;
  for (const job of jobs) {
    const data = Buffer.from(job.data, "base64");
    try {
      await printBuffer(data, cfg.ip, cfg.port);
      await api(cfg, "POST", { id: job.id, ok: true });
      log(`✓ ${job.kind} 印刷 (${data.length} bytes, ${job.id})`);
    } catch (err) {
      const msg = err?.message ?? String(err);
      log(`✗ ${job.kind} 印刷失敗: ${msg}`);
      await api(cfg, "POST", { id: job.id, ok: false, error: msg }).catch(() => {});
    }
  }
  return jobs.length;
}

async function main() {
  const cfg = loadConfig();
  if (!cfg.url || !cfg.key) {
    console.error("PRINT_AGENT_URL / PRINT_AGENT_KEY が未設定です（.print-agent.json か環境変数）");
    process.exit(1);
  }
  if (!cfg.ip) {
    console.error("プリンターIPが未設定です（printer-config.json か PRINTER_IP）");
    process.exit(1);
  }
  log(`🖨 印刷エージェント起動  cloud=${cfg.url}  printer=${cfg.ip}:${cfg.port}`);

  for (;;) {
    let n = 0;
    try {
      n = await tick(cfg);
      if (lastErr) {
        log("クラウド接続 復旧");
        lastErr = "";
      }
    } catch (err) {
      const msg = err?.message ?? String(err);
      if (msg !== lastErr) {
        log(`⚠ クラウド接続エラー: ${msg}（再試行します）`);
        lastErr = msg;
      }
    }
    await new Promise((r) => setTimeout(r, n > 0 ? POLL_MS : IDLE_POLL_MS));
  }
}

main();
