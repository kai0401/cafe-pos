"use client";

import { useEffect, useState } from "react";

export function WaiterOfflineBanner() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div className="waiter-top-bar bg-amber-500 px-3 py-2 text-center text-[13px] font-medium text-white">
      オフライン — 注文は端末に保存され、接続復帰後に送信されます
    </div>
  );
}
