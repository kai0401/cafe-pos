"use client";

import { WaiterHeader, WaiterRow } from "@/components/waiter/waiter-ui";

export default function WaiterOrderSettingsPage() {
  return (
    <div className="min-h-screen bg-[#efefef]">
      <WaiterHeader title="注文設定" backHref="/waiter/settings" />
      <div className="bg-white">
        <div className="border-b border-stone-200 px-4 py-4">
          <p className="text-[13px] text-stone-500">メニュー注文画面タイプ</p>
          <p className="mt-1 text-[17px]">タブタイプ → カテゴリー一覧方式</p>
        </div>
        <div className="border-b border-stone-200 px-4 py-4">
          <p className="text-[13px] text-stone-500">メニュー選択モード</p>
          <p className="mt-1 text-[17px]">行タッチ</p>
        </div>
        <div className="border-b border-stone-200 px-4 py-4">
          <p className="text-[13px] text-stone-500">確認ダイアログ</p>
          <p className="mt-1 text-[17px]">注文送信前 / 取引中止時</p>
        </div>
      </div>
    </div>
  );
}
