"use client";

import { useEffect, useState } from "react";

type ConnectInfo = {
  cloud?: boolean;
  lanUrl?: string | null;
  remoteUrl?: string | null;
  adminUrl?: string;
  lteReady?: boolean;
  waiterUrl?: string;
  kitchenUrl?: string;
  baseUrl?: string;
};

/** ローカル / 店内サーバー運用時のみ表示。クラウド本番は CloudStatusBanner に任せる。 */
export function ShopAccessBanner() {
  const [info, setInfo] = useState<ConnectInfo | null>(null);

  useEffect(() => {
    fetch("/api/connect")
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => {});
  }, []);

  if (!info || info.cloud) return null;

  return (
    <div className="admin-card mb-6 p-4">
      <p className="font-medium text-[var(--admin-ink)]">接続先（開発・店内サーバー）</p>
      <ul className="mt-2 space-y-1 text-sm text-[var(--admin-muted)]">
        {info.lanUrl && (
          <li>
            ウェイター / キッチン（お店のWi-Fi）:{" "}
            <code className="text-[var(--admin-ink)]">{info.lanUrl}</code>
          </li>
        )}
        <li>
          お客様QR / 管理画面:{" "}
          <code className="text-[var(--admin-ink)]">{info.remoteUrl || info.adminUrl || info.baseUrl || "準備中"}</code>
          {info.lteReady ? (
            <span className="ml-2 text-[var(--admin-sage)]">接続可</span>
          ) : (
            <span className="ml-2 text-[var(--admin-vermillion)]">トンネル未起動</span>
          )}
        </li>
      </ul>
    </div>
  );
}
