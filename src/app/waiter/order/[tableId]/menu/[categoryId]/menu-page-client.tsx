"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ConfirmDialog,
  PrimaryButton,
  Toast,
  WaiterBottomBar,
  WaiterHeader,
} from "@/components/waiter/waiter-ui";
import { formatYen } from "@/lib/format";
import { flushOfflineQueue, queueOfflineAction } from "@/lib/offline-queue";

type Product = { id: string; name: string; price: number; soldOut: boolean };
type ModifierGroup = { name: string; items: Product[] };

export default function MenuPageClient() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const tableId = params.tableId as string;
  const categoryId = params.categoryId as string;
  const eatInType = searchParams.get("eatInType") ?? "DINE_IN";

  const [categoryName, setCategoryName] = useState("");
  const [tableName, setTableName] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [toast, setToast] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const [modalProduct, setModalProduct] = useState<Product | null>(null);
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);
  const [modalQty, setModalQty] = useState(1);
  const [selectedModifiers, setSelectedModifiers] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const [menuRes, orderRes, catRes, tableRes] = await Promise.all([
      fetch(`/api/waiter/menu?eatInType=${eatInType}&categoryId=${categoryId}`),
      fetch(`/api/waiter/orders?tableId=${tableId}`),
      fetch(`/api/waiter/menu?eatInType=${eatInType}`),
      fetch(`/api/waiter/tables/${tableId}`),
    ]);
    setProducts(await menuRes.json());
    const order = await orderRes.json();
    const cats = await catRes.json();
    const table = await tableRes.json();
    const cat = cats.find((c: { id: string; name: string }) => c.id === categoryId);
    setCategoryName(cat?.name ?? "");
    setTableName(table.name ?? "");

    const pending = order?.items?.filter((i: { status: string }) => i.status === "PENDING") ?? [];
    setPendingCount(pending.reduce((s: number, i: { quantity: number }) => s + i.quantity, 0));
    setPendingTotal(
      pending.reduce(
        (s: number, i: { unitPrice: number; quantity: number }) => s + i.unitPrice * i.quantity,
        0,
      ),
    );
  }, [tableId, categoryId, eatInType]);

  useEffect(() => {
    flushOfflineQueue();
    load();
  }, [load]);

  async function openProductModal(product: Product) {
    if (product.soldOut) return;
    setModalProduct(product);
    setModalQty(1);
    setSelectedModifiers(new Set());
    const res = await fetch(
      `/api/waiter/menu?eatInType=${eatInType}&categoryId=${categoryId}&modifiers=1`,
    );
    setModifierGroups(await res.json());
  }

  function toggleModifier(id: string) {
    setSelectedModifiers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function allModifiers(): Product[] {
    return modifierGroups.flatMap((g) => g.items);
  }

  async function addFromModal(sendNow: boolean) {
    if (!modalProduct) return;
    setLoading(true);
    const mods = allModifiers().filter((m) => selectedModifiers.has(m.id));
    const items = [
      { productId: modalProduct.id, quantity: modalQty },
      ...mods.map((m) => ({ productId: m.id, quantity: modalQty })),
    ];
    const payload = { tableId, items };

    try {
      const res = await fetch("/api/waiter/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        if (!navigator.onLine) {
          queueOfflineAction(payload);
          setToast("オフライン保存しました");
        } else {
          const data = await res.json();
          setToast(data.error ?? "エラー");
        }
        setLoading(false);
        return;
      }
      const updated = await res.json();
      if (sendNow && updated?.id) {
        await fetch("/api/waiter/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "send", orderId: updated.id }),
        });
        setToast("キッチンに送信しました");
      } else {
        setToast(`${modalProduct.name} を追加`);
      }
    } catch {
      queueOfflineAction(payload);
      setToast("オフライン保存しました");
    }

    setLoading(false);
    setModalProduct(null);
    await load();
    setTimeout(() => setToast(""), 1200);
  }

  async function sendOrder() {
    const orderRes = await fetch(`/api/waiter/orders?tableId=${tableId}`);
    const order = await orderRes.json();
    if (!order?.id) return;

    setLoading(true);
    const res = await fetch("/api/waiter/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send", orderId: order.id }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setToast(data.error ?? "送信失敗");
      return;
    }
    setShowConfirm(false);
    setToast("キッチンに送信しました");
    setTimeout(() => router.push("/waiter/tables"), 600);
  }

  const titlePrefix = eatInType === "TAKEOUT" ? "テイクアウト" : "イートイン";

  return (
    <div className="min-h-screen bg-[#efefef] pb-36">
      <WaiterHeader
        title={`${titlePrefix} : ${tableName}`}
        backHref={`/waiter/order/${tableId}/categories`}
        onRefresh={load}
      />

      <div className="bg-white px-4 py-2 text-[15px] font-medium text-stone-600">{categoryName}</div>

      {products.map((product) => (
        <button
          key={product.id}
          type="button"
          disabled={product.soldOut || loading}
          onClick={() => openProductModal(product)}
          className="flex w-full items-center justify-between border-b border-stone-200 bg-white px-4 py-[18px] text-left active:bg-amber-50 disabled:opacity-40"
        >
          <div>
            <p className="text-[17px] text-stone-900">{product.name}</p>
            {product.soldOut && <p className="text-[12px] text-red-500">売り切れ</p>}
          </div>
          <span className="text-[17px] text-stone-600">{formatYen(product.price)}</span>
        </button>
      ))}

      {pendingCount > 0 && (
        <WaiterBottomBar>
          <div className="mb-3 flex justify-between text-[15px]">
            <span>未送信 {pendingCount}点</span>
            <span className="font-bold">{formatYen(pendingTotal)}</span>
          </div>
          <PrimaryButton onClick={() => setShowConfirm(true)} disabled={loading}>
            注文送信
          </PrimaryButton>
        </WaiterBottomBar>
      )}

      {modalProduct && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/30">
          <div className="mx-auto mt-auto flex w-full flex-col bg-white" style={{ maxHeight: "85vh" }}>
            <div className="flex h-[48px] shrink-0 items-center justify-between bg-[#e8912d] px-4 text-white">
              <span className="text-[17px] font-semibold">{modalProduct.name}</span>
              <button type="button" onClick={() => setModalProduct(null)} className="text-[24px] leading-none">
                ×
              </button>
            </div>
            <div className="overflow-y-auto">
              {modifierGroups.map((group) => (
                <div key={group.name}>
                  <div className="bg-stone-100 px-4 py-2 text-[13px] font-medium text-stone-600">{group.name}</div>
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleModifier(item.id)}
                      className={`flex w-full items-center justify-between border-b border-stone-100 px-4 py-3 text-left ${selectedModifiers.has(item.id) ? "bg-blue-50" : "bg-white"}`}
                    >
                      <span className="text-[16px]">{item.name}</span>
                      <span className="text-[15px] text-stone-600">
                        {item.price >= 0 ? "+" : ""}
                        {formatYen(Math.abs(item.price))}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
            <div className="flex shrink-0 border-t border-stone-200 bg-[#e8912d]">
              <button
                type="button"
                disabled={loading}
                onClick={() => addFromModal(true)}
                className="flex flex-1 flex-col items-center py-3 text-[13px] text-white disabled:opacity-50"
              >
                今すぐ注文
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => addFromModal(false)}
                className="flex flex-1 flex-col items-center border-l border-white/30 py-3 text-[13px] text-white disabled:opacity-50"
              >
                注文リストに追加
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirm && (
        <ConfirmDialog
          title="注文を送信しますか？"
          onConfirm={sendOrder}
          onCancel={() => setShowConfirm(false)}
          confirmLabel="送信"
        >
          <p className="text-[15px]">
            {pendingCount}点 / {formatYen(pendingTotal)}
          </p>
        </ConfirmDialog>
      )}

      <Toast message={toast} onClose={() => setToast("")} />
    </div>
  );
}
