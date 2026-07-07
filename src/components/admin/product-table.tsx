"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatYen, PRODUCT_STATUS_LABELS } from "@/lib/format";

type Product = {
  id: string;
  name: string;
  priceDineIn: number;
  costAmount: number | null;
  status: string;
  category: { name: string } | null;
  externalMapping: { externalProductId: string }[];
};

const STATUS_CYCLE: Record<string, string> = {
  ACTIVE: "SOLD_OUT",
  SOLD_OUT: "HIDDEN",
  HIDDEN: "ACTIVE",
};

export function ProductTable({ products }: { products: Product[] }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function toggleStatus(product: Product) {
    const next = STATUS_CYCLE[product.status] ?? "ACTIVE";
    setLoadingId(product.id);
    try {
      await fetch("/api/admin/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, status: next }),
      });
      router.refresh();
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="bg-stone-50 text-left text-stone-600">
          <tr>
            {["商品名", "カテゴリ", "価格", "原価", "状態", "スマレジID", ""].map((h) => (
              <th key={h} className="px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id} className="border-t border-stone-100">
              <td className="px-4 py-3 text-stone-800">{p.name}</td>
              <td className="px-4 py-3 text-stone-800">{p.category?.name ?? "—"}</td>
              <td className="px-4 py-3 text-stone-800">{formatYen(p.priceDineIn)}</td>
              <td className="px-4 py-3 text-stone-800">
                {p.costAmount != null ? formatYen(p.costAmount) : "—"}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    p.status === "ACTIVE"
                      ? "bg-emerald-50 text-emerald-700"
                      : p.status === "SOLD_OUT"
                        ? "bg-red-50 text-red-600"
                        : "bg-stone-100 text-stone-500"
                  }`}
                >
                  {PRODUCT_STATUS_LABELS[p.status] ?? p.status}
                </span>
              </td>
              <td className="px-4 py-3 text-stone-500">
                {p.externalMapping[0]?.externalProductId ?? "—"}
              </td>
              <td className="px-4 py-3">
                <button
                  type="button"
                  disabled={loadingId === p.id}
                  onClick={() => toggleStatus(p)}
                  className="rounded-lg border border-stone-200 px-3 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                >
                  切替
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
