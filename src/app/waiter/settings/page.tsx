"use client";

import { useEffect, useState } from "react";
import { WaiterHeader, WaiterRow } from "@/components/waiter/waiter-ui";
import { isStandalone } from "@/lib/pwa-install";

export default function WaiterSettingsPage() {
  const [printerSupported, setPrinterSupported] = useState(true);
  const [showInstall, setShowInstall] = useState(false);

  useEffect(() => {
    setShowInstall(!isStandalone());
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setPrinterSupported(d.printerSupported !== false))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[var(--pos-bg)]">
      <WaiterHeader title="設定" backHref="/waiter" />
      <WaiterRow label="注文設定" href="/waiter/settings/order" />
      {printerSupported && (
        <WaiterRow label="プリンター設定" sub="TM-m30 伝票・レシート" href="/waiter/settings/printer" />
      )}
      <WaiterRow label="データ管理" href="/waiter/settings/data" />
      {showInstall && <WaiterRow label="アプリに追加" href="/waiter/install" />}
    </div>
  );
}
