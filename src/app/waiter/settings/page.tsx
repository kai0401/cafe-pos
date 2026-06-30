"use client";

import Link from "next/link";
import { WaiterHeader, WaiterRow } from "@/components/waiter/waiter-ui";

export default function WaiterSettingsPage() {
  return (
    <div className="min-h-screen bg-[#efefef]">
      <WaiterHeader title="設定" backHref="/waiter" />
      <WaiterRow label="注文設定" href="/waiter/settings/order" />
      <WaiterRow label="データ管理" href="/waiter/settings/data" />
      <WaiterRow label="管理画面" href="/admin/dashboard" />
    </div>
  );
}
