"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Health = {
  cloud?: boolean;
  shopServerRequired?: boolean;
  setup?: { ready: boolean; products: number; tables: number };
};

export function CloudStatusBanner() {
  const [health, setHealth] = useState<Health | null>(null);
  const [initing, setIniting] = useState(false);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => {});
  }, []);

  if (!health?.cloud) return null;

  async function runSetup() {
    setIniting(true);
    try {
      await fetch("/api/setup", { method: "POST" });
      const h = await fetch("/api/health").then((r) => r.json());
      setHealth(h);
    } finally {
      setIniting(false);
    }
  }

  const setup = health.setup;
  const needsProducts = setup && setup.tables >= 9 && setup.products === 0;

  return (
    <div className="admin-card mb-6 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-medium text-[var(--admin-ink)]">
            <span className="admin-tag admin-tag--sage">クラウド稼働中</span>
            店舗PC不要
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--admin-muted)]">
            ウェイター・キッチン・QRオーダーはインターネット経由で常時利用できます。
            キッチン伝票は画面表示、レシートはSTORES端末をご利用ください。
          </p>
          {setup && !setup.ready && (
            <p className="mt-2 text-sm font-medium text-[var(--admin-vermillion)]">
              {needsProducts
                ? `テーブル ${setup.tables} 席準備済み — 商品CSVのインポートが必要です`
                : `セットアップ未完了（テーブル ${setup.tables} / 商品 ${setup.products}）`}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {setup && setup.tables < 9 && (
            <button
              type="button"
              disabled={initing}
              onClick={() => void runSetup()}
              className="admin-btn admin-btn--accent"
            >
              {initing ? "準備中…" : "テーブル初期化"}
            </button>
          )}
          {needsProducts && (
            <Link href="/admin/imports" className="admin-btn admin-btn--ghost">
              商品CSVインポート
            </Link>
          )}
          <Link href="/admin/qr" className="admin-btn admin-btn--ghost">
            QRシール印刷
          </Link>
        </div>
      </div>
    </div>
  );
}
