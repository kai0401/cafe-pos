"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type ConnectInfo = {
  cloud?: boolean;
  baseUrl: string;
  kitchenUrl: string;
  kitchenOpenUrl: string;
  kitchenInstallUrl: string;
  lanUrl?: string | null;
  remoteUrl?: string | null;
  remoteActive?: boolean;
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }, [text]);

  return (
    <button
      type="button"
      onClick={copy}
      className="shrink-0 rounded-lg border border-stone-700 px-3 py-2.5 text-[13px] text-stone-300"
    >
      {copied ? "コピー済" : "コピー"}
    </button>
  );
}

function QrBlock({ url, label }: { url: string; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <img
        src={`/api/connect/qr?url=${encodeURIComponent(url)}`}
        alt={label}
        width={200}
        height={200}
        className="rounded-xl border border-stone-700 bg-white p-2"
      />
      <p className="mt-2 text-center text-[12px] text-stone-500">{label}</p>
    </div>
  );
}

export default function KitchenConnectPage() {
  const [info, setInfo] = useState<ConnectInfo | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/connect")
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => setError("接続情報を取得できませんでした"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-stone-950 pb-8 text-white">
      <header className="kitchen-top-bar sticky top-0 z-20 flex shrink-0 items-center bg-stone-900 px-3">
        <Link href="/kitchen/open" className="kitchen-header-btn min-w-[72px] text-[15px] text-amber-400">
          ‹ 戻る
        </Link>
        <h1 className="flex-1 text-center text-[16px] font-semibold">キッチン接続</h1>
        <div className="min-w-[72px]" />
      </header>

      <div className="mx-4 mt-4 rounded-2xl bg-stone-900 p-5">
        <h2 className="text-[17px] font-bold">
          {info?.cloud ? "クラウド接続（店舗PC不要）" : "どこでも接続（LTE・外出先）"}
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-stone-400">
          iPad / タブレットで下の QR を読み取り、Safari で開いて
          <strong className="text-stone-200"> ホーム画面に追加</strong>
          してください。
          {info?.cloud && " Macを起動していなくても使えます。"}
        </p>

        {loading && <p className="mt-3 text-[14px] text-stone-500">読み込み中…</p>}
        {error && <p className="mt-3 text-[14px] text-red-400">{error}</p>}

        {info && (
          <>
            {info.cloud ? (
              <p className="mt-3 rounded-lg bg-emerald-900/40 px-3 py-2 text-[14px] text-emerald-300">
                ✓ クラウド本番 — 常時稼働
              </p>
            ) : info.remoteActive ? (
              <p className="mt-3 rounded-lg bg-emerald-900/40 px-3 py-2 text-[14px] text-emerald-300">
                ✓ どこでも接続 ON
              </p>
            ) : (
              <p className="mt-3 rounded-lg bg-amber-900/30 px-3 py-2 text-[14px] text-amber-200">
                ローカル店舗サーバー — Vercel本番デプロイを推奨
              </p>
            )}

            {info.lanUrl && info.remoteActive && info.lanUrl !== info.baseUrl && (
              <p className="mt-2 text-[13px] text-stone-500">店舗 Wi‑Fi: {info.lanUrl}/kitchen</p>
            )}

            <div className="mt-5 flex justify-center">
              <QrBlock url={info.kitchenOpenUrl} label="キッチン接続確認 QR" />
            </div>
          </>
        )}
      </div>

      {info && (
        <div className="mx-4 mt-4 space-y-3 rounded-2xl bg-stone-900 p-4">
          {[
            { label: "キッチン（伝票モニター）", url: info.kitchenUrl },
            { label: "接続確認", url: info.kitchenOpenUrl },
            { label: "ホーム画面に追加", url: info.kitchenInstallUrl },
          ].map((row) => (
            <div key={row.label} className="border-b border-stone-800 pb-3 last:border-b-0">
              <p className="mb-1 text-[13px] text-stone-500">{row.label}</p>
              <div className="flex items-start justify-between gap-3">
                <a href={row.url} className="break-all text-[14px] text-amber-400 underline">
                  {row.url}
                </a>
                <CopyButton text={row.url} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mx-4 mt-4">
        <Link
          href="/kitchen/install"
          className="flex w-full items-center justify-center rounded-xl bg-amber-500 py-4 text-[15px] font-semibold text-stone-900"
        >
          追加手順を見る
        </Link>
      </div>
    </div>
  );
}
