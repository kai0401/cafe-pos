"use client";

import { useEffect, useState } from "react";
import { WaiterHeader, WaiterRow } from "@/components/waiter/waiter-ui";

export default function WaiterSettingsPage() {
  const [printerSupported, setPrinterSupported] = useState(true);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setPrinterSupported(d.printerSupported !== false))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[#efefef]">
      <WaiterHeader title="設定" backHref="/waiter" />
      <WaiterRow label="注文設定" href="/waiter/settings/order" />
      {printerSupported && (
        <WaiterRow label="プリンター設定" sub="TM-m30 伝票・レシート" href="/waiter/settings/printer" />
      )}
      <WaiterRow label="データ管理" href="/waiter/settings/data" />
      <WaiterRow label="アプリに追加" href="/waiter/install" />
      <WaiterRow label="スマホ接続" href="/waiter/connect" />
      <WaiterRow label="管理画面" href="/admin/dashboard" />
    </div>
  );
}
