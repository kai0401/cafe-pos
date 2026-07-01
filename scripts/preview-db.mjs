#!/usr/bin/env node
/** Start embedded PostgreSQL for preview (idempotent). */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pgDir = path.join(root, ".preview-data", "postgres");
const pgPort = 55432;
const dbUser = "cafe";
const dbPass = "cafe";
const dbName = "cafe_pos";

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

console.log(`PostgreSQL ready on port ${pgPort}`);
console.log(`DATABASE_URL=postgresql://${dbUser}:${dbPass}@127.0.0.1:${pgPort}/${dbName}?schema=public`);

// Keep process alive when run standalone
if (process.argv.includes("--daemon")) {
  setInterval(() => {}, 60_000);
}
