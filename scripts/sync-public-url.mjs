#!/usr/bin/env node
/**
 * .env の PUBLIC_BASE_URL を LAN IP + ポートに同期（iPhone PWA 用の固定URL）
 */
import { readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env");

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

async function main() {
  const port = Number(process.env.PORT ?? 3001);
  const ip = getLanIp();
  if (!ip) {
    console.error("LAN IP を取得できません。Wi‑Fi に接続してください。");
    process.exit(1);
  }

  const baseUrl = `http://${ip}:${port}`;
  let env = "";
  try {
    env = await readFile(envPath, "utf8");
  } catch {
    env = 'DATABASE_URL="file:./dev.db"\n';
  }

  const line = `PUBLIC_BASE_URL="${baseUrl}"`;
  if (/^PUBLIC_BASE_URL=/m.test(env)) {
    env = env.replace(/^PUBLIC_BASE_URL=.*$/m, line);
  } else {
    env = env.trimEnd() + `\n${line}\n`;
  }

  await writeFile(envPath, env);
  console.log(`PUBLIC_BASE_URL → ${baseUrl}`);
  return { baseUrl, port, ip };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
