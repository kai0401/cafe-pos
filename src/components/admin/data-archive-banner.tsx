"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatYen } from "@/lib/format";

type DataStatus = {
  storeName: string;
  products: number;
  smaregi: {
    transactions: number;
    totalAmount: number;
    from: string | null;
    to: string | null;
    dailySummaries: number;
  };
  ownPosTransactions: number;
  access: {
    lanAdminUrl: string | null;
    publicAdminUrl: string | null;
    lteReady: boolean;
    cloud?: boolean;
  };
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function DataArchiveBanner() {
  const [status, setStatus] = useState<DataStatus | null>(null);

  useEffect(() => {
    fetch("/api/admin/data-status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => {});
  }, []);

  if (!status || !status.smaregi || !status.access) return null;

  const hasArchive = (status.smaregi.transactions ?? 0) > 0;
  const txCount = Number(status.smaregi.transactions ?? 0);
  const dailyCount = Number(status.smaregi.dailySummaries ?? 0);

  return (
    <div className="admin-card mb-6 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-[var(--admin-ink)]">
            {hasArchive ? "スマレジ過去データ" : "スマレジ過去データは未取込"}
          </p>
          {hasArchive ? (
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--admin-muted)]">
              {formatDate(status.smaregi.from)} 〜 {formatDate(status.smaregi.to)} ・ 取引{" "}
              {txCount.toLocaleString("ja-JP")}件 ・ 合計{" "}
              {formatYen(status.smaregi.totalAmount ?? 0)}
              <br />
              日別集計 {dailyCount.toLocaleString("ja-JP")}日分を保存済み。ダッシュボードで閲覧できます。
            </p>
          ) : (
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--admin-muted)]">
              スマレジ管理画面から「取引明細CSV」を出し、CSVインポートに取り込むと経営データとして残せます。
            </p>
          )}
          {status.access.publicAdminUrl && (
            <p className="mt-2 text-xs text-[var(--admin-muted)]">
              外出先の管理画面:{" "}
              <a
                href={status.access.publicAdminUrl}
                className="break-all text-[var(--admin-accent)] underline-offset-2 hover:underline"
              >
                {status.access.publicAdminUrl}
              </a>
              {!status.access.lteReady &&
                !status.access.cloud &&
                " （トンネル未準備のときは店内Wi‑Fiから）"}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link href="/admin/analytics/daily" className="admin-btn admin-btn--ghost">
            日別売上
          </Link>
          <Link href="/admin/imports" className="admin-btn admin-btn--primary">
            CSVインポート
          </Link>
        </div>
      </div>
    </div>
  );
}
