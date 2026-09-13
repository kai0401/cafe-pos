/**
 * ローカル機能テスト用: 埋め込み Postgres を起動
 * usage: node scripts/start-embedded-pg.mjs
 */
import fs from "fs";
import path from "path";
import EmbeddedPostgres from "embedded-postgres";

const port = Number(process.env.TEST_PG_PORT || 55432);
const databaseDir = path.join(process.cwd(), ".tmp", "embedded-pg");
const urlFile = path.join(process.cwd(), ".tmp", "test-database-url");

fs.mkdirSync(databaseDir, { recursive: true });

const pg = new EmbeddedPostgres({
  databaseDir,
  user: "cafe",
  password: "cafe",
  port,
  persistent: true,
  onLog: () => {},
  onError: (msg) => console.error("[pg]", msg),
});

// 既に initdb 済みならデータを引き継いで起動だけ行う
const alreadyInitialised = fs.existsSync(path.join(databaseDir, "PG_VERSION"));
if (!alreadyInitialised) {
  await pg.initialise();
}
await pg.start();

try {
  await pg.createDatabase("cafe_pos");
} catch {
  /* already exists */
}

const url = `postgresql://cafe:cafe@127.0.0.1:${port}/cafe_pos?schema=public`;
fs.writeFileSync(urlFile, url);
console.log(`EMBEDDED_PG_READY ${url}`);
console.log(`DATABASE_URL_FILE ${urlFile}`);

// Keep alive until killed
process.on("SIGINT", async () => {
  await pg.stop();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await pg.stop();
  process.exit(0);
});

setInterval(() => {}, 60_000);
