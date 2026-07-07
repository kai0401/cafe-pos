"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { formatYen } from "@/lib/format";
import { buildOrderItemsWithModifiers, formatOrderItemNote, groupOrderItemsForDisplay } from "@/lib/order-modifiers";

const BROWN = "#b45309";

type Category = { id: string; name: string; productCount: number; hasModifiers?: boolean };
type Product = { id: string; name: string; price: number; soldOut: boolean };
type ModifierGroup = { name: string; items: Product[] };
type CartItem = { productId: string; name: string; price: number; quantity: number; note?: string };
type OrderedItem = {
  id: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  status: string;
  note?: string | null;
  createdAt: string;
};
type Order = {
  id: string;
  customerCount: number;
  items: OrderedItem[];
  status: string;
};
type PaymentSession = {
  id: string;
  status: string;
  amount: number;
  paymentUrl?: string | null;
};

const ITEM_STATUS: Record<string, string> = {
  PENDING: "カート送信待ち",
  SENT: "受付済み",
  COOKING: "調理中",
  DONE: "まもなく提供",
  SERVED: "提供済み",
};

async function qrFetch(
  tableId: string,
  token: string,
  body: Record<string, unknown>,
) {
  const res = await fetch("/api/qr/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tableId, token, ...body }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "エラーが発生しました");
  return data;
}

export default function QrOrderClient() {
  const params = useParams();
  const searchParams = useSearchParams();
  const tableId = params.tableId as string;
  const token = searchParams.get("t") ?? "";

  const [tableName, setTableName] = useState("");
  const [eatInType, setEatInType] = useState("DINE_IN");
  const [order, setOrder] = useState<Order | null>(null);
  const [storesEnabled, setStoresEnabled] = useState(false);
  const [paymentSession, setPaymentSession] = useState<PaymentSession | null>(null);

  const [screen, setScreen] = useState<"welcome" | "menu" | "cart" | "history" | "pay" | "paid">("welcome");
  const [guestCount, setGuestCount] = useState(2);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [modalProduct, setModalProduct] = useState<Product | null>(null);
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);
  const [selectedModifiers, setSelectedModifiers] = useState<Set<string>>(new Set());
  const [modalQty, setModalQty] = useState(1);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  };

  const refreshSession = useCallback(
    async (opts?: { syncPayment?: boolean }) => {
      if (!tableId || !token) return;
      const params = new URLSearchParams({ tableId, token });
      if (opts?.syncPayment) params.set("syncPayment", "1");
      const res = await fetch(`/api/qr/orders?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "アクセスできません");
        return;
      }
      setTableName(data.table.name);
      setEatInType(data.table.eatInType);
      setOrder(data.order);
      setStoresEnabled(data.storesEnabled);
      setPaymentSession(data.paymentSession);

      if (data.paymentSession?.status === "PAID") {
        setScreen("paid");
        return;
      }

      if (data.order) {
        setScreen((s) => (s === "welcome" || s === "paid" ? "menu" : s));
        try {
          const menu: Category[] = await qrFetch(tableId, token, { action: "menu" });
          const visible = menu.filter((c) => c.productCount > 0);
          setCategories(visible);
          setActiveCategory((prev) => {
            if (prev && visible.some((c) => c.id === prev)) return prev;
            return visible[0]?.id ?? null;
          });
        } catch {
          /* メニュー読み込み失敗時は注文状況のみ表示 */
        }
      } else {
        setScreen("welcome");
        setCategories([]);
        setActiveCategory(null);
      }
    },
    [tableId, token],
  );

  useEffect(() => {
    if (!token) {
      setError("QRコードが無効です。スタッフにお声がけください");
      return;
    }
    refreshSession();
  }, [token, refreshSession]);

  useEffect(() => {
    if (!order?.id) return;
    const t = setInterval(() => refreshSession({ syncPayment: screen === "pay" }), 8000);
    return () => clearInterval(t);
  }, [order?.id, screen, refreshSession]);

  useEffect(() => {
    if (!activeCategory || screen !== "menu") return;
    qrFetch(tableId, token, { action: "menu", categoryId: activeCategory })
      .then(setProducts)
      .catch((e) => setError(e.message));
  }, [activeCategory, screen, tableId, token]);

  const orderedItems = useMemo(
    () => (order?.items ?? []).filter((i) => i.status !== "PENDING" && i.status !== "CANCELLED"),
    [order],
  );
  const pendingItems = useMemo(
    () => (order?.items ?? []).filter((i) => i.status === "PENDING"),
    [order],
  );

  const cartCount = useMemo(() => cart.reduce((s, i) => s + i.quantity, 0), [cart]);
  const cartTotal = useMemo(() => cart.reduce((s, i) => s + i.price * i.quantity, 0), [cart]);
  const displayOrderedItems = useMemo(
    () =>
      groupOrderItemsForDisplay(
        orderedItems.map((i) => ({
          id: i.id,
          productId: i.productId,
          productName: i.productName,
          unitPrice: i.unitPrice,
          quantity: i.quantity,
          status: i.status,
          note: i.note ?? null,
          createdAt: i.createdAt,
        })),
      ),
    [orderedItems],
  );

  const orderedTotal = useMemo(
    () => displayOrderedItems.reduce((s, i) => s + i.lineTotal, 0),
    [displayOrderedItems],
  );
  const allServed =
    displayOrderedItems.length > 0 &&
    displayOrderedItems.every((i) => i.status === "SERVED");

  async function startOrder() {
    setLoading(true);
    try {
      const data = await qrFetch(tableId, token, {
        action: "start",
        customerCount: guestCount,
      });
      setOrder(data.order);
      const menu: Category[] = await qrFetch(tableId, token, { action: "menu" });
      const visible = menu.filter((c) => c.productCount > 0);
      setCategories(visible);
      if (visible[0]) setActiveCategory(visible[0].id);
      setScreen("menu");
    } catch (e) {
      setError(e instanceof Error ? e.message : "開始できません");
    } finally {
      setLoading(false);
    }
  }

  async function openProduct(product: Product) {
    if (product.soldOut || !activeCategory) return;
    const cat = categories.find((c) => c.id === activeCategory);
    if (!cat?.hasModifiers) {
      setCart((prev) => {
        const next = [...prev];
        const existing = next.find((i) => i.productId === product.id);
        if (existing) existing.quantity += 1;
        else next.push({ productId: product.id, name: product.name, price: product.price, quantity: 1 });
        return next;
      });
      showToast(`${product.name} をカートに追加`);
      return;
    }

    setModalProduct(product);
    setModalQty(1);
    setSelectedModifiers(new Set());
    try {
      const groups = await qrFetch(tableId, token, {
        action: "menu",
        categoryId: activeCategory,
        modifiers: true,
      });
      setModifierGroups(Array.isArray(groups) ? groups : []);
    } catch (e) {
      setModifierGroups([]);
      showToast(e instanceof Error ? e.message : "トッピングの読み込みに失敗");
    }
  }

  function addToCart() {
    if (!modalProduct) return;
    const mods = modifierGroups
      .flatMap((g) => g.items)
      .filter((m) => selectedModifiers.has(m.id))
      .map((m) => ({ id: m.id, name: m.name, price: m.price }));
    const apiItems = buildOrderItemsWithModifiers({ id: modalProduct.id, quantity: modalQty }, mods);
    const priceById = new Map<string, { name: string; price: number }>([
      [modalProduct.id, { name: modalProduct.name, price: modalProduct.price }],
      ...mods.map((m) => [m.id, { name: m.name, price: m.price }] as const),
    ]);
    setCart((prev) => {
      const next = [...prev];
      for (const item of apiItems) {
        const meta = priceById.get(item.productId);
        if (!meta) continue;
        const key = `${item.productId}:${item.note ?? ""}`;
        const existing = next.find((i) => `${i.productId}:${i.note ?? ""}` === key);
        if (existing) existing.quantity += item.quantity;
        else next.push({ productId: item.productId, name: meta.name, price: meta.price, quantity: item.quantity, note: item.note });
      }
      return next;
    });
    setModalProduct(null);
    showToast("カートに追加しました");
  }

  function updateCartQty(productId: string, note: string | undefined, delta: number) {
    const key = `${productId}:${note ?? ""}`;
    setCart((prev) =>
      prev
        .map((i) =>
          `${i.productId}:${i.note ?? ""}` === key ? { ...i, quantity: i.quantity + delta } : i,
        )
        .filter((i) => i.quantity > 0),
    );
  }

  async function submitOrder() {
    if (cart.length === 0) return;
    setLoading(true);
    try {
      const sent = await qrFetch(tableId, token, {
        action: "addAndSend",
        items: cart.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          note: i.note,
        })),
      });
      setOrder(sent);
      setCart([]);
      setScreen("history");
      showToast("ご注文を承りました");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "注文に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  async function startStoresPayment() {
    if (!order) return;
    setLoading(true);
    try {
      const data = await qrFetch(tableId, token, {
        action: "pay",
        orderId: order.id,
        mode: "online",
      });
      setPaymentSession(data.session);
      if (data.session.paymentUrl) {
        window.location.href = data.session.paymentUrl;
      } else {
        setScreen("pay");
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "決済を開始できません");
    } finally {
      setLoading(false);
    }
  }

  if (error) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-stone-50 p-6">
        <div className="max-w-sm rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="text-[17px] font-bold text-stone-800">QRオーダー</p>
          <p className="mt-4 text-[15px] text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col bg-stone-50 pb-24">
      <header
        className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 text-white"
        style={{ backgroundColor: BROWN }}
      >
        <div>
          <p className="text-[12px] opacity-80">QRオーダー</p>
          <h1 className="text-[17px] font-bold">テーブル {tableName || "…"}</h1>
        </div>
        {order && (
          <button
            type="button"
            onClick={() => {
              refreshSession();
              setScreen("history");
            }}
            className="rounded-full bg-white/15 px-3 py-1.5 text-[13px]"
          >
            注文状況
          </button>
        )}
      </header>

      {screen === "welcome" && (
        <div className="flex flex-1 flex-col items-center justify-center p-6">
          <p className="mb-2 text-[22px] font-bold text-stone-800">いらっしゃいませ</p>
          <p className="mb-8 text-center text-[14px] text-stone-500">
            テーブル {tableName} から
            <br />
            スマホでご注文いただけます
          </p>
          <p className="mb-3 text-[14px] font-medium text-stone-600">ご人数</p>
          <div className="mb-8 flex items-center gap-5">
            <button
              type="button"
              onClick={() => setGuestCount((n) => Math.max(1, n - 1))}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-stone-300 text-[22px]"
            >
              −
            </button>
            <span className="min-w-[48px] text-center text-[28px] font-bold">{guestCount}</span>
            <button
              type="button"
              onClick={() => setGuestCount((n) => Math.min(20, n + 1))}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-stone-300 text-[22px]"
            >
              ＋
            </button>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={startOrder}
            className="w-full max-w-xs rounded-xl py-4 text-[16px] font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: BROWN }}
          >
            {loading ? "準備中…" : "注文をはじめる"}
          </button>
        </div>
      )}

      {screen === "menu" && (
        <>
          <nav className="sticky top-[58px] z-10 flex gap-1 overflow-x-auto border-b border-stone-200 bg-white px-2 py-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-[14px] font-medium ${
                  activeCategory === cat.id ? "text-white" : "bg-stone-100 text-stone-600"
                }`}
                style={activeCategory === cat.id ? { backgroundColor: BROWN } : undefined}
              >
                {cat.name}
              </button>
            ))}
          </nav>
          <div className="flex-1">
            {products.map((product) => (
              <button
                key={product.id}
                type="button"
                disabled={product.soldOut}
                onClick={() => openProduct(product)}
                className="flex w-full items-center justify-between border-b border-stone-200 bg-white px-4 py-4 text-left active:bg-amber-50 disabled:opacity-40"
              >
                <div>
                  <p className="text-[16px] text-stone-900">{product.name}</p>
                  {product.soldOut && <p className="text-[12px] text-red-500">売り切れ</p>}
                </div>
                <span className="text-[16px] font-medium text-stone-700">{formatYen(product.price)}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {screen === "cart" && (
        <div className="flex-1 p-4">
          <h2 className="mb-3 text-[17px] font-bold text-stone-800">カート</h2>
          {cart.length === 0 ? (
            <p className="py-12 text-center text-stone-400">カートは空です</p>
          ) : (
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
              {cart.map((item) => (
                <div key={`${item.productId}:${item.note ?? ""}`} className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] text-stone-900">{item.name}</p>
                    {formatOrderItemNote(item.note) && (
                      <p className="text-[12px] text-stone-500">{formatOrderItemNote(item.note)}</p>
                    )}
                    <p className="text-[13px] text-stone-500">{formatYen(item.price)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => updateCartQty(item.productId, item.note, -1)} className="flex h-8 w-8 items-center justify-center rounded-full border border-stone-300 text-[18px]">−</button>
                    <span className="min-w-[24px] text-center text-[15px] font-medium">{item.quantity}</span>
                    <button type="button" onClick={() => updateCartQty(item.productId, item.note, 1)} className="flex h-8 w-8 items-center justify-center rounded-full border border-stone-300 text-[18px]">＋</button>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-[15px] font-medium">合計</span>
                <span className="text-[18px] font-bold" style={{ color: BROWN }}>{formatYen(cartTotal)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {screen === "history" && (
        <div className="flex-1 p-4">
          <h2 className="mb-3 text-[17px] font-bold text-stone-800">注文状況</h2>
          {displayOrderedItems.length === 0 && pendingItems.length === 0 ? (
            <p className="py-12 text-center text-stone-400">まだ注文はありません</p>
          ) : (
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
              {displayOrderedItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
                  <div>
                    <p className="text-[15px] text-stone-900">
                      {item.displayName}
                      {item.quantity > 1 && ` ×${item.quantity}`}
                    </p>
                    <p className="text-[12px]" style={{ color: item.status === "SERVED" ? "#059669" : BROWN }}>
                      {ITEM_STATUS[item.status] ?? item.status}
                    </p>
                  </div>
                  <span className="text-[14px] text-stone-600">{formatYen(item.lineTotal)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-[15px] font-medium">ご注文合計</span>
                <span className="text-[18px] font-bold" style={{ color: BROWN }}>{formatYen(orderedTotal)}</span>
              </div>
            </div>
          )}

          {storesEnabled && allServed && orderedTotal > 0 && (
            <button
              type="button"
              disabled={loading}
              onClick={startStoresPayment}
              className="mt-4 w-full rounded-xl py-4 text-[15px] font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: BROWN }}
            >
              STORESでお支払い（{formatYen(orderedTotal)}）
            </button>
          )}

          {!storesEnabled && (
            <p className="mt-4 text-center text-[13px] text-stone-400">お会計はスタッフにお声がけください</p>
          )}
        </div>
      )}

      {screen === "pay" && paymentSession && (
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <p className="text-[17px] font-bold text-stone-800">お支払い</p>
          <p className="mt-2 text-[32px] font-bold" style={{ color: BROWN }}>{formatYen(paymentSession.amount)}</p>
          <p className="mt-4 text-[14px] text-stone-500">決済画面でお支払いください</p>
          {paymentSession.paymentUrl && (
            <a
              href={paymentSession.paymentUrl}
              className="mt-6 w-full max-w-xs rounded-xl py-4 text-[15px] font-semibold text-white"
              style={{ backgroundColor: BROWN }}
            >
              決済画面を開く
            </a>
          )}
          <button
            type="button"
            onClick={() => void refreshSession({ syncPayment: true })}
            className="mt-4 text-[14px] text-stone-500 underline"
          >
            支払い状況を更新
          </button>
        </div>
      )}

      {screen === "paid" && (
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <p className="text-[48px]">✓</p>
          <p className="mt-2 text-[20px] font-bold text-stone-800">お支払い完了</p>
          {paymentSession && (
            <p className="mt-2 text-[24px] font-bold" style={{ color: BROWN }}>
              {formatYen(paymentSession.amount)}
            </p>
          )}
          <p className="mt-4 text-[14px] text-stone-500">ご利用ありがとうございました</p>
        </div>
      )}

      {(screen === "menu" || screen === "history") && (
        <div className="fixed bottom-0 left-0 right-0 z-30 mx-auto w-full max-w-[430px] border-t border-stone-200 bg-white">
          <div className="flex items-center gap-3 p-3">
            <button
              type="button"
              onClick={() => setScreen(screen === "menu" ? "cart" : "menu")}
              className="flex-1 rounded-xl border border-stone-300 py-3.5 text-[15px] font-medium"
            >
              {screen === "menu" ? `カート（${cartCount}）` : "メニューへ"}
            </button>
            {screen === "menu" && cartCount > 0 && (
              <button
                type="button"
                onClick={() => setScreen("cart")}
                className="flex-1 rounded-xl py-3.5 text-[15px] font-semibold text-white"
                style={{ backgroundColor: BROWN }}
              >
                {formatYen(cartTotal)}
              </button>
            )}
          </div>
        </div>
      )}

      {screen === "cart" && (
        <div className="fixed bottom-0 left-0 right-0 z-30 mx-auto w-full max-w-[430px] border-t border-stone-200 bg-white p-3">
          <div className="flex gap-3">
            <button type="button" onClick={() => setScreen("menu")} className="flex-1 rounded-xl border border-stone-300 py-3.5 text-[15px] font-medium">戻る</button>
            <button
              type="button"
              disabled={cart.length === 0 || loading}
              onClick={submitOrder}
              className="flex-1 rounded-xl py-3.5 text-[15px] font-semibold text-white disabled:opacity-40"
              style={{ backgroundColor: BROWN }}
            >
              {loading ? "送信中…" : `注文する（${formatYen(cartTotal)}）`}
            </button>
          </div>
        </div>
      )}

      {modalProduct && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/30">
          <div className="mx-auto mt-auto flex w-full max-w-[430px] flex-col rounded-t-2xl bg-white" style={{ maxHeight: "85vh" }}>
            <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
              <div>
                <p className="text-[17px] font-bold">{modalProduct.name}</p>
                <p className="text-[14px] text-stone-500">{formatYen(modalProduct.price)}</p>
              </div>
              <button type="button" onClick={() => setModalProduct(null)} className="text-[26px] leading-none text-stone-400">×</button>
            </div>
            <div className="overflow-y-auto">
              {modifierGroups.length === 0 ? (
                <p className="px-4 py-6 text-center text-[14px] text-stone-400">トッピングはありません</p>
              ) : (
                modifierGroups.map((group) => (
                  <div key={group.name}>
                    <div className="bg-stone-100 px-4 py-2 text-[13px] font-medium text-stone-600">
                      {group.name}
                    </div>
                    {group.items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() =>
                          setSelectedModifiers((prev) => {
                            const next = new Set(prev);
                            if (next.has(item.id)) next.delete(item.id);
                            else next.add(item.id);
                            return next;
                          })
                        }
                        className={`flex w-full items-center justify-between border-b border-stone-100 px-4 py-3 text-left ${selectedModifiers.has(item.id) ? "bg-amber-50" : "bg-white"}`}
                      >
                        <span className="text-[15px]">{item.name}</span>
                        <span className="text-[14px] text-stone-600">
                          {item.price >= 0 ? "+" : ""}
                          {formatYen(Math.abs(item.price))}
                        </span>
                      </button>
                    ))}
                  </div>
                ))
              )}
              <div className="flex items-center justify-between px-4 py-4">
                <span className="text-[15px] font-medium text-stone-700">数量</span>
                <div className="flex items-center gap-4">
                  <button type="button" onClick={() => setModalQty((q) => Math.max(1, q - 1))} className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-300 text-[22px]">−</button>
                  <span className="min-w-[32px] text-center text-[20px] font-semibold">{modalQty}</span>
                  <button type="button" onClick={() => setModalQty((q) => q + 1)} className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-300 text-[22px]">＋</button>
                </div>
              </div>
            </div>
            <div className="border-t border-stone-200 p-3">
              <button type="button" onClick={addToCart} className="w-full rounded-xl py-3.5 text-[15px] font-semibold text-white" style={{ backgroundColor: BROWN }}>カートに追加</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed left-4 right-4 top-16 z-50 mx-auto max-w-[400px] rounded-lg bg-stone-900/90 px-4 py-3 text-center text-[14px] text-white">{toast}</div>
      )}
    </div>
  );
}
