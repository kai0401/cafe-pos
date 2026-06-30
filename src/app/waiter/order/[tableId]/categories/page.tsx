"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { WaiterHeader, WaiterRow } from "@/components/waiter/waiter-ui";

type Category = {
  id: string;
  name: string;
  productCount: number;
  badge?: string;
};

export default function CategoriesPage() {
  const params = useParams();
  const tableId = params.tableId as string;
  const [tableName, setTableName] = useState("");
  const [eatInType, setEatInType] = useState("DINE_IN");
  const [categories, setCategories] = useState<Category[]>([]);

  const load = useCallback(async () => {
    const [tableRes] = await Promise.all([
      fetch(`/api/waiter/tables/${tableId}`),
    ]);
    const table = await tableRes.json();
    setTableName(table.name ?? "");
    setEatInType(table.eatInType ?? "DINE_IN");
    const eat = table.eatInType === "TAKEOUT" ? "TAKEOUT" : "DINE_IN";
    const catRes = await fetch(`/api/waiter/menu?eatInType=${eat}`);
    setCategories(await catRes.json());
  }, [tableId]);

  useEffect(() => {
    load();
  }, [load]);

  const titlePrefix = eatInType === "TAKEOUT" ? "テイクアウト" : "イートイン";

  return (
    <div className="min-h-screen bg-[#efefef] pb-20">
      <WaiterHeader
        title={`${titlePrefix} : ${tableName}`}
        backHref="/waiter/tables"
        onRefresh={load}
      />

      {categories.map((cat) => (
        <WaiterRow
          key={cat.id}
          label={cat.name}
          sub={`${cat.productCount}品`}
          badge={cat.badge}
          href={`/waiter/order/${tableId}/menu/${cat.id}?eatInType=${eatInType}`}
        />
      ))}

      <div className="pb-safe fixed bottom-0 left-0 right-0 z-30 mx-auto flex w-full max-w-[var(--waiter-width)] border-t border-stone-300 bg-white">
        <Link
          href={`/waiter/order/${tableId}`}
          className="flex flex-1 flex-col items-center py-2 text-[11px] text-[#888]"
        >
          <span className="text-[20px]">👥</span>
          概要
        </Link>
        <div className="flex flex-1 flex-col items-center py-2 text-[11px] text-[#e8912d]">
          <span className="text-[20px]">📖</span>
          追加注文
        </div>
        <Link
          href={`/waiter/order/${tableId}?tab=history`}
          className="flex flex-1 flex-col items-center py-2 text-[11px] text-[#888]"
        >
          <span className="text-[20px]">📋</span>
          注文履歴
        </Link>
      </div>
    </div>
  );
}
