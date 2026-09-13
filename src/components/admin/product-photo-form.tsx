"use client";

import { useMemo, useRef, useState } from "react";
import { formatYen } from "@/lib/format";
import { productPhotoUrl } from "@/lib/product-photo-url";

export type PhotoProduct = {
  id: string;
  name: string;
  priceDineIn: number;
  imagePath: string | null;
  updatedAt: string;
  categoryName: string;
};

export function ProductPhotoForm({ products }: { products: PhotoProduct[] }) {
  const [rows, setRows] = useState(products);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("");
  const inputById = useRef<Map<string, HTMLInputElement>>(new Map());

  const grouped = useMemo(() => {
    const q = filter.trim();
    const visible = q ? rows.filter((p) => p.name.includes(q) || p.categoryName.includes(q)) : rows;
    const map = new Map<string, PhotoProduct[]>();
    for (const product of visible) {
      const list = map.get(product.categoryName) ?? [];
      list.push(product);
      map.set(product.categoryName, list);
    }
    return [...map.entries()];
  }, [rows, filter]);

  function showMessage(text: string) {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 2500);
  }

  async function upload(product: PhotoProduct, file: File) {
    setBusyId(product.id);
    try {
      const body = new FormData();
      body.set("productId", product.id);
      body.set("file", file);
      const res = await fetch("/api/admin/products/photo", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "アップロードに失敗しました");
      setRows((prev) =>
        prev.map((row) =>
          row.id === product.id
            ? { ...row, imagePath: `${product.id}.jpg`, updatedAt: data.updatedAt ?? new Date().toISOString() }
            : row,
        ),
      );
      showMessage(`${product.name} の写真を保存しました`);
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "アップロードに失敗しました");
    } finally {
      setBusyId(null);
    }
  }

  async function removePhoto(product: PhotoProduct) {
    if (!confirm(`${product.name} の写真を削除しますか？`)) return;
    setBusyId(product.id);
    try {
      const res = await fetch("/api/admin/products/photo", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "削除に失敗しました");
      setRows((prev) =>
        prev.map((row) => (row.id === product.id ? { ...row, imagePath: null } : row)),
      );
      showMessage("写真を削除しました");
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "削除に失敗しました");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="商品名で検索"
          className="admin-input max-w-sm"
        />
        {message && <p className="text-sm text-[var(--admin-sage)]">{message}</p>}
      </div>

      {grouped.map(([category, items]) => (
        <section key={category} className="mb-8">
          <h2 className="mb-3 text-sm font-medium text-[var(--admin-muted)]">{category}</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((product) => {
              const busy = busyId === product.id;
              return (
                <article key={product.id} className="admin-card overflow-hidden">
                  <div className="flex gap-3 p-3">
                    <div className="h-24 w-24 shrink-0 overflow-hidden rounded-md bg-[#ececec]">
                      {product.imagePath ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={productPhotoUrl(product.id, product.updatedAt)}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[11px] text-[var(--admin-muted)]">
                          未登録
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-[var(--admin-ink)]">{product.name}</p>
                      <p className="mt-0.5 text-sm tabular-nums text-[var(--admin-muted)]">
                        {formatYen(product.priceDineIn)}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <input
                          ref={(el) => {
                            if (el) inputById.current.set(product.id, el);
                            else inputById.current.delete(product.id);
                          }}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            if (file) void upload(product, file);
                          }}
                        />
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => inputById.current.get(product.id)?.click()}
                          className="admin-btn admin-btn--ghost !px-3 !py-1 !text-xs"
                        >
                          {busy ? "処理中…" : product.imagePath ? "写真を差し替え" : "写真を選ぶ"}
                        </button>
                        {product.imagePath && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void removePhoto(product)}
                            className="admin-btn admin-btn--ghost !px-3 !py-1 !text-xs !text-[var(--admin-vermillion)]"
                          >
                            削除
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
