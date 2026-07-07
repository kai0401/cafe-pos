#!/usr/bin/env node
/**
 * どこでも接続用 HTTPS トンネルを常駐起動（macOS LaunchAgent）
 */
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { chmod, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const label = "com.cafe-pos.tunnel";
const plistPath = path.join(os.homedir(), "Library", "LaunchAgents", `${label}.plist`);
const logDir = path.join(root, ".preview-logs");
const nodeBin = process.execPath;
const tunnelScript = path.join(root, "scripts", "shop-tunnel.mjs");

async function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit" });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}

async function main() {
  mkdirSync(logDir, { recursive: true });

  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${nodeBin}</string>
    <string>${tunnelScript}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${root}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${path.join(logDir, "shop-tunnel-daemon.log")}</string>
  <key>StandardErrorPath</key>
  <string>${path.join(logDir, "shop-tunnel-daemon.err.log")}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>
  </dict>
</dict>
</plist>
`;

  await writeFile(plistPath, plist);
  await chmod(plistPath, 0o644);

  try {
    await run("launchctl", ["bootout", `gui/${process.getuid()}`, plistPath]);
  } catch {
    // not loaded
  }
  await run("launchctl", ["bootstrap", `gui/${process.getuid()}`, plistPath]);

  console.log("\n🌐 どこでも接続トンネルを起動しました\n");
  console.log("URL 取得まで 30〜60 秒かかります。以下で確認:\n");
  console.log(`  tail -f ${path.join(logDir, "shop-tunnel.log")}`);
  console.log("  または http://192.168.11.60:3001/waiter/connect\n");
  console.log("📱 iPhone（LTE・外出先）: /waiter/connect → HTTPS URL");
  console.log("🍳 iPad キッチン: /kitchen/connect → QR 読み取り → ホーム画面に追加\n");
  console.log(`停止: launchctl bootout gui/$(id -u) ${plistPath}\n`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
