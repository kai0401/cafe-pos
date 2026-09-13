"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatYen, PRODUCT_STATUS_LABELS } from "@/lib/format";
import { ADMIN_INPUT_CLASS } from "@/components/admin/ui";

type Category = { id: string; name: string };
type Product = {
  id: string;
  name: string;
  priceDineIn: number;
  priceTakeout: number | null;
  costAmount: number | null;
  status: string;
  isTopping: boolean;
  showOnQr: boolean;
  showOnWaiter: boolean;
  categoryId: string | null;
  category: { id?: string; name: string } | null;
  externalMapping: { externalProductId: string }[];
};

type Draft = {
  name: string;
  categoryId: string;
  priceDineIn: string;
  priceTakeout: string;
  isTopping: boolean;
  showOnQr: boolean;
  showOnWaiter: boolean;
  status: string;
};

const emptyDraft = (categoryId: string): Draft => ({
  name: "",
  categoryId,
  priceDineIn: "",
  priceTakeout: "",
  isTopping: false,
  showOnQr: true,
  showOnWaiter: true,
  status: "ACTIVE",
});

function toDraft(product: Product): Draft {
  return {
    name: product.name,
    categoryId: product.categoryId ?? product.category?.id ?? "",
    priceDineIn: String(product.priceDineIn),
    priceTakeout: product.priceTakeout != null ? String(product.priceTakeout) : "",
    isTopping: product.isTopping,
    showOnQr: product.showOnQr,
    showOnWaiter: product.showOnWaiter,
    status: product.status,
  };
}

function Check({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--admin-ink)]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-[var(--admin-line)]"
      />
      {label}
    </label>
  );
}

export function ProductTable({
  products,
  categories,
}: {
  products: Product[];
  categories: Category[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "main" | "topping">("all");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(emptyDraft(categories[0]?.id ?? ""));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft(categories[0]?.id ?? ""));
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const visible = useMemo(() => {
    const q = query.trim();
    return products.filter((p) => {
      if (filter === "main" && p.isTopping) return false;
      if (filter === "topping" && !p.isTopping) return false;
      if (!q) return true;
      return p.name.includes(q) || (p.category?.name ?? "").includes(q);
    });
  }, [products, filter, query]);

  async function request(method: string, body: Record<string, unknown>) {
    const res = await fetch("/api/admin/products", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "保存に失敗しました");
    return data;
  }

  async function createProduct() {
    setError("");
    setMessage("");
    setBusyId("new");
    try {
      await request("POST", {
        name: creating.name,
        categoryId: creating.categoryId,
        priceDineIn: Number(creating.priceDineIn),
        priceTakeout: creating.priceTakeout.trim() === "" ? null : Number(creating.priceTakeout),
        isTopping: creating.isTopping,
        showOnQr: creating.showOnQr,
        showOnWaiter: creating.showOnWaiter,
      });
      setCreating(emptyDraft(creating.categoryId || categories[0]?.id || ""));
      setMessage("商品を追加しました");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "追加に失敗しました");
    } finally {
      setBusyId(null);
    }
  }

  async function saveProduct(productId: string) {
    setError("");
    setMessage("");
    setBusyId(productId);
    try {
      await request("PATCH", {
        productId,
        name: draft.name,
        categoryId: draft.categoryId,
        priceDineIn: Number(draft.priceDineIn),
        priceTakeout: draft.priceTakeout.trim() === "" ? null : Number(draft.priceTakeout),
        isTopping: draft.isTopping,
        showOnQr: draft.showOnQr,
        showOnWaiter: draft.showOnWaiter,
        status: draft.status,
      });
      setEditingId(null);
      setMessage("保存しました");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setBusyId(null);
    }
  }

  async function hideProduct(productId: string) {
    if (!window.confirm("この商品を非表示にしますか？注文履歴は残ります。")) return;
    setError("");
    setBusyId(productId);
    try {
      await request("DELETE", { productId });
      setMessage("商品を非表示にしました");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新に失敗しました");
    } finally {
      setBusyId(null);
    }
  }

  function FormFields({
    value,
    onChange,
    includeStatus,
  }: {
    value: Draft;
    onChange: (next: Draft) => void;
    includeStatus?: boolean;
  }) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-xs text-[var(--admin-muted)]">
          商品名
          <input
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            className={`${ADMIN_INPUT_CLASS} mt-1`}
          />
        </label>
        <label className="block text-xs text-[var(--admin-muted)]">
          カテゴリ
          <select
            value={value.categoryId}
            onChange={(e) => onChange({ ...value, categoryId: e.target.value })}
            className={`${ADMIN_INPUT_CLASS} mt-1`}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-[var(--admin-muted)]">
          イートイン価格
          <input
            type="number"
            inputMode="numeric"
            value={value.priceDineIn}
            onChange={(e) => onChange({ ...value, priceDineIn: e.target.value })}
            className={`${ADMIN_INPUT_CLASS} mt-1`}
          />
        </label>
        <label className="block text-xs text-[var(--admin-muted)]">
          テイクアウト価格（空欄で同じ）
          <input
            type="number"
            inputMode="numeric"
            value={value.priceTakeout}
            onChange={(e) => onChange({ ...value, priceTakeout: e.target.value })}
            className={`${ADMIN_INPUT_CLASS} mt-1`}
            placeholder="未設定"
          />
        </label>
        {includeStatus && (
          <label className="block text-xs text-[var(--admin-muted)]">
            販売状態
            <select
              value={value.status}
              onChange={(e) => onChange({ ...value, status: e.target.value })}
              className={`${ADMIN_INPUT_CLASS} mt-1`}
            >
              <option value="ACTIVE">販売中</option>
              <option value="SOLD_OUT">売切</option>
              <option value="HIDDEN">非表示</option>
            </select>
          </label>
        )}
        <div className="flex flex-wrap items-end gap-4 sm:col-span-2 lg:col-span-4">
          <Check
            checked={value.isTopping}
            onChange={(isTopping) => onChange({ ...value, isTopping })}
            label="トッピング（一覧には出さず、選択画面に出す）"
          />
          <Check
            checked={value.showOnWaiter}
            onChange={(showOnWaiter) => onChange({ ...value, showOnWaiter })}
            label="ウェイターに表示"
          />
          <Check
            checked={value.showOnQr}
            onChange={(showOnQr) => onChange({ ...value, showOnQr })}
            label="QR注文に表示"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="admin-card p-5">
        <h2 className="text-sm font-semibold text-[var(--admin-ink)]">商品を追加</h2>
        <p className="mt-1 text-xs text-[var(--admin-muted)]">
          トッピングにすると、商品一覧ではなくトッピング選択に出ます。表示先はウェイターとQRで別々に選べます。
        </p>
        <div className="mt-4">
          <FormFields value={creating} onChange={setCreating} />
        </div>
        <div className="mt-4">
          <button
            type="button"
            disabled={busyId === "new" || !creating.name.trim() || !creating.categoryId}
            onClick={() => void createProduct()}
            className="admin-btn admin-btn--primary"
          >
            {busyId === "new" ? "追加中…" : "商品を追加"}
          </button>
        </div>
      </div>

      {(error || message) && (
        <p className={`text-sm ${error ? "text-[var(--admin-vermillion)]" : "text-[var(--admin-sage)]"}`}>
          {error || message}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-[var(--admin-line)] p-0.5 text-xs">
          {(
            [
              ["all", "すべて"],
              ["main", "本商品"],
              ["topping", "トッピング"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`rounded-md px-3 py-1.5 ${
                filter === id ? "bg-[var(--admin-accent-soft)] font-medium text-[var(--admin-ink)]" : "text-[var(--admin-muted)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="名前・カテゴリで検索"
          className={`${ADMIN_INPUT_CLASS} max-w-xs`}
        />
      </div>

      <div className="admin-card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b border-[var(--admin-line)] text-left text-[var(--admin-muted)]">
            <tr>
              {["商品名", "カテゴリ", "価格", "種類", "表示", "状態", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-xs font-medium tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => {
              const editing = editingId === p.id;
              return (
                <tr
                  key={p.id}
                  className="border-t border-[var(--admin-line)]/60 align-top transition-colors hover:bg-[var(--admin-accent-soft)]/40"
                >
                  {editing ? (
                    <td colSpan={7} className="px-4 py-4">
                      <FormFields value={draft} onChange={setDraft} includeStatus />
                      <div className="mt-4 flex gap-2">
                        <button
                          type="button"
                          disabled={busyId === p.id}
                          onClick={() => void saveProduct(p.id)}
                          className="admin-btn admin-btn--primary !px-4 !py-1.5 !text-xs"
                        >
                          保存
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="admin-btn admin-btn--ghost !px-4 !py-1.5 !text-xs"
                        >
                          キャンセル
                        </button>
                      </div>
                    </td>
                  ) : (
                    <>
                      <td className="px-4 py-3 font-medium text-[var(--admin-ink)]">{p.name}</td>
                      <td className="px-4 py-3 text-[var(--admin-muted)]">{p.category?.name ?? "—"}</td>
                      <td className="px-4 py-3 tabular-nums text-[var(--admin-ink)]">
                        {formatYen(p.priceDineIn)}
                        {p.priceTakeout != null && p.priceTakeout !== p.priceDineIn && (
                          <span className="ml-1 text-[var(--admin-muted)]">/ TO {formatYen(p.priceTakeout)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {p.isTopping ? (
                          <span className="admin-tag">トッピング</span>
                        ) : (
                          <span className="text-[var(--admin-muted)]">本商品</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-[var(--admin-muted)]">
                        {[p.showOnWaiter ? "ウェイター" : null, p.showOnQr ? "QR" : null]
                          .filter(Boolean)
                          .join(" / ") || "非表示"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            p.status === "ACTIVE"
                              ? "admin-tag admin-tag--sage"
                              : p.status === "SOLD_OUT"
                                ? "admin-tag !bg-[rgba(184,74,58,0.1)] !text-[var(--admin-vermillion)]"
                                : "admin-tag !bg-[rgba(138,125,112,0.12)] !text-[var(--admin-muted)]"
                          }
                        >
                          {PRODUCT_STATUS_LABELS[p.status] ?? p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="admin-btn admin-btn--ghost !px-3 !py-1 !text-xs"
                            onClick={() => {
                              setEditingId(p.id);
                              setDraft(toDraft(p));
                            }}
                          >
                            編集
                          </button>
                          {p.status !== "HIDDEN" && (
                            <button
                              type="button"
                              disabled={busyId === p.id}
                              className="admin-btn admin-btn--ghost !px-3 !py-1 !text-xs"
                              onClick={() => void hideProduct(p.id)}
                            >
                              非表示
                            </button>
                          )}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-[var(--admin-muted)]">
                  該当する商品がありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
