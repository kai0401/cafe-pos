"use client";

import { useEffect, useState } from "react";
import { WaiterHeader } from "@/components/waiter/waiter-ui";

export default function WaiterDataSettingsPage() {
  const [info, setInfo] = useState({ products: 0, tables: 0 });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/waiter/menu").then((r) => r.json()),
      fetch("/api/waiter/tables").then((r) => r.json()),
    ])
      .then(([cats, tables]: [{ productCount: number }[], unknown[]]) => {
        if (!Array.isArray(cats) || !Array.isArray(tables)) {
          setError("データの読み込みに失敗しました");
          return;
        }
        setInfo({
          products: cats.reduce((s, c) => s + c.productCount, 0),
          tables: tables.length,
        });
      })
      .catch(() => setError("データの読み込みに失敗しました"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#efefef]">
      <WaiterHeader title="データ管理" backHref="/waiter/settings" />
      {error && (
        <p className="mx-4 mt-3 rounded-lg bg-red-50 px-4 py-2 text-[13px] text-red-700">{error}</p>
      )}
      <div className="bg-[#efefef] px-4 py-2 text-[12px] font-medium text-stone-500">マスター</div>
      <div className="bg-white">
        {loading ? (
          <p className="px-4 py-8 text-center text-[14px] text-stone-400">読み込み中…</p>
        ) : (
          <>
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-4">
          <span className="text-[17px]">メニュー（{info.products}品）</span>
          <span className="text-[13px] text-blue-500">同期済</span>
        </div>
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-4">
          <span className="text-[17px]">テーブル（{info.tables}席）</span>
          <span className="text-[13px] text-blue-500">同期済</span>
        </div>
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-4">
          <span className="text-[17px]">取引データ</span>
          <span className="text-[13px] text-stone-400">管理画面でCSV取込</span>
        </div>
          </>
        )}
      </div>
      <p className="px-4 py-3 text-[12px] text-stone-400">
        メニュー・取引データの更新は 管理画面 → CSVインポート から行えます
      </p>
    </div>
  );
}
