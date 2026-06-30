"use client";

import { useEffect, useState } from "react";
import { WaiterHeader } from "@/components/waiter/waiter-ui";

export default function WaiterDataSettingsPage() {
  const [info, setInfo] = useState({ products: 0, tables: 0, synced: true });

  useEffect(() => {
    Promise.all([
      fetch("/api/waiter/menu").then((r) => r.json()),
      fetch("/api/waiter/tables").then((r) => r.json()),
    ]).then(([cats, tables]) => {
      setInfo({
        products: cats.reduce((s: number, c: { productCount: number }) => s + c.productCount, 0),
        tables: tables.length,
        synced: true,
      });
    });
  }, []);

  return (
    <div className="min-h-screen bg-[#efefef]">
      <WaiterHeader title="データ管理" backHref="/waiter/settings" />
      <div className="mt-0 bg-white">
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-4">
          <span className="text-[17px]">店舗</span>
          <span className="text-[14px] text-stone-400">{new Date().toLocaleString("ja-JP")}</span>
        </div>
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-4">
          <span className="text-[17px]">メニュー（{info.products}品）</span>
          <span className="text-[14px] text-stone-400">{new Date().toLocaleString("ja-JP")}</span>
        </div>
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-4">
          <span className="text-[17px]">テーブル（{info.tables}席）</span>
          <span className="text-[14px] text-blue-500">同期済 ✓</span>
        </div>
      </div>
    </div>
  );
}
