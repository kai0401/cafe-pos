"use client";

import { useEffect } from "react";

/** Service Worker はモバイルで古い JS をキャッシュし障害の原因になるため無効化 */
export function RegisterServiceWorker(_props: { script: string }) {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.getRegistrations().then((regs) => {
      for (const reg of regs) void reg.unregister();
    });
    if ("caches" in window) {
      void caches.keys().then((keys) => {
        for (const key of keys) void caches.delete(key);
      });
    }
  }, []);
  return null;
}
