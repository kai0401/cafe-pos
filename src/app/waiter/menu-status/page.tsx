"use client";

import { useCallback, useEffect, useState } from "react";
import { WaiterHeader } from "@/components/waiter/waiter-ui";
import { formatYen } from "@/lib/format";

type Product = {
  id: string;
  name: string;
  price: number;
  priceDineIn?: number;
  priceTakeout?: number | null;
  soldOut: boolean;
};
type Category = { id: string; name: string; products: Product[] };

type Tab = "main" | "addon";

function formatAddonPrice(price: number) {
  if (price < 0) return `¥${price}`;
  if (price === 0) return "無料";
  return `+${formatYen(price)}`;
}

export default function WaiterMenuStatusPage() {
  const [tab, setTab] = useState<Tab>("main");
  const [mainMenu, setMainMenu] = useState<Category[]>([]);
  const [addonMenu, setAddonMenu] = useState<Category[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "soldout">("all");
  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [priceDineIn, setPriceDineIn] = useState("");
  const [priceTakeout, setPriceTakeout] = useState("");
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    setError("");
    setPageLoading(true);
    try {
      const [mainRes, addonRes] = await Promise.all([
        fetch("/api/waiter/menu?full=1"),
        fetch("/api/waiter/menu?addonMenu=1"),
      ]);
      const mainData = await mainRes.json();
      const addonData = await addonRes.json();
      if (!mainRes.ok) {
        setError(mainData.error ?? "メニューの読み込みに失敗しました");
        return;
      }
      setMainMenu(mainData);
      if (addonRes.ok) {
        setAddonMenu(addonData);
      }
    } catch {
      setError("メニューの読み込みに失敗しました");
    } finally {
      setPageLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function patchProduct(
    productId: string,
    patch: { status?: string; priceDineIn?: number; priceTakeout?: number | null },
  ) {
    const res = await fetch("/api/waiter/products", {
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

  function updateProductInMenus(
    productId: string,
    updater: (p: Product) => Product,
  ) {
    const mapCat = (cats: Category[]) =>
      cats.map((cat) => ({
        ...cat,
        products: cat.products.map((p) => (p.id === productId ? updater(p) : p)),
      }));
    setMainMenu((prev) => mapCat(prev));
    setAddonMenu((prev) => mapCat(prev));
  }

  async function toggleSoldOut(product: Product) {
    const next = product.soldOut ? "ACTIVE" : "SOLD_OUT";
    setLoadingId(product.id);
    try {
      await patchProduct(product.id, { status: next });
      updateProductInMenus(product.id, (p) => ({
        ...p,
        soldOut: next === "SOLD_OUT",
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新に失敗しました");
    } finally {
      setLoadingId(null);
    }
  }

  function openPriceEditor(product: Product) {
    setEditTarget(product);
    setPriceDineIn(String(product.priceDineIn ?? product.price));
    setPriceTakeout(
      product.priceTakeout != null ? String(product.priceTakeout) : "",
    );
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
      updateProductInMenus(editTarget.id, (p) => ({
        ...p,
        price: updated.priceDineIn,
        priceDineIn: updated.priceDineIn,
        priceTakeout: updated.priceTakeout,
      }));
      setEditTarget(null);
      setToast("価格を更新しました");
      setTimeout(() => setToast(""), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新に失敗しました");
    } finally {
      setLoadingId(null);
    }
  }

  const activeMenu = tab === "main" ? mainMenu : addonMenu;
  const soldOutCount = activeMenu.reduce(
    (sum, cat) => sum + cat.products.filter((p) => p.soldOut).length,
    0,
  );

  const visibleCategories = activeMenu
    .map((cat) => ({
      ...cat,
      products:
        filter === "soldout" ? cat.products.filter((p) => p.soldOut) : cat.products,
    }))
    .filter((cat) => cat.products.length > 0);

  return (
    <div className="min-h-screen bg-[#efefef] pb-8">
      <WaiterHeader title="メニュー管理" backHref="/waiter" onRefresh={load} />

      <div className="flex gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => setTab("main")}
          className={`rounded-full px-4 py-2.5 text-[13px] font-medium ${
            tab === "main" ? "bg-[#e8912d] text-white" : "bg-white text-stone-600"
          }`}
        >
          メイン商品
        </button>
        <button
          type="button"
          onClick={() => setTab("addon")}
          className={`rounded-full px-4 py-2.5 text-[13px] font-medium ${
            tab === "addon" ? "bg-[#e8912d] text-white" : "bg-white text-stone-600"
          }`}
        >
          追加オプション
        </button>
      </div>

      <div className="flex gap-2 px-4 pb-3">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`rounded-full px-4 py-2 text-[12px] font-medium ${
            filter === "all" ? "bg-stone-800 text-white" : "bg-white text-stone-600"
          }`}
        >
          すべて
        </button>
        <button
          type="button"
          onClick={() => setFilter("soldout")}
          className={`rounded-full px-4 py-2 text-[12px] font-medium ${
            filter === "soldout" ? "bg-red-500 text-white" : "bg-white text-stone-600"
          }`}
        >
          売切のみ{soldOutCount > 0 ? ` (${soldOutCount})` : ""}
        </button>
      </div>

      {tab === "addon" && (
        <p className="mx-4 mb-3 text-[12px] leading-relaxed text-stone-500">
          トッピング・オプションの追加価格をタップして変更できます（マイナスは値引き）
        </p>
      )}

      {error && (
        <p className="mx-4 mb-3 rounded-lg bg-red-50 px-4 py-2 text-[13px] text-red-700">{error}</p>
      )}
      {toast && (
        <p className="mx-4 mb-3 rounded-lg bg-emerald-50 px-4 py-2 text-center text-[13px] text-emerald-800">
          {toast}
        </p>
      )}

      {pageLoading ? (
        <p className="py-16 text-center text-stone-400">読み込み中…</p>
      ) : activeMenu.length === 0 && !error ? (
        <p className="py-16 text-center text-stone-400">
          {tab === "addon" ? "追加オプションはありません" : "メニューが登録されていません"}
        </p>
      ) : visibleCategories.length === 0 ? (
        <p className="py-16 text-center text-stone-400">
          {filter === "soldout" ? "売切の商品はありません" : "表示する商品がありません"}
        </p>
      ) : (
        visibleCategories.map((cat) => (
          <section key={cat.id} className="mb-4">
            <h2 className="px-4 py-2 text-[12px] font-medium text-stone-500">{cat.name}</h2>
            <div className="bg-white">
              {cat.products.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center border-b border-stone-200 px-4 py-3"
                >
                  <button
                    type="button"
                    disabled={loadingId === product.id}
                    onClick={() => toggleSoldOut(product)}
                    className="min-w-0 flex-1 text-left active:opacity-70 disabled:opacity-50"
                  >
                    <p
                      className={`text-[16px] ${product.soldOut ? "text-stone-400 line-through" : "text-stone-900"}`}
                    >
                      {product.name}
                    </p>
                  </button>
                  <button
                    type="button"
                    disabled={loadingId === product.id}
                    onClick={() => openPriceEditor(product)}
                    className="mx-3 shrink-0 rounded-lg bg-stone-100 px-3 py-2 text-right active:bg-stone-200 disabled:opacity-50"
                  >
                    <p className="text-[15px] font-semibold tabular-nums text-[#007aff]">
                      {tab === "addon"
                        ? formatAddonPrice(product.priceDineIn ?? product.price)
                        : formatYen(product.price)}
                    </p>
                    <p className="text-[10px] text-stone-400">価格変更</p>
                  </button>
                  <button
                    type="button"
                    disabled={loadingId === product.id}
                    onClick={() => toggleSoldOut(product)}
                    className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-semibold disabled:opacity-50 ${
                      product.soldOut
                        ? "bg-red-100 text-red-700"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {product.soldOut ? "売切" : "販売中"}
                  </button>
                </div>
              ))}
            </div>
          </section>
        ))
      )}

      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40">
          <div className="pb-safe w-full rounded-t-2xl bg-white p-6">
            <h2 className="text-[18px] font-bold">{editTarget.name}</h2>
            <p className="mt-1 text-[13px] text-stone-500">価格を変更すると注文画面にすぐ反映されます</p>

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

            {tab === "addon" && (
              <p className="mt-3 text-[12px] text-stone-400">
                追加オプションはマイナス価格も設定できます（例: -50）
              </p>
            )}

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="flex-1 rounded-lg border border-stone-300 py-3 text-[15px]"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={loadingId === editTarget.id}
                onClick={() => void savePrice()}
                className="flex-1 rounded-lg bg-[#e8912d] py-3 text-[15px] font-semibold text-white disabled:opacity-50"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
