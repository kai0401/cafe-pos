#!/usr/bin/env node
import { spawn } from "node:child_process";
import net from "node:net";
import os from "node:os";

function getLanIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    if (name.startsWith("lo")) continue;
    for (const net of nets[name] ?? []) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return null;
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "0.0.0.0");
  });
}

async function findPort(preferred) {
  for (let port = preferred; port < preferred + 20; port++) {
    if (await isPortFree(port)) return port;
  }
  throw new Error(`ポート ${preferred}〜${preferred + 19} がすべて使用中です`);
}

const preferred = Number(process.env.PORT ?? 3000);
const ip = getLanIp();

findPort(preferred)
  .then((port) => {
    if (port !== preferred) {
      console.warn(`\n⚠ ポート ${preferred} は別のアプリが使用中です → ${port} で起動します\n`);
    }

    console.log("\n📱 スマホ接続（同じ Wi‑Fi）");
    if (ip) {
      console.log(`  ウェイター:  http://${ip}:${port}/waiter/tables`);
      console.log(`  キッチン:    http://${ip}:${port}/kitchen`);
      console.log(`  接続ガイド:  http://${ip}:${port}/waiter/connect`);
    } else {
      console.log("  LAN IPを取得できませんでした。Wi‑Fi接続を確認してください。");
    }
    console.log(`\n  Mac から:    http://localhost:${port}/waiter/tables`);
    console.log("\n手順: iPhoneのSafariで上記 URL（192.168...）を開く → 共有 → ホーム画面に追加");
    console.log("※ localhost の URL はスマホでは開けません\n");

    spawn("npx", ["next", "dev", "-H", "0.0.0.0", "-p", String(port)], {
      stdio: "inherit",
      env: { ...process.env, PORT: String(port) },
    });
  })
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
