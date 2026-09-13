#!/usr/bin/env node
/**
 * お店Wi-Fi用の LAN URL を表示するだけ。
 * PUBLIC_BASE_URL には書かない（お客様QRは HTTPS トンネル側を使うため）。
 */
import os from "os";

function getLanIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    if (name.startsWith("lo")) continue;
    for (const iface of nets[name] ?? []) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return null;
}

const port = Number(process.env.PORT ?? 3000);
const ip = getLanIp();
if (!ip) {
  console.error("LAN IP を取得できません。お店のWi-Fiに接続してください。");
  process.exit(1);
}

const baseUrl = `http://${ip}:${port}`;
console.log(`ウェイター / キッチン（お店のWi-Fi）: ${baseUrl}`);
console.log(`  ${baseUrl}/waiter`);
console.log(`  ${baseUrl}/kitchen`);
