"use client";

import { useEffect, useState } from "react";
import { flushOfflineQueue, getPendingQueueCount } from "@/lib/offline-queue";

export function WaiterOfflineBanner() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState("");

  useEffect(() => {
    const refreshCount = () => setPending(getPendingQueueCount());
    setOnline(navigator.onLine);
    refreshCount();

    const onOnline = () => {
      setOnline(true);
      setSyncing(true);
      void flushOfflineQueue()
        .then((result) => {
          refreshCount();
          if (result.synced > 0) {
            setSyncNote(`${result.synced}件を同期しました`);
            setTimeout(() => setSyncNote(""), 2500);
          }
        })
        .finally(() => setSyncing(false));
    };
    const onOffline = () => {
      setOnline(false);
      refreshCount();
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const timer = setInterval(refreshCount, 4000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      clearInterval(timer);
    };
  }, []);

  if (online && pending === 0 && !syncNote) return null;

  if (!online) {
    return (
      <div className="waiter-top-bar bg-amber-500 px-3 py-2 text-center text-[13px] font-medium text-white">
        オフライン — 注文は端末に保存されます
        {pending > 0 ? `（未送信 ${pending}件）` : ""}
      </div>
    );
  }

  if (syncing) {
    return (
      <div className="waiter-top-bar bg-sky-600 px-3 py-2 text-center text-[13px] font-medium text-white">
        接続復帰 — 未送信注文を同期中…
      </div>
    );
  }

  if (pending > 0) {
    return (
      <div className="waiter-top-bar flex items-center justify-center gap-3 bg-amber-600 px-3 py-2 text-center text-[13px] font-medium text-white">
        <span>未送信キュー {pending}件</span>
        <button
          type="button"
          disabled={syncing}
          onClick={() => {
            setSyncing(true);
            void flushOfflineQueue()
              .then((result) => {
                setPending(getPendingQueueCount());
                if (result.synced > 0) {
                  setSyncNote(`${result.synced}件を同期しました`);
                  setTimeout(() => setSyncNote(""), 2500);
                }
              })
              .finally(() => setSyncing(false));
          }}
          className="underline disabled:opacity-60"
        >
          今すぐ同期
        </button>
      </div>
    );
  }

  return (
    <div className="waiter-top-bar bg-emerald-600 px-3 py-2 text-center text-[13px] font-medium text-white">
      {syncNote}
    </div>
  );
}
