"use client";

import { useCallback, useEffect, useState } from "react";
import { WaiterHeader } from "@/components/waiter/waiter-ui";
import { formatSmaregiYen } from "@/lib/format";
import { waiterFetch } from "@/lib/waiter-api";

type Product = {
  id: string;
  name: string;
  price: number;
  priceDineIn?: number;
  priceTakeout?: number | null;
  soldOut: boolean;
  isModifier?: boolean;
};
type Category = {
  id: string;
  name: string;
  productCount?: number;
  soldOutCount?: number;
  badge?: string;
};

export default function WaiterMenuStatusPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCat, setActiveCat] = useState<Category | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [priceDineIn, setPriceDineIn] = useState("");
  const [priceTakeout, setPriceTakeout] = useState("");
  const [toast, setToast] = useState("");

  const loadCategories = useCallback(async () => {
    setError("");
    setPageLoading(true);
    try {
      const res = await waiterFetch("/api/waiter/menu");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "メニューの読み込みに失敗しました");
        return;
      }
      setCategories(Array.isArray(data) ? data : []);
    } catch {
      setError("メニューの読み込みに失敗しました");
    } finally {
      setPageLoading(false);
    }
  }, []);

  const loadProducts = useCallback(async (category: Category) => {
    setError("");
    setPageLoading(true);
    try {
      const res = await waiterFetch(`/api/waiter/menu?categoryId=${category.id}&all=1`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "メニューの読み込みに失敗しました");
        return;
      }
      setProducts(Array.isArray(data) ? data : []);
    } catch {
      setError("メニューの読み込みに失敗しました");
    } finally {
      setPageLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  async function patchProduct(
    productId: string,
    patch: { status?: string; priceDineIn?: number; priceTakeout?: number | null },
  ) {
    const res = await waiterFetch("/api/waiter/products", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, ...patch }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "更新に失敗しました");
    return data as {
      id: string;
      priceDineIn: number;
      priceTakeout: number | null;
      status: string;
    };
  }

  async function toggleSoldOut(product: Product) {
    const next = product.soldOut ? "ACTIVE" : "SOLD_OUT";
    setLoadingId(product.id);
    try {
      await patchProduct(product.id, { status: next });
      const soldOut = next === "SOLD_OUT";
      setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, soldOut } : p)));
      setCategories((prev) =>
        prev.map((c) => {
          if (!activeCat || c.id !== activeCat.id) return c;
          const soldOutCount = Math.max(0, (c.soldOutCount ?? 0) + (soldOut ? 1 : -1));
          return {
            ...c,
            soldOutCount,
            badge: soldOutCount > 0 ? `売切: ${soldOutCount}` : undefined,
          };
        }),
      );
      setEditTarget((cur) => (cur?.id === product.id ? { ...cur, soldOut } : cur));
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新に失敗しました");
    } finally {
      setLoadingId(null);
    }
  }

  function openEditor(product: Product) {
    setEditTarget(product);
    setPriceDineIn(String(product.priceDineIn ?? product.price));
    setPriceTakeout(product.priceTakeout != null ? String(product.priceTakeout) : "");
  }

  async function savePrice() {
    if (!editTarget) return;
    const dineIn = Number(priceDineIn);
    if (!Number.isFinite(dineIn)) {
      setError("イートイン価格を入力してください");
      return;
    }
    const takeoutRaw = priceTakeout.trim();
    const takeout = takeoutRaw === "" ? null : Number(takeoutRaw);
    if (takeout !== null && !Number.isFinite(takeout)) {
      setError("テイクアウト価格が不正です");
      return;
    }

    setLoadingId(editTarget.id);
    setError("");
    try {
      const updated = await patchProduct(editTarget.id, {
        priceDineIn: Math.round(dineIn),
        priceTakeout: takeout === null ? null : Math.round(takeout),
      });
      setProducts((prev) =>
        prev.map((p) =>
          p.id === editTarget.id
            ? {
                ...p,
                price: updated.priceDineIn,
                priceDineIn: updated.priceDineIn,
                priceTakeout: updated.priceTakeout,
              }
            : p,
        ),
      );
      setEditTarget(null);
      setToast("価格を更新しました");
      setTimeout(() => setToast(""), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新に失敗しました");
    } finally {
      setLoadingId(null);
    }
  }

  async function openCategory(cat: Category) {
    setActiveCat(cat);
    await loadProducts(cat);
  }

  function backToCategories() {
    setActiveCat(null);
    setProducts([]);
    setEditTarget(null);
    void loadCategories();
  }

  if (!activeCat) {
    return (
      <div className="min-h-screen bg-[var(--pos-bg)] pb-8">
        <WaiterHeader title="カテゴリー" backHref="/waiter" onRefresh={() => void loadCategories()} />

        {error && (
          <p className="mx-4 mt-3 rounded-lg bg-red-50 px-4 py-2 text-[13px] text-red-700">{error}</p>
        )}

        {pageLoading ? (
          <p className="py-16 text-center text-stone-400">読み込み中…</p>
        ) : categories.length === 0 ? (
          <p className="py-16 text-center text-stone-400">メニューが登録されていません</p>
        ) : (
          categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => void openCategory(cat)}
              className="flex w-full items-center border-b border-[var(--pos-line)] bg-[var(--pos-surface)] px-4 py-3.5 text-left active:bg-stone-50"
            >
              <span className="min-w-0 flex-1 text-[16px] text-stone-900">{cat.name}</span>
              {cat.badge && (
                <span className="mr-2 shrink-0 rounded bg-red-500 px-1.5 py-0.5 text-[11px] font-bold leading-none text-white">
                  {cat.badge}
                </span>
              )}
              <span className="shrink-0 text-[16px] text-stone-300">›</span>
            </button>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--pos-bg)] pb-8">
      <WaiterHeader
        title="メニュー一覧"
        backLabel="カテゴリー"
        onBack={backToCategories}
        onRefresh={() => void loadProducts(activeCat)}
      />

      {error && (
        <p className="mx-4 mt-3 rounded-lg bg-red-50 px-4 py-2 text-[13px] text-red-700">{error}</p>
      )}
      {toast && (
        <p className="mx-4 mt-3 rounded-lg bg-emerald-50 px-4 py-2 text-center text-[13px] text-emerald-800">
          {toast}
        </p>
      )}

      {pageLoading ? (
        <p className="py-16 text-center text-stone-400">読み込み中…</p>
      ) : products.length === 0 ? (
        <p className="py-16 text-center text-stone-400">このカテゴリに商品がありません</p>
      ) : (
        products.map((product) => (
          <button
            key={product.id}
            type="button"
            disabled={loadingId === product.id}
            onClick={() => openEditor(product)}
            className={`flex w-full items-center border-b border-[var(--pos-line)] px-4 py-3 text-left active:bg-stone-50 disabled:opacity-50 ${
              product.soldOut ? "bg-stone-100" : "bg-[var(--pos-surface)]"
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className={`text-[16px] ${product.soldOut ? "text-stone-400" : "text-stone-900"}`}>
                {product.name}
              </p>
              <p className="mt-0.5 flex items-center gap-2 text-[13px] text-stone-400">
                <span>{formatSmaregiYen(product.price)}</span>
                {product.isModifier && (
                  <span className="rounded bg-stone-200 px-1.5 py-0.5 text-[10px] font-medium text-stone-600">
                    {product.price < 0 ? "値引き" : "オプション"}
                  </span>
                )}
                {product.soldOut && (
                  <span className="rounded bg-red-500 px-1.5 py-0.5 text-[11px] font-bold leading-none text-white">
                    売切
                  </span>
                )}
              </p>
            </div>
            <span className="ml-2 shrink-0 text-[16px] text-stone-300">›</span>
          </button>
        ))
      )}

      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40">
          <div className="pb-safe w-full rounded-t-2xl bg-white p-6">
            <h2 className="text-[18px] font-bold">{editTarget.name}</h2>
            <p className="mt-1 text-[13px] text-stone-500">
              売切と価格は注文画面にすぐ反映されます
            </p>

            <button
              type="button"
              disabled={loadingId === editTarget.id}
              onClick={() => void toggleSoldOut(editTarget)}
              className={`mt-4 w-full rounded-xl py-3.5 text-[15px] font-semibold disabled:opacity-50 ${
                editTarget.soldOut
                  ? "bg-red-500 text-white"
                  : "bg-emerald-50 text-emerald-800"
              }`}
            >
              {editTarget.soldOut ? "売切中 — タップで販売再開" : "販売中 — タップで売切にする"}
            </button>

            <label className="mt-5 block text-[13px] font-medium text-stone-600">
              イートイン価格
              <input
                type="number"
                inputMode="numeric"
                value={priceDineIn}
                onChange={(e) => setPriceDineIn(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-stone-300 px-4 py-3 text-[18px] tabular-nums"
              />
            </label>

            <label className="mt-4 block text-[13px] font-medium text-stone-600">
              テイクアウト価格（空欄でイートインと同じ）
              <input
                type="number"
                inputMode="numeric"
                value={priceTakeout}
                onChange={(e) => setPriceTakeout(e.target.value)}
                placeholder="未設定"
                className="mt-1.5 w-full rounded-lg border border-stone-300 px-4 py-3 text-[18px] tabular-nums"
              />
            </label>

            {editTarget.isModifier && (
              <p className="mt-3 text-[12px] text-stone-400">
                オプション・値引きはマイナス価格も設定できます（例: -50）
              </p>
            )}

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="flex-1 rounded-lg border border-stone-300 py-3 text-[15px]"
              >
                閉じる
              </button>
              <button
                type="button"
                disabled={loadingId === editTarget.id}
                onClick={() => void savePrice()}
                className="flex-1 rounded-lg bg-[var(--pos-accent)] py-3 text-[15px] font-semibold text-white disabled:opacity-50"
              >
                価格を保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
