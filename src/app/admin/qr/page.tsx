"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/admin/ui";

type TableQr = {
  id: string;
  name: string;
  qrToken: string | null;
  qrEnabled: boolean;
  status: string;
};

type ConnectInfo = {
  baseUrl?: string;
  lanUrl?: string | null;
  cloud?: boolean;
  baseUrlFixed?: boolean;
  lteReady?: boolean;
};

const PER_PAGE = 9;

function isPrivateBase(url: string) {
  return /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.|localhost|127\.0\.0\.1)/i.test(url);
}

export default function QrSheetPage() {
  const [tables, setTables] = useState<TableQr[]>([]);
  const [baseUrl, setBaseUrl] = useState("");
  const [lteReady, setLteReady] = useState(false);
  const [error, setError] = useState("");
  const [printing, setPrinting] = useState(false);

  async function load() {
    setError("");
    try {
      const [tblRes, connRes] = await Promise.all([
        fetch("/api/admin/qr/tables"),
        fetch("/api/connect"),
      ]);
      const tbls = await tblRes.json();
      const conn: ConnectInfo = await connRes.json();
      if (!tblRes.ok) {
        setError(tbls.error ?? "QRテーブル情報の読み込みに失敗しました");
        return;
      }
      setTables(Array.isArray(tbls) ? tbls : []);
      // 公開URL優先。なければ店内LANでもQRは表示する（今日の営業用）
      const nextBase = (conn.baseUrl || conn.lanUrl || "").replace(/\/$/, "");
      setBaseUrl(nextBase);
      setLteReady(Boolean(conn.lteReady && nextBase && !isPrivateBase(nextBase)));
      if (!nextBase) {
        setError("接続URLを取得できませんでした。店舗サーバー起動とWi‑Fiを確認してください。");
      }
    } catch {
      setError("データの読み込みに失敗しました");
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    function onAfterPrint() {
      setPrinting(false);
      document.body.classList.remove("qr-a4-printing");
    }
    window.addEventListener("afterprint", onAfterPrint);
    return () => window.removeEventListener("afterprint", onAfterPrint);
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

  const printable = tables.filter((t) => t.qrEnabled && t.qrToken && baseUrl);

  const printPages = useMemo(() => {
    const enabled = tables.filter((t) => t.qrEnabled && t.qrToken && baseUrl);
    const chunks: TableQr[][] = [];
    for (let i = 0; i < enabled.length; i += PER_PAGE) {
      chunks.push(enabled.slice(i, i + PER_PAGE));
    }
    if (chunks.length === 0) chunks.push([]);
    return chunks;
  }, [tables, baseUrl]);

  function printA4Pdf() {
    if (printable.length === 0 || printing || !baseUrl) return;
    setError("");
    setPrinting(true);
    document.body.classList.add("qr-a4-printing");

    // 画像描画を待ってから印刷
    requestAnimationFrame(() => {
      setTimeout(() => {
        window.print();
        // afterprint が来ない環境向け
        setTimeout(() => {
          setPrinting(false);
          document.body.classList.remove("qr-a4-printing");
        }, 1500);
      }, 300);
    });
  }

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }

          html, body {
            background: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          body.qr-a4-printing * {
            visibility: hidden !important;
          }

          body.qr-a4-printing #qr-a4-print-root,
          body.qr-a4-printing #qr-a4-print-root * {
            visibility: visible !important;
          }

          body.qr-a4-printing #qr-a4-print-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            display: block !important;
          }

          body.qr-a4-printing .admin-sidebar,
          body.qr-a4-printing .admin-main > :not(#qr-a4-print-root) {
            display: none !important;
          }

          .qr-a4-page {
            box-sizing: border-box;
            width: 210mm;
            height: 297mm;
            padding: 10mm;
            page-break-after: always;
            break-after: page;
            background: #fff;
          }
          .qr-a4-page:last-child {
            page-break-after: auto;
            break-after: auto;
          }
          .qr-a4-grid {
            width: 100%;
            height: 100%;
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            grid-template-rows: repeat(3, 1fr);
            gap: 4mm;
          }
          .qr-a4-cell {
            border: 0.4mm dashed #d6d3d1;
            border-radius: 2mm;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 3mm;
          }
          .qr-a4-cell.empty { border-color: transparent; }
          .qr-a4-cell img {
            width: 30mm !important;
            height: 30mm !important;
          }
        }
      `}</style>

      <div className="qr-screen-only">
        <PageHeader
          eyebrow="QR ORDER"
          title="QRオーダー"
          description="A4 1枚に最大9個（3×3）でPDF保存できます"
        >
          <button
            type="button"
            onClick={printA4Pdf}
            disabled={printable.length === 0 || printing || !baseUrl}
            className="admin-btn admin-btn--accent"
          >
            {printing
              ? "準備中…"
              : `A4 PDF印刷（${printable.length}個 / ${Math.ceil(printable.length / PER_PAGE) || 1}枚）`}
          </button>
        </PageHeader>

        {error && (
          <p className="mb-4 rounded-lg border border-[var(--admin-vermillion)]/30 bg-[rgba(184,74,58,0.08)] px-4 py-3 text-sm text-[var(--admin-vermillion)]">
            {error}
          </p>
        )}

        {baseUrl && !lteReady && (
          <p className="mb-4 rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            いまのQRは店内向けです（<code className="break-all">{baseUrl}</code>）。
            お客様は携帯回線のまま使う想定なので、Pi のトンネル（cafe-pos-tunnel）と
            PUBLIC_BASE_URL（Vercel固定）を有効にしてから印刷してください。
          </p>
        )}

        {baseUrl && lteReady && (
          <p className="mb-4 rounded-lg border border-[var(--admin-sage)]/30 bg-[rgba(90,140,110,0.08)] px-4 py-3 text-sm text-[var(--admin-ink)]">
            印刷するQRは固定URL（お客様はLTEのまま可）:{" "}
            <code className="break-all">{baseUrl}</code>
          </p>
        )}

        <p className="mb-4 text-sm text-[var(--admin-muted)]">
          上のボタン → 印刷ダイアログで宛先「PDFに保存」。管理画面は印刷されません。
        </p>

        {tables.length === 0 && !error && (
          <p className="mb-4 text-sm text-[var(--admin-muted)]">テーブルがありません。店舗セットアップを確認してください。</p>
        )}

        <div className="flex flex-wrap gap-6">
          {tables.map((table) => {
            const url = qrUrl(table);
            return (
              <div
                key={table.id}
                className={`admin-card flex flex-col items-center !bg-white p-6 ${
                  table.qrEnabled ? "" : "opacity-50"
                }`}
              >
                <p className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                  スマホで注文
                </p>
                <p className="mt-1 text-2xl font-bold text-stone-900">{table.name}</p>
                <p className="mb-3 text-center text-[11px] text-stone-500">
                  スマホで読み取って注文
                </p>

                {baseUrl && url && table.qrEnabled ? (
                  <img
                    src={`/api/connect/qr?url=${encodeURIComponent(url)}`}
                    alt={`テーブル${table.name}のQRコード`}
                    width={160}
                    height={160}
                    className="bg-white"
                  />
                ) : (
                  <div className="flex h-[160px] w-[160px] items-center justify-center rounded bg-stone-100 text-xs text-stone-400">
                    {!table.qrEnabled ? "QR無効" : !baseUrl ? "URL未取得" : "準備中"}
                  </div>
                )}

                {url && (
                  <p className="mt-2 max-w-[200px] break-all text-center text-[10px] text-stone-400">
                    {url}
                  </p>
                )}

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => toggleQr(table.id)}
                    className="admin-btn admin-btn--ghost !px-3 !py-1.5 !text-xs"
                  >
                    {table.qrEnabled ? "無効化" : "有効化"}
                  </button>
                  <button
                    type="button"
                    onClick={() => regenerateToken(table.id)}
                    className="admin-btn !border !border-[var(--admin-vermillion)]/40 !px-3 !py-1.5 !text-xs !text-[var(--admin-vermillion)]"
                  >
                    QR再発行
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 印刷専用：画面では非表示、印刷時のみ表示 */}
      <div id="qr-a4-print-root" aria-hidden="true" className="hidden">
        {printPages.map((chunk, pageIdx) => (
          <section key={pageIdx} className="qr-a4-page">
            <div className="qr-a4-grid">
              {Array.from({ length: PER_PAGE }, (_, i) => {
                const table = chunk[i];
                if (!table) {
                  return <div key={i} className="qr-a4-cell empty" />;
                }
                const url = qrUrl(table);
                return (
                  <div key={table.id} className="qr-a4-cell">
                    <p
                      style={{
                        margin: "0 0 2mm",
                        fontSize: "16px",
                        fontWeight: 700,
                        lineHeight: 1.2,
                      }}
                    >
                      {table.name}
                    </p>
                    <img
                      src={`/api/connect/qr?url=${encodeURIComponent(url)}&size=480`}
                      alt=""
                      width={113}
                      height={113}
                      style={{ width: "30mm", height: "30mm" }}
                    />
                    <p style={{ margin: "2mm 0 0", fontSize: "10px", color: "#78716c" }}>
                      スマホで注文
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
