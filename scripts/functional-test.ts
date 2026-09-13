/**
 * 起動中サーバー向け機能テスト（注文〜会計のハッピーパス）
 * SMOKE_BASE_URL を利用。ログイン機能は廃止済み（認証なしで全 API を検証）
 */
const base = (process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");

type Jar = Map<string, string>;

function parseSetCookie(res: Response, jar: Jar) {
  const raw = res.headers.getSetCookie?.() ?? [];
  for (const c of raw) {
    const [pair] = c.split(";");
    const idx = pair.indexOf("=");
    if (idx > 0) jar.set(pair.slice(0, idx), pair.slice(idx + 1));
  }
}

function cookieHeader(jar: Jar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function req(
  path: string,
  opts: RequestInit & { jar?: Jar; expect?: number[] } = {},
) {
  const jar = opts.jar;
  const headers = new Headers(opts.headers);
  if (jar && jar.size) headers.set("cookie", cookieHeader(jar));
  if (opts.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const res = await fetch(`${base}${path}`, { ...opts, headers, cache: "no-store" });
  if (jar) parseSetCookie(res, jar);
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* html */
  }
  const expect = opts.expect ?? [200];
  const ok = expect.includes(res.status);
  return { ok, status: res.status, json, text, path };
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const results: { name: string; ok: boolean; detail?: string }[] = [];
  const pass = (name: string, detail?: string) => results.push({ name, ok: true, detail });
  const fail = (name: string, detail?: string) => results.push({ name, ok: false, detail });

  console.log(`functional-test: ${base}`);

  // 1. health
  {
    const r = await req("/api/health");
    if (r.ok && r.json?.ok !== false) pass("health", `db=${r.json?.db}`);
    else fail("health", `${r.status} ${JSON.stringify(r.json)}`);
  }

  // 2. auth abolished — staff endpoint reports authRequired=false
  const jar: Jar = new Map();
  {
    const r = await req("/api/auth/staff", { expect: [200] });
    if (r.ok && r.json?.authRequired === false) pass("auth-abolished-staff");
    else fail("auth-abolished-staff", `${r.status} ${JSON.stringify(r.json)}`);
  }

  // 3. login abolished — kitchen is reachable without cookie
  {
    const r = await req("/api/kitchen/tickets", { expect: [200] });
    if (r.ok) pass("kitchen-open", String(r.status));
    else fail("kitchen-open", String(r.status));
  }

  // 4. tables list (auth)
  let tableId: string | null = null;
  {
    const r = await req("/api/waiter/tables", { jar, expect: [200] });
    if (r.ok && Array.isArray(r.json)) {
      tableId = r.json.find((t: any) => t.eatInType === "DINE_IN")?.id ?? r.json[0]?.id ?? null;
      pass("tables-list", `count=${r.json.length} table=${tableId}`);
    } else fail("tables-list", `${r.status} ${JSON.stringify(r.json)?.slice(0, 200)}`);
  }

  // 5. menu
  let productId: string | null = null;
  let drinkId: string | null = null;
  {
    const r = await req("/api/waiter/menu?full=1", { jar, expect: [200] });
    if (r.ok && Array.isArray(r.json)) {
      for (const cat of r.json) {
        for (const p of cat.products ?? []) {
          if (!productId && !p.soldOut && p.sendToKitchen !== false) productId = p.id;
          if (!drinkId && !p.soldOut && p.sendToKitchen === false) drinkId = p.id;
          if (!productId && !p.soldOut) productId = p.id;
        }
      }
      pass("menu", `product=${productId} drink=${drinkId}`);
    } else fail("menu", `${r.status} ${JSON.stringify(r.json)?.slice(0, 200)}`);
  }

  if (!tableId || !productId) {
    fail("order-flow", "table/product missing — seed required");
  } else {
    // 6. open table
    let orderId: string | null = null;
    {
      const r = await req("/api/waiter/orders", {
        method: "POST",
        jar,
        body: JSON.stringify({ action: "open", tableId, customerCount: 2 }),
        expect: [200],
      });
      orderId = r.json?.id ?? r.json?.orderId ?? null;
      if (r.ok && orderId) pass("open-table", orderId);
      else {
        // maybe already open
        const g = await req(`/api/waiter/orders?tableId=${tableId}`, { jar });
        orderId = g.json?.id ?? null;
        if (orderId) pass("open-table-existing", orderId);
        else fail("open-table", `${r.status} ${JSON.stringify(r.json)}`);
      }
    }

    // 7. addAndSend
    {
      const items = [{ productId, quantity: 1 }];
      if (drinkId && drinkId !== productId) items.push({ productId: drinkId, quantity: 1 });
      const r = await req("/api/waiter/orders", {
        method: "POST",
        jar,
        body: JSON.stringify({
          action: "addAndSend",
          tableId,
          items,
          idempotencyKey: `ft-${Date.now()}`,
        }),
        expect: [200],
      });
      if (r.ok) {
        orderId = r.json?.id ?? orderId;
        const statuses = (r.json?.items ?? []).map((i: any) => i.status);
        pass("add-and-send", `statuses=${statuses.join(",")}`);
      } else fail("add-and-send", `${r.status} ${JSON.stringify(r.json)}`);
    }

    // 8. kitchen tickets
    {
      const r = await req("/api/kitchen/tickets", { jar, expect: [200] });
      if (r.ok && Array.isArray(r.json)) pass("kitchen-tickets", `count=${r.json.length}`);
      else fail("kitchen-tickets", String(r.status));

      // advance tickets to DONE
      if (Array.isArray(r.json)) {
        for (const t of r.json) {
          if (t.status === "NEW" || t.status === "COOKING") {
            await req("/api/kitchen/tickets", {
              method: "PATCH",
              jar,
              body: JSON.stringify({ ticketId: t.id, status: "DONE" }),
              expect: [200],
            });
          }
        }
        pass("kitchen-mark-done");
      }
    }

    // 9. checkout cash
    {
      const g = await req(`/api/waiter/orders?tableId=${tableId}`, { jar });
      orderId = g.json?.id ?? orderId;
      const r = await req("/api/waiter/orders", {
        method: "POST",
        jar,
        body: JSON.stringify({
          action: "checkout",
          orderId,
          paymentMethod: "CASH",
          tendered: 10000,
        }),
        expect: [200],
      });
      if (r.ok && (r.json?.totalAmount != null || r.json?.orderNumber)) {
        pass("checkout-cash", JSON.stringify(r.json));
      } else fail("checkout-cash", `${r.status} ${JSON.stringify(r.json)}`);
    }

    // 10. table empty again
    {
      const r = await req("/api/waiter/tables", { jar });
      const t = Array.isArray(r.json) ? r.json.find((x: any) => x.id === tableId) : null;
      if (t && (t.status === "EMPTY" || !t.orderId)) pass("table-cleared", t?.status);
      else fail("table-cleared", JSON.stringify(t));
    }
  }

  // 11. auth abolished — admin login endpoint is a no-op and admin API is open
  {
    const r = await req("/api/auth/login", { method: "POST", body: "{}", expect: [200] });
    if (r.ok && r.json?.authRequired === false) pass("auth-abolished-admin");
    else fail("auth-abolished-admin", `${r.status} ${JSON.stringify(r.json)}`);
  }

  // 12. idempotency replay
  if (tableId && productId) {
    const key = `ft-idem-${Date.now()}`;
    const open = await req("/api/waiter/orders", {
      method: "POST",
      jar,
      body: JSON.stringify({ action: "open", tableId, customerCount: 1 }),
      expect: [200],
    });
    const body = {
      action: "addAndSend",
      tableId,
      items: [{ productId, quantity: 1 }],
      idempotencyKey: key,
    };
    const a = await req("/api/waiter/orders", { method: "POST", jar, body: JSON.stringify(body) });
    const b = await req("/api/waiter/orders", { method: "POST", jar, body: JSON.stringify(body) });
    const countA = (a.json?.items ?? []).filter((i: any) => i.status !== "CANCELLED").length;
    const countB = (b.json?.items ?? []).filter((i: any) => i.status !== "CANCELLED").length;
    if (a.ok && b.ok && countA === countB) pass("idempotency", `items=${countA}`);
    else fail("idempotency", `a=${countA} b=${countB} ${b.status}`);

    // cleanup cancel
    if (open.json?.id || a.json?.id) {
      await req("/api/waiter/orders", {
        method: "POST",
        jar,
        body: JSON.stringify({
          action: "cancelTransaction",
          orderId: a.json?.id ?? open.json?.id,
        }),
        expect: [200, 400],
      });
    }
  }

  console.log("\n=== RESULTS ===");
  let failed = 0;
  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? " — " + r.detail : ""}`);
    if (!r.ok) failed += 1;
  }
  console.log(failed ? `\n${failed} failed` : "\nall passed");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
