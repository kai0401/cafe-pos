#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

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

const port = Number(process.env.PORT ?? 3000);
const nextDir = path.join(process.cwd(), ".next");

if (!fs.existsSync(nextDir)) {
  console.error("\n✗ .next がありません。先に npm run build を実行してください。\n");
  process.exit(1);
}

const ip = getLanIp();

console.log("\n🏪 店舗 POS サーバー（本番モード）");
if (ip) {
  console.log(`  ウェイター:  http://${ip}:${port}/waiter/tables`);
  console.log(`  キッチン:    http://${ip}:${port}/kitchen`);
  console.log(`  管理:        http://${ip}:${port}/admin/dashboard`);
  console.log(`  接続ガイド:  http://${ip}:${port}/waiter/connect`);
} else {
  console.log("  LAN IPを取得できませんでした。Wi‑Fi接続を確認してください。");
}
console.log("\n停止: Ctrl+C  |  バックアップ: npm run db:backup\n");

spawn("npx", ["next", "start", "-H", "0.0.0.0", "-p", String(port)], {
  stdio: "inherit",
});
