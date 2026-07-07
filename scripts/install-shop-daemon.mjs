#!/usr/bin/env node
/**
 * macOS ログイン時に店舗サーバーを自動起動する LaunchAgent をインストール
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { chmod, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const label = "com.cafe-pos.shop";
const plistPath = path.join(os.homedir(), "Library", "LaunchAgents", `${label}.plist`);
const logDir = path.join(root, ".preview-logs");
const nodeBin = process.execPath;

async function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", ...opts });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}

async function main() {
  mkdirSync(logDir, { recursive: true });

  console.log("\n1/4 固定URLを設定…");
  await run(nodeBin, [path.join(root, "scripts", "sync-public-url.mjs")], { cwd: root });

  const nextDir = path.join(root, ".next");
  if (!existsSync(nextDir)) {
    console.log("\n2/4 本番ビルド（初回のみ、数分かかります）…");
    await run("npm", ["run", "build"], { cwd: root, shell: true });
  } else {
    console.log("\n2/4 ビルド済み（スキップ）");
  }

  const shopScript = path.join(root, "scripts", "shop-server.mjs");
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${nodeBin}</string>
    <string>${shopScript}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${root}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${path.join(logDir, "shop-server.log")}</string>
  <key>StandardErrorPath</key>
  <string>${path.join(logDir, "shop-server.err.log")}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>
  </dict>
</dict>
</plist>
`;

  console.log("\n3/4 自動起動を登録…");
  await writeFile(plistPath, plist);
  await chmod(plistPath, 0o644);

  try {
    await run("launchctl", ["bootout", `gui/${process.getuid()}`, plistPath]);
  } catch {
    // not loaded yet
  }
  await run("launchctl", ["bootstrap", `gui/${process.getuid()}`, plistPath]);

  console.log("\n4/4 起動確認…");
  await new Promise((r) => setTimeout(r, 3000));

  let baseUrl = "http://192.168.11.60:3001";
  try {
    const env = await import("node:fs/promises").then((fs) => fs.readFile(path.join(root, ".env"), "utf8"));
    const match = env.match(/^PUBLIC_BASE_URL="?([^"\n]+)"?/m);
    if (match) baseUrl = match[1].replace(/\/$/, "");
  } catch {
    // ignore
  }

  console.log("\n✅ 店舗サーバーを常駐起動しました\n");
  console.log("📱 iPhone の Safari で開く:");
  console.log(`   ${baseUrl}/waiter/open\n`);
  console.log("📲 ホーム画面に追加（1回だけ）:");
  console.log(`   ${baseUrl}/waiter/install`);
  console.log("   → 共有 → ホーム画面に追加\n");
  console.log("以降はホーム画面の「ウェイター」アイコンで常時開けます。");
  console.log("Mac 再起動後も自動で起動します。\n");
  console.log(`ログ: ${path.join(logDir, "shop-server.log")}`);
  console.log(`停止: launchctl bootout gui/$(id -u) ${plistPath}\n`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
