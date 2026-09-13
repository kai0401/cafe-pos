/**
 * 本番 / プレビュー向けスモークチェック
 * 使い方: SMOKE_BASE_URL=https://your-app.vercel.app npx tsx scripts/smoke-check.ts
 */
const base = (process.env.SMOKE_BASE_URL ?? process.env.PUBLIC_BASE_URL ?? "http://localhost:3000")
  .trim()
  .replace(/\/$/, "");

async function check(path: string, opts?: { method?: string; expectStatuses?: number[] }) {
  const url = `${base}${path}`;
  const res = await fetch(url, {
    method: opts?.method ?? "GET",
    cache: "no-store",
  });
  const expect = opts?.expectStatuses ?? [200];
  const ok = expect.includes(res.status);
  const body = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(body) as Record<string, unknown>;
  } catch {
    /* html */
  }
  return { path, status: res.status, ok, json };
}

async function main() {
  console.log(`smoke-check: ${base}`);
  let failed = 0;

  const health = await check("/api/health");
  if (!health.ok || health.json?.ok === false) {
    console.error("FAIL /api/health", health.status, health.json);
    failed += 1;
  } else {
    console.log("OK  /api/health", {
      cloud: health.json?.cloud,
      db: health.json?.db,
      setup: health.json?.setup,
    });
  }

  const staff = await check("/api/auth/staff");
  if (!staff.ok) {
    console.error("FAIL /api/auth/staff", staff.status);
    failed += 1;
  } else {
    console.log("OK  /api/auth/staff", {
      authRequired: staff.json?.authRequired,
      authenticated: staff.json?.authenticated,
    });
  }

  const connect = await check("/api/connect");
  if (!connect.ok) {
    console.error("FAIL /api/connect", connect.status);
    failed += 1;
  } else {
    console.log("OK  /api/connect", {
      cloud: connect.json?.cloud,
      mode: connect.json?.mode,
    });
  }

  const kitchen = await check("/api/kitchen/tickets", { expectStatuses: [200, 500] });
  if (!kitchen.ok) {
    console.error("FAIL /api/kitchen/tickets", kitchen.status);
    failed += 1;
  } else {
    console.log("OK  /api/kitchen/tickets", kitchen.status);
  }

  const tables = await check("/api/waiter/tables", { expectStatuses: [200, 500] });
  if (!tables.ok) {
    console.error("FAIL /api/waiter/tables", tables.status);
    failed += 1;
  } else {
    console.log("OK  /api/waiter/tables", tables.status);
  }

  const bogusPay = await check("/api/payments/stores/does-not-exist", {
    expectStatuses: [400],
  });
  if (!bogusPay.ok) {
    console.error("FAIL /api/payments/stores/:id", bogusPay.status);
    failed += 1;
  } else {
    console.log("OK  /api/payments/stores/:id (invalid → 400)");
  }

  if (failed > 0) {
    console.error(`smoke-check: ${failed} failed`);
    process.exit(1);
  }
  console.log("smoke-check: passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
