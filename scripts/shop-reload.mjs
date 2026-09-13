#!/usr/bin/env node
/**
 * 営業中向けホット差し替え
 *
 *   npm run shop:reload -- --build
 *     → 裏で .next-staging にビルド（稼働中の .next は触らない）
 *     → できた瞬間にディレクトリ差し替え → next だけ数秒で再起動
 *
 *   npm run shop:reload
 *     → 既にある .next のまま next だけ再起動
 *
 * 完全ゼロダウンタイムではないが、ビルド中（数分）は営業を止めない。
 */
import { spawnSync } from "node:child_process";
import {
  writeFileSync,
  unlinkSync,
  mkdirSync,
  existsSync,
  renameSync,
  rmSync,
} from "node:fs";
import { createConnection } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT ?? 3000);
const lock = path.join(root, ".preview-logs", "deploying.lock");
const liveDir = path.join(root, ".next");
const stagingDir = path.join(root, ".next-staging");
const prevDir = path.join(root, ".next-prev");
const doBuild = process.argv.includes("--build");

function log(msg) {
  console.log(`[shop-reload] ${msg}`);
}

function portOpen() {
  return new Promise((resolve) => {
    const s = createConnection({ port: PORT, host: "127.0.0.1" });
    s.once("connect", () => {
      s.destroy();
      resolve(true);
    });
    s.once("error", () => resolve(false));
    s.setTimeout(500, () => {
      s.destroy();
      resolve(false);
    });
  });
}

async function waitHealth(timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/api/health`);
      if (res.ok) {
        const j = await res.json();
        if (j?.db === "ok") return true;
      }
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

function killPortListeners() {
  spawnSync(
    "bash",
    [
      "-lc",
      `PIDS=$(lsof -tiTCP:${PORT} -sTCP:LISTEN 2>/dev/null); if [ -n "$PIDS" ]; then kill -9 $PIDS; fi`,
    ],
    { stdio: "inherit" },
  );
}

function acquireLock() {
  mkdirSync(path.join(root, ".preview-logs"), { recursive: true });
  writeFileSync(lock, String(Date.now()));
}

function releaseLock() {
  try {
    unlinkSync(lock);
  } catch {
    // ignore
  }
}

function buildStaging() {
  log("裏ビルド開始（店舗はそのまま営業・.next は触りません）…");
  if (existsSync(stagingDir)) {
    rmSync(stagingDir, { recursive: true, force: true });
  }

  const b = spawnSync("npm", ["run", "build"], {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, NEXT_DIST_DIR: ".next-staging" },
  });

  if (b.status !== 0) {
    log("裏ビルド失敗 — 稼働中の next はそのまま。差し替えなし");
    if (existsSync(stagingDir)) {
      try {
        rmSync(stagingDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
    process.exit(b.status ?? 1);
  }

  if (!existsSync(path.join(stagingDir, "BUILD_ID"))) {
    log("裏ビルド成果物が不正です（BUILD_ID なし）");
    process.exit(1);
  }
  log("裏ビルド完了 → 差し替えします");
}

function swapStagingLive() {
  // .next-prev を捨ててから .next → .next-prev → .next-staging → .next
  if (existsSync(prevDir)) {
    rmSync(prevDir, { recursive: true, force: true });
  }
  if (existsSync(liveDir)) {
    renameSync(liveDir, prevDir);
  }
  renameSync(stagingDir, liveDir);
  log("ディレクトリ差し替え完了（.next ← staging）");
}

async function main() {
  if (doBuild) {
    // ビルド中はロックしない → 万一落ちても supervisor が復旧できる
    buildStaging();
  } else if (!existsSync(liveDir)) {
    log(".next がありません。先に npm run shop:reload -- --build");
    process.exit(1);
  }

  acquireLock();
  try {
    if (doBuild) {
      swapStagingLive();
    }

    log("next を入れ替え（数秒だけ停止）…");
    killPortListeners();

    const ok = await waitHealth(60_000);
    if (!ok) {
      log("再起動後のヘルス確認に失敗");
      // 直前の .next-prev があれば戻せる余地を残す（手動用）
      if (existsSync(prevDir)) {
        log(`ロールバック候補: ${prevDir} → .next に戻してから next 再起動`);
      }
      process.exit(1);
    }

    log(`差し替え OK（port open=${await portOpen()}）`);
    // 成功したら古いビルドを捨ててディスク節約
    if (existsSync(prevDir)) {
      try {
        rmSync(prevDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  } finally {
    releaseLock();
  }
}

main().catch((err) => {
  releaseLock();
  console.error(err?.message ?? err);
  process.exit(1);
});
