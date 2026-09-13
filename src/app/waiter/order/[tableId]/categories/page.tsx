"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ConfirmDialog, Toast } from "@/components/waiter/waiter-ui";
import { formatYen } from "@/lib/format";
import { flushOfflineQueue, queueOfflineAction } from "@/lib/offline-queue";
import { buildOrderItemsWithModifiers, isModifierChildLine } from "@/lib/order-modifiers";
import { waiterFetch } from "@/lib/waiter-api";
import { loadWaiterOrderSettings } from "@/lib/waiter-order-settings";
import { POS_ACCENT } from "@/lib/pos-theme";


type Product = {
  id: string;
  name: string;
  price: number;
  soldOut: boolean;
  displayName?: string;
  included?: boolean;
};
type MenuCategory = { id: string; name: string; hasModifiers: boolean; products: Product[] };
type ModifierGroup = {
  name: string;
  selection?: "multiple" | "single";
  replacesMain?: boolean;
  flavorChoice?: boolean;
  items: Product[];
};
type OrderItem = { productId: string; quantity: number; status: string; note?: string | null };

export default function WaiterMenuPage() {
  const params = useParams();
  const router = useRouter();
  const tableId = params.tableId as string;

  const [tableName, setTableName] = useState("");
  const [eatInType, setEatInType] = useState("DINE_IN");
  const [menu, setMenu] = useState<MenuCategory[]>([]);
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [pendingItems, setPendingItems] = useState<OrderItem[]>([]);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState("");
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  const [panelProduct, setPanelProduct] = useState<Product | null>(null);
  const [panelQty, setPanelQty] = useState(1);
  const [panelLoading, setPanelLoading] = useState(false);
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);
  const [selectedModifiers, setSelectedModifiers] = useState<Set<string>>(new Set());
  const [soldOutId, setSoldOutId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError("");
    setLoading(true);
    try {
      const tableRes = await waiterFetch(`/api/waiter/tables/${tableId}`);
      const table = await tableRes.json();
      if (!tableRes.ok) {
        setLoadError(table.error ?? "テーブル情報の読み込みに失敗しました");
        return;
      }
      setTableName(table.name ?? "");
      const eat = table.eatInType === "TAKEOUT" ? "TAKEOUT" : "DINE_IN";
      setEatInType(eat);

      const [menuRes, orderRes] = await Promise.all([
        waiterFetch(`/api/waiter/menu?full=1&eatInType=${eat}`),
        waiterFetch(`/api/waiter/orders?tableId=${tableId}`),
      ]);
      const fullMenu: MenuCategory[] = await menuRes.json();
      if (!menuRes.ok) {
        setLoadError((fullMenu as unknown as { error?: string }).error ?? "メニューの読み込みに失敗しました");
        return;
      }
      setMenu(fullMenu);
      setActiveCatId((prev) => prev ?? fullMenu[0]?.id ?? null);

      const order = await orderRes.json();
      setPendingItems(
        (order?.items ?? []).filter(
          (i: OrderItem) =>
            i.status === "PENDING" && !isModifierChildLine(i.productId ?? "", i.note ?? null),
        ),
      );
    } catch {
      setLoadError("サーバーに接続できません");
    } finally {
      setLoading(false);
    }
  }, [tableId]);

  useEffect(() => {
    void flushOfflineQueue();
    load();
  }, [load]);

  useEffect(() => {
    if (!panelProduct) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [panelProduct]);

  async function refreshOrderOnly() {
    const orderRes = await waiterFetch(`/api/waiter/orders?tableId=${tableId}`);
    const order = await orderRes.json();
    setPendingItems(
      (order?.items ?? []).filter(
        (i: OrderItem) =>
          i.status === "PENDING" && !isModifierChildLine(i.productId ?? "", i.note ?? null),
      ),
    );
  }

  const productCategoryMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const cat of menu) {
      for (const p of cat.products) map.set(p.id, cat.id);
    }
    return map;
  }, [menu]);

  const pendingByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of pendingItems) {
      if (!item.productId) continue;
      const catId = productCategoryMap.get(item.productId);
      if (!catId) continue;
      map.set(catId, (map.get(catId) ?? 0) + item.quantity);
    }
    return map;
  }, [pendingItems, productCategoryMap]);

  const pendingCount = pendingItems.reduce((s, i) => s + i.quantity, 0);
  const activeCat = menu.find((c) => c.id === activeCatId) ?? null;

  async function addItems(
    items: { productId: string; quantity: number; note?: string }[],
    sendNow: boolean,
  ) {
    const optimistic = items.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
      status: "PENDING",
      note: i.note,
    }));
    setPendingItems((prev) => {
      const next = [...prev];
      for (const item of optimistic) {
        const existing = next.find(
          (p) => p.productId === item.productId && (p.note ?? "") === (item.note ?? ""),
        );
        if (existing) existing.quantity += item.quantity;
        else next.push(item);
      }
      return next;
    });

    const idempotencyKey =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `live-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const payload = sendNow
      ? { action: "addAndSend" as const, tableId, items, idempotencyKey }
      : { tableId, items, idempotencyKey };

    try {
      const res = await waiterFetch("/api/waiter/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        await refreshOrderOnly();
        if (!navigator.onLine) {
          queueOfflineAction(
            sendNow
              ? { action: "addAndSend", tableId, items, idempotencyKey }
              : { tableId, items, idempotencyKey },
          );
          setToast("オフライン保存しました");
        } else {
          const data = await res.json();
          setToast(data.error ?? "注文の追加に失敗しました");
        }
        return false;
      }
      await refreshOrderOnly();
      return true;
    } catch {
      await refreshOrderOnly();
      queueOfflineAction(
        sendNow
          ? { action: "addAndSend", tableId, items, idempotencyKey }
          : { tableId, items, idempotencyKey },
      );
      setToast("オフライン保存しました");
      return false;
    }
  }

  async function toggleSoldOut(product: Product) {
    const next = product.soldOut ? "ACTIVE" : "SOLD_OUT";
    setSoldOutId(product.id);
    try {
      const res = await waiterFetch("/api/waiter/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, status: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "売切の更新に失敗しました");
      const soldOut = next === "SOLD_OUT";
      setMenu((prev) =>
        prev.map((cat) => ({
          ...cat,
          products: cat.products.map((p) => (p.id === product.id ? { ...p, soldOut } : p)),
        })),
      );
      setModifierGroups((prev) =>
        prev.map((g) => ({
          ...g,
          items: g.items.map((item) => (item.id === product.id ? { ...item, soldOut } : item)),
        })),
      );
      setToast(soldOut ? `${product.name} を売切にしました` : `${product.name} の販売を再開しました`);
      setTimeout(() => setToast(""), 1200);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "売切の更新に失敗しました");
    } finally {
      setSoldOutId(null);
    }
  }

  async function tapProduct(product: Product) {
    if (product.soldOut || addingId || !activeCat) return;

    const wantsQtyPanel = activeCat.name === "ドリンク";

    // ドリンク以外でトッピングなし → 従来どおり1点即追加
    if (!activeCat.hasModifiers && !wantsQtyPanel) {
      setAddingId(product.id);
      const ok = await addItems([{ productId: product.id, quantity: 1 }], false);
      setAddingId(null);
      if (ok) {
        setToast(`${product.name} を追加`);
        setTimeout(() => setToast(""), 900);
      }
      return;
    }

    setPanelProduct(product);
    setPanelQty(1);
    setSelectedModifiers(new Set());
    setModifierGroups([]);

    // ドリンクでトッピングカテゴリなし → 数量だけ選ぶパネル
    if (!activeCat.hasModifiers) {
      return;
    }

    setPanelLoading(true);
    try {
      const res = await waiterFetch(
        `/api/waiter/menu?eatInType=${eatInType}&categoryId=${activeCat.id}&modifiers=1&productName=${encodeURIComponent(product.name)}`,
      );
      const groups = await res.json();
      if (!res.ok || !Array.isArray(groups) || groups.length === 0) {
        if (wantsQtyPanel) {
          // トッピングが無くても数量パネルは開いたまま
          setModifierGroups([]);
          if (!res.ok) {
            setToast(groups?.error ?? "オプションの読み込みに失敗");
            setTimeout(() => setToast(""), 1200);
          }
          return;
        }
        setPanelProduct(null);
        setAddingId(product.id);
        const ok = await addItems([{ productId: product.id, quantity: 1 }], false);
        setAddingId(null);
        if (ok) {
          setToast(`${product.name} を追加`);
          setTimeout(() => setToast(""), 900);
        } else if (!res.ok) {
          setToast(groups?.error ?? "トッピングの読み込みに失敗");
        }
        return;
      }
      setModifierGroups(groups);
      // 味（replacesMain）は追加料金ではなく本体の選択。デフォルトで現商品 or 先頭を選ぶ
      const defaults = new Set<string>();
      const flavorGroup = (groups as ModifierGroup[]).find((g) => g.replacesMain);
      if (flavorGroup?.items.length) {
        const preferred =
          flavorGroup.items.find((i) => i.id === product.id) ?? flavorGroup.items[0];
        if (preferred) defaults.add(preferred.id);
      }
      for (const group of groups as ModifierGroup[]) {
        const included = group.items.find((i) => i.included);
        if (included) defaults.add(included.id);
      }
      setSelectedModifiers(defaults);
    } catch {
      if (wantsQtyPanel) {
        setModifierGroups([]);
        setToast("オプションの読み込みに失敗（数量は選べます）");
        setTimeout(() => setToast(""), 1200);
      } else {
        setPanelProduct(null);
        setToast("トッピングの読み込みに失敗");
      }
    } finally {
      setPanelLoading(false);
    }
  }

  function toggleModifier(id: string, group: ModifierGroup) {
    setSelectedModifiers((prev) => {
      const next = new Set(prev);
      if (group.selection === "single") {
        for (const item of group.items) next.delete(item.id);
        next.add(id);
        return next;
      }
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function panelItems() {
    if (!panelProduct) return [];
    // 味選択（replacesMain）は本体SKUの差し替え＋伝票に味を印字
    const flavorGroup = modifierGroups.find((g) => g.replacesMain);
    const flavor = flavorGroup?.items.find((m) => selectedModifiers.has(m.id));
    const mainId = flavor?.id ?? panelProduct.id;
    const mods: { id: string; name: string; bill?: boolean }[] = [];
    // イートイン／テイクアウトの味は必ず注記（課金なし・本体IDと衝突させない）
    if (flavor) {
      const label = flavor.displayName ?? flavor.name;
      mods.push({
        id: `__flavor__:${label}`,
        name: label,
        bill: false,
      });
    }
    for (const group of modifierGroups) {
      if (group.replacesMain) continue;
      for (const m of group.items) {
        if (!selectedModifiers.has(m.id)) continue;
        // あんみつ等のソフト味（flavorChoice）も注記のみ
        if (group.flavorChoice) {
          const label = m.displayName ?? m.name;
          mods.push({
            id: m.id === mainId ? `__flavor__:${label}` : m.id,
            name: label,
            bill: false,
          });
          continue;
        }
        if (m.included) continue;
        mods.push({ id: m.id, name: m.displayName ?? m.name });
      }
    }
    return buildOrderItemsWithModifiers({ id: mainId, quantity: panelQty }, mods);
  }

  const panelUnitPrice = useMemo(() => {
    if (!panelProduct) return 0;
    const flavor = modifierGroups
      .find((g) => g.replacesMain)
      ?.items.find((m) => selectedModifiers.has(m.id));
    const extra = modifierGroups
      .filter((g) => !g.replacesMain && !g.flavorChoice)
      .flatMap((g) => g.items)
      .filter((m) => selectedModifiers.has(m.id) && !m.included)
      .reduce((s, m) => s + m.price, 0);
    return (flavor?.price ?? panelProduct.price) + extra;
  }, [panelProduct, modifierGroups, selectedModifiers]);

  function requestPanelSend() {
    if (loadWaiterOrderSettings().confirmBeforeSend) {
      setShowSendConfirm(true);
      return;
    }
    void commitPanel(true);
  }

  async function commitPanel(sendNow: boolean) {
    const items = panelItems();
    if (items.length === 0 || panelLoading) return;
    const name = panelProduct?.name;
    setPanelLoading(true);
    try {
      const ok = await addItems(items, sendNow);
      if (ok) {
        setPanelProduct(null);
        setShowSendConfirm(false);
        setToast(sendNow ? "キッチンに送信しました" : `${name} を追加`);
        setTimeout(() => setToast(""), 1000);
        if (sendNow) {
          setTimeout(() => router.push(`/waiter/order/${tableId}`), 600);
        }
      }
    } finally {
      setPanelLoading(false);
    }
  }

  async function sendPending() {
    if (sending) return;
    setSending(true);
    try {
      const orderRes = await waiterFetch(`/api/waiter/orders?tableId=${tableId}`);
      const order = await orderRes.json();
      if (!order?.id) {
        setToast("注文がありません");
        setShowSendConfirm(false);
        return;
      }
      const res = await waiterFetch("/api/waiter/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", orderId: order.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        setToast(data.error ?? "送信に失敗しました");
        return;
      }
      setPanelProduct(null);
      setToast("キッチンに送信しました");
      setTimeout(() => router.push(`/waiter/order/${tableId}`), 600);
    } catch {
      setToast("送信に失敗しました");
    } finally {
      setSending(false);
      setShowSendConfirm(false);
    }
  }

  const titlePrefix = eatInType === "TAKEOUT" ? "テイクアウト" : "イートイン";

  if (loading) {
    return (
      <div className="flex h-dvh flex-col bg-white">
        <header
          className="waiter-top-bar flex shrink-0 items-center justify-center px-3 text-white"
          style={{ backgroundColor: POS_ACCENT }}
        >
          <h1 className="text-[16px] font-semibold">メニュー</h1>
        </header>
        <div className="flex flex-1 items-center justify-center text-[15px] text-stone-400">
          読み込み中…
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white p-6 text-center">
        <p className="text-stone-600">{loadError}</p>
        <button
          type="button"
          onClick={load}
          className="mt-4 rounded-lg bg-[var(--pos-accent)] px-6 py-2.5 text-white"
        >
          再読み込み
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-white">
      <header
        className="waiter-top-bar flex shrink-0 items-center px-3 text-white"
        style={{ backgroundColor: POS_ACCENT }}
      >
        <button
          type="button"
          onClick={() => router.push(`/waiter/order/${tableId}`)}
          className="waiter-header-btn min-w-[72px] text-left text-[15px]"
        >
          ‹ 概要
        </button>
        <h1 className="flex-1 truncate text-center text-[16px] font-semibold">
          {titlePrefix} : {tableName}
        </h1>
        <button
          type="button"
          onClick={() => router.push("/waiter/tables")}
          className="waiter-header-btn min-w-[72px] justify-end text-right text-[15px]"
        >
          終了
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav className="w-[104px] shrink-0 overflow-y-auto bg-[#4b4b46]">
          {menu.map((cat) => {
            const active = cat.id === activeCatId;
            const badge = pendingByCategory.get(cat.id) ?? 0;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCatId(cat.id)}
                className={`relative block w-full border-b border-black/20 px-2 py-[18px] text-center text-[13px] leading-tight ${
                  active ? "bg-[#37372f] font-semibold text-white" : "text-stone-200"
                }`}
              >
                {badge > 0 && (
                  <span className="absolute left-1 top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
                    {badge}
                  </span>
                )}
                {cat.name}
                {active && (
                  <span className="absolute -right-[7px] top-1/2 h-3.5 w-3.5 -translate-y-1/2 rotate-45 bg-white" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 flex-1 overflow-y-auto bg-white pb-24">
          {menu.length === 0 && (
            <p className="px-4 py-12 text-center text-[14px] text-stone-400">メニューが登録されていません</p>
          )}
          {activeCat && activeCat.products.length === 0 && (
            <p className="px-4 py-12 text-center text-[14px] text-stone-400">このカテゴリに商品がありません</p>
          )}
          {activeCat?.products.map((product) => (
            <div
              key={product.id}
              className={`flex items-stretch border-b border-stone-200 ${
                product.soldOut ? "bg-stone-100" : "bg-white"
              }`}
            >
              <button
                type="button"
                disabled={product.soldOut || addingId === product.id || sending}
                onClick={() => tapProduct(product)}
                className="flex min-w-0 flex-1 items-center px-4 py-3 text-left active:bg-[var(--pos-accent-soft)] disabled:opacity-70"
              >
                <div className="min-w-0 flex-1">
                  <p className={`text-[16px] font-medium ${product.soldOut ? "text-stone-400" : "text-stone-900"}`}>
                    {product.name}
                  </p>
                  <p className="mt-1 flex items-center gap-2 text-[14px] text-stone-500">
                    {formatYen(product.price)}
                    {product.soldOut && (
                      <span className="rounded bg-red-500 px-1.5 py-0.5 text-[11px] font-bold leading-none text-white">
                        売切
                      </span>
                    )}
                  </p>
                </div>
                {activeCat.hasModifiers && !product.soldOut && (
                  <span className="ml-2 shrink-0 rounded bg-stone-100 px-2 py-0.5 text-[11px] text-stone-500">
                    トッピング
                  </span>
                )}
              </button>
              <button
                type="button"
                disabled={soldOutId === product.id}
                onClick={() => void toggleSoldOut(product)}
                title={product.soldOut ? "販売を再開" : "売り切れたらタップ"}
                className={`w-[72px] shrink-0 border-l border-stone-200 text-[11px] font-medium disabled:opacity-50 ${
                  product.soldOut
                    ? "bg-emerald-50 text-emerald-800"
                    : "bg-white text-stone-400 active:bg-stone-50"
                }`}
              >
                {soldOutId === product.id ? "…" : product.soldOut ? "再開" : "売切にする"}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="pb-safe z-30 flex shrink-0 border-t border-stone-300 bg-white">
        <button
          type="button"
          disabled={sending || pendingCount === 0}
          onClick={() => {
            if (loadWaiterOrderSettings().confirmBeforeSend) {
              setShowSendConfirm(true);
            } else {
              void sendPending();
            }
          }}
          className="flex flex-1 items-center justify-center gap-1.5 py-3.5 text-[15px] font-semibold text-[var(--pos-accent)] active:bg-[var(--pos-accent-soft)] disabled:text-stone-300"
        >
          ☑ 今すぐ注文{pendingCount > 0 && `（${pendingCount}点）`}
        </button>
        <div className="my-2.5 w-px bg-stone-200" />
        <button
          type="button"
          disabled={sending || !!addingId}
          onClick={() => router.push(`/waiter/order/${tableId}`)}
          className="flex flex-1 items-center justify-center gap-1.5 py-3.5 text-[15px] font-semibold text-stone-800 disabled:text-stone-300"
        >
          📝 注文画面へ
        </button>
      </div>

      {panelProduct && (
        <div className="fixed inset-0 z-40 flex justify-center">
          <div className="relative flex h-full w-full max-w-[var(--waiter-width)] flex-col">
            <button
              type="button"
              aria-label="閉じる"
              onClick={() => setPanelProduct(null)}
              className="min-h-0 flex-1 bg-black/30"
            />
            <div className="flex max-h-[min(85dvh,100%)] shrink-0 flex-col overflow-hidden rounded-t-2xl bg-white shadow-[0_-4px_24px_rgba(0,0,0,0.15)]">
              <div
                className="waiter-top-bar flex shrink-0 items-center px-3 text-white"
                style={{ backgroundColor: POS_ACCENT }}
              >
                <div className="min-w-[32px]" />
                <span className="flex-1 truncate text-center text-[16px] font-semibold">
                  {panelProduct.name}
                </span>
                <button
                  type="button"
                  onClick={() => setPanelProduct(null)}
                  className="waiter-header-btn min-w-[44px] justify-end text-right text-[22px] leading-none"
                  aria-label="閉じる"
                >
                  ×
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <div className="flex items-center border-b border-stone-200 bg-white px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[16px] font-medium text-stone-900">{panelProduct.name}</p>
                    <p className="mt-1 text-[14px] text-stone-500">{formatYen(panelUnitPrice)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setPanelQty((q) => Math.max(1, q - 1))}
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-stone-300 text-[18px] text-stone-600"
                    >
                      −
                    </button>
                    <span className="min-w-[36px] text-center text-[15px] font-semibold text-[var(--pos-accent)]">
                      {panelQty}点
                    </span>
                    <button
                      type="button"
                      onClick={() => setPanelQty((q) => q + 1)}
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-stone-300 text-[18px] text-stone-600"
                    >
                      ＋
                    </button>
                  </div>
                </div>

                {panelLoading ? (
                  <p className="px-4 py-6 text-center text-[14px] text-stone-400">読み込み中…</p>
                ) : modifierGroups.length === 0 ? (
                  <p className="px-4 py-6 text-center text-[14px] text-stone-400">
                    {activeCat?.name === "ドリンク"
                      ? "数量を選んで追加してください"
                      : "トッピングはありません"}
                  </p>
                ) : (
                  modifierGroups.map((group) => (
                    <div key={group.name}>
                      <div className="bg-stone-100 px-4 py-1.5 text-[12px] font-medium text-stone-600">
                        {group.name}
                        {group.selection === "single" && (
                          <span className="ml-2 font-normal text-stone-400">
                            {group.replacesMain || group.flavorChoice
                              ? "選択（料金は変わりません）"
                              : "1つだけ"}
                          </span>
                        )}
                      </div>
                      {group.items.map((item) => {
                        const selected = selectedModifiers.has(item.id);
                        const label = item.displayName ?? item.name;
                        const priceLabel = group.replacesMain || group.flavorChoice
                          ? null
                          : item.price === 0
                            ? "追加料金なし"
                            : `${item.price >= 0 ? "+" : ""}${formatYen(item.price)}`;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            disabled={item.soldOut}
                            onClick={() => toggleModifier(item.id, group)}
                            className={`flex w-full items-center border-b border-stone-100 px-4 py-3 text-left disabled:opacity-40 ${
                              selected ? "bg-[var(--pos-accent-soft)] ring-1 ring-inset ring-[var(--pos-accent)]/40" : "bg-white"
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-[16px] text-stone-900">
                                {label}
                                {item.soldOut && (
                                  <span className="ml-2 text-[11px] font-bold text-red-500">売切</span>
                                )}
                              </p>
                              {priceLabel && (
                                <p className="mt-0.5 text-[14px] text-stone-500">{priceLabel}</p>
                              )}
                            </div>
                            {selected && (
                              <span className="ml-2 shrink-0 text-[16px] font-bold text-[var(--pos-accent)]">
                                {group.selection === "single" ? "●" : "✓"}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>

              <div className="pb-safe shrink-0 border-t border-stone-200 bg-white">
                <div className="flex">
                  <button
                    type="button"
                  disabled={panelLoading}
                  onClick={requestPanelSend}
                    className="flex flex-1 items-center justify-center gap-1.5 py-3.5 text-[15px] font-semibold text-[var(--pos-accent)] disabled:opacity-50"
                  >
                    {panelLoading ? "処理中…" : "☑ 今すぐ注文"}
                  </button>
                  <div className="my-2.5 w-px bg-stone-200" />
                  <button
                    type="button"
                    disabled={panelLoading}
                    onClick={() => commitPanel(false)}
                    className="flex flex-1 items-center justify-center gap-1.5 py-3.5 text-[15px] font-semibold text-stone-800 disabled:opacity-50"
                  >
                    リストに追加
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSendConfirm && (
        <ConfirmDialog
          title={panelProduct ? "この内容をキッチンに送信しますか？" : "注文を送信しますか？"}
          onConfirm={() => {
            if (sending || panelLoading) return;
            if (panelProduct) void commitPanel(true);
            else void sendPending();
          }}
          onCancel={() => {
            if (sending || panelLoading) return;
            setShowSendConfirm(false);
          }}
          confirmLabel={sending || panelLoading ? "送信中…" : "送信"}
        >
          <p className="text-[15px]">
            {panelProduct
              ? `${panelProduct.name} ${panelQty}点をキッチンに送信します`
              : `未送信 ${pendingCount}点をキッチンに送信します`}
          </p>
        </ConfirmDialog>
      )}

      <Toast message={toast} onClose={() => setToast("")} />
    </div>
  );
}
