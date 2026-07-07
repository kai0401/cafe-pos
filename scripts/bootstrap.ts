import { execSync } from "child_process";

function run(command: string) {
  console.log(`\n> ${command}`);
  execSync(command, { stdio: "inherit" });
}

async function main() {
  console.log("=== Cafe POS Bootstrap ===\n");

  run("npx prisma generate");
  run("npm run db:push");

  const cloud = process.env.DATABASE_URL?.startsWith("postgresql");
  if (cloud) {
    console.log("\nクラウドDB: デモデータは投入しません");
    console.log("→ /admin/imports でスマレジCSVをインポートしてください");
  } else {
    run("npm run db:seed");
  }

  run("npm run rollout:check");

  console.log("\nBootstrap complete.");
  console.log("Next steps:");
  console.log("  1. Set ADMIN_PIN, STAFF_PIN and PUBLIC_BASE_URL for production");
  console.log("  2. Import Smaregi CSV at /admin/imports");
  console.log("  3. Print QR seals at /admin/qr");
  console.log("  4. Open /waiter on iPhone and /kitchen on iPad");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
