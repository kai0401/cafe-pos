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
    <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-emerald-900">クラウド稼働中 — 店舗PC不要</p>
          <p className="mt-1 text-sm text-emerald-800">
            ウェイター・キッチン・QRオーダーはインターネット経由で常時利用できます。
            キッチン伝票は画面表示、レシートはSTORES端末をご利用ください。
          </p>
          {setup && !setup.ready && (
            <p className="mt-2 text-sm text-amber-800">
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
              className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {initing ? "準備中…" : "テーブル初期化"}
            </button>
          )}
          {needsProducts && (
            <Link
              href="/admin/imports"
              className="rounded-lg border border-emerald-700 px-3 py-2 text-sm font-medium text-emerald-900"
            >
              商品CSVインポート
            </Link>
          )}
          <Link
            href="/admin/qr"
            className="rounded-lg border border-emerald-700 px-3 py-2 text-sm font-medium text-emerald-900"
          >
            QRシール印刷
          </Link>
        </div>
      </div>
    </div>
  );
}
