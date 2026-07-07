"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/admin/ui";

type TableQr = {
  id: string;
  name: string;
  qrToken: string | null;
  qrEnabled: boolean;
  status: string;
};

export default function QrSheetPage() {
  const [tables, setTables] = useState<TableQr[]>([]);
  const [baseUrl, setBaseUrl] = useState("");
  const [baseUrlFixed, setBaseUrlFixed] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const [tblRes, connRes] = await Promise.all([
        fetch("/api/admin/qr/tables"),
        fetch("/api/connect"),
      ]);
      const tbls = await tblRes.json();
      const conn = await connRes.json();
      if (!tblRes.ok) {
        setError(tbls.error ?? "QRテーブル情報の読み込みに失敗しました");
        return;
      }
      setTables(tbls);
      setBaseUrl(conn.baseUrl ?? "");
      setBaseUrlFixed(conn.baseUrlFixed ?? false);
    } catch {
      setError("データの読み込みに失敗しました");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleQr(tableId: string) {
    await fetch("/api/admin/qr/tables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableId, action: "toggle" }),
    });
    load();
  }

  async function regenerateToken(tableId: string) {
    if (
      !confirm(
        "QRトークンを再発行します。\n\n⚠ すでに印刷・貼付したQRシールは使えなくなります。\n新しいQRを印刷して貼り替えてください。",
      )
    ) {
      return;
    }
    await fetch("/api/admin/qr/tables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableId, action: "regenerate" }),
    });
    load();
  }

  function qrUrl(table: TableQr) {
    if (!table.qrToken) return "";
    return `${baseUrl}/qr/${table.id}?t=${table.qrToken}`;
  }

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 12mm; }
          body { background: white !important; }
          .qr-sticker {
            width: 85mm;
            min-height: 100mm;
            border: 1px dashed #ccc !important;
            box-shadow: none !important;
            page-break-inside: avoid;
            padding: 8mm !important;
          }
          .qr-sticker-url { display: none !important; }
          .qr-sticker-actions { display: none !important; }
        }
      `}</style>

      <div className="print:hidden">
        <PageHeader
          title="QRオーダー"
          description="各テーブルに貼るQRシールを印刷します。印刷後はテーブルに貼り付けて常設してください"
        >
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
          >
            シールを印刷
          </button>
        </PageHeader>

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        )}

        <div className="mb-6 space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">テーブル常設QRの手順</p>
          <ol className="list-decimal space-y-1 pl-5 text-amber-800">
            <li>接続先URLがお客様のスマホから開けることを確認（店舗Wi‑Fi・HTTPSトンネル）</li>
            <li>「シールを印刷」→ 各テーブルに貼付</li>
            <li>印刷後は「QR再発行」しない（貼ったシールが無効になります）</li>
            <li>お客様はスマホのカメラで読み取り → 人数選択 → メニュー注文</li>
            <li>会計は STORES決済（有効時）またはスタッフがウェイターで会計</li>
          </ol>
        </div>

        <p className="mb-2 text-sm text-stone-600">
          接続先:{" "}
          <code className="rounded bg-stone-200 px-1.5 py-0.5">{baseUrl || "取得中…"}</code>
          {baseUrlFixed ? (
            <span className="ml-2 text-emerald-600">（固定URL・印刷向け）</span>
          ) : (
            <span className="ml-2 text-amber-600">
              （Vercel の PUBLIC_BASE_URL を設定してください）
            </span>
          )}
        </p>
        {!baseUrlFixed && (
          <p className="mb-6 text-xs text-stone-500">
            環境変数{" "}
            <code className="rounded bg-stone-100 px-1">
              PUBLIC_BASE_URL=&quot;https://your-app.vercel.app&quot;
            </code>
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-6 print:gap-4">
        {tables.map((table) => {
          const url = qrUrl(table);
          return (
            <div
              key={table.id}
              className={`qr-sticker flex flex-col items-center rounded-2xl border bg-white p-6 shadow-sm ${
                table.qrEnabled ? "border-stone-200" : "border-stone-200 opacity-50"
              }`}
            >
              <p className="text-[11px] font-medium tracking-wide text-stone-400 uppercase print:text-stone-500">
                スマホで注文
              </p>
              <p className="mt-1 text-2xl font-bold text-stone-900">テーブル {table.name}</p>
              <p className="mb-3 text-center text-[11px] text-stone-500 print:block">
                スマホで読み取って注文
              </p>

              {baseUrl && url && table.qrEnabled ? (
                <img
                  src={`/api/connect/qr?url=${encodeURIComponent(url)}`}
                  alt={`テーブル${table.name}のQRコード`}
                  width={160}
                  height={160}
                  className="print:w-[42mm] print:h-[42mm]"
                />
              ) : (
                <div className="flex h-[160px] w-[160px] items-center justify-center rounded bg-stone-100 text-xs text-stone-400">
                  QR無効
                </div>
              )}

              <p className="qr-sticker-url mt-2 break-all text-center text-[10px] text-stone-400">
                {url}
              </p>

              <div className="qr-sticker-actions mt-4 flex gap-2 print:hidden">
                <button
                  type="button"
                  onClick={() => toggleQr(table.id)}
                  className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium"
                >
                  {table.qrEnabled ? "無効化" : "有効化"}
                </button>
                <button
                  type="button"
                  onClick={() => regenerateToken(table.id)}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700"
                >
                  QR再発行
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
