"use client";

import { useCallback, useEffect, useState } from "react";
import { WaiterHeader } from "@/components/waiter/waiter-ui";

const ORANGE = "#e8912d";

type ConnectInfo = {
  cloud?: boolean;
  mode?: string;
  shopServerRequired?: boolean;
  baseUrl: string;
  baseUrlFixed: boolean;
  waiterUrl: string;
  tablesUrl: string;
  kitchenUrl: string;
  kitchenOpenUrl?: string;
  kitchenInstallUrl?: string;
  kitchenConnectUrl?: string;
  lanUrl?: string | null;
  remoteUrl?: string | null;
  remoteActive?: boolean;
  remoteUpdatedAt?: string | null;
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }, [text]);

  return (
    <button
      type="button"
      onClick={copy}
      className="shrink-0 rounded-lg border border-stone-200 px-3 py-2.5 text-[13px] font-medium text-stone-600"
    >
      {copied ? "コピー済" : "コピー"}
    </button>
  );
}

function UrlRow({ label, url }: { label: string; url: string }) {
  return (
    <div className="border-b border-stone-200 px-4 py-4 last:border-b-0">
      <p className="mb-1 text-[13px] font-medium text-stone-500">{label}</p>
      <div className="flex items-start justify-between gap-3">
        <a href={url} className="break-all text-[15px] font-medium text-blue-600 underline">
          {url}
        </a>
        <CopyButton text={url} />
      </div>
    </div>
  );
}

function QrBlock({ url, label }: { url: string; label: string }) {
  const src = `/api/connect/qr?url=${encodeURIComponent(url)}`;
  return (
    <div className="flex flex-col items-center">
      <img
        src={src}
        alt={label}
        width={200}
        height={200}
        className="rounded-xl border border-stone-200"
      />
      <p className="mt-2 text-center text-[12px] text-stone-500">{label}</p>
    </div>
  );
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

function detectPlatform(): "ios" | "android" | "other" {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

export default function ConnectPage() {
  const [info, setInfo] = useState<ConnectInfo | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(true);
  const [installed, setInstalled] = useState(false);
  const platform = detectPlatform();

  useEffect(() => {
    setInstalled(isStandalone());
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

  useEffect(() => {
    setLoading(true);
    fetch("/api/connect")
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => setError("接続情報を取得できませんでした"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#efefef] pb-8">
      <WaiterHeader title="スマホ接続" backHref="/waiter/settings" />

      {!online && (
        <div className="mx-4 mt-3 rounded-xl bg-amber-50 px-4 py-3 text-center text-[13px] text-amber-900">
          オフラインです。接続が戻ると自動で同期されます
        </div>
      )}

      {installed && (
        <div className="mx-4 mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-center text-[14px] font-medium text-emerald-800">
          ✓ ホーム画面から起動中（アプリモード）
        </div>
      )}

      <div className="mx-4 mt-4 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-[17px] font-bold text-stone-900">
          {info?.cloud ? "クラウド接続（店舗PC不要）" : "どこでも接続（LTE・外出先）"}
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-stone-600">
          {info?.cloud ? (
            <>
              このURLはインターネット上で常時稼働しています。
              <strong> 店舗のMacを起動していなくても</strong>
              使えます。下のQRを読み取り、ホーム画面に追加してください。
            </>
          ) : (
            <>
              店舗 Wi‑Fi 以外（LTE など）からも使える HTTPS URL です。下の QR を読み取って Safari で開き、
              <strong> ホーム画面に追加</strong>
              してください。
            </>
          )}
        </p>

        {loading && <p className="mt-3 text-[14px] text-stone-400">接続情報を読み込み中…</p>}

        {error && <p className="mt-3 text-[14px] text-red-600">{error}</p>}

        {info && (
          <>
            {info.cloud ? (
              <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-[14px] font-medium text-emerald-800">
                ✓ クラウド本番 — Mac常駐不要 · {info.baseUrl}
              </p>
            ) : info.remoteActive ? (
              <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-[14px] font-medium text-emerald-800">
                ✓ どこでも接続 ON — {info.baseUrl}
              </p>
            ) : (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[14px] text-amber-900">
                ローカル店舗サーバーです。外出先から使うには Vercel 本番デプロイを推奨します。
              </p>
            )}

            {info.lanUrl && info.remoteActive && info.lanUrl !== info.baseUrl && (
              <p className="mt-2 text-[13px] text-stone-500">
                店舗 Wi‑Fi 用: {info.lanUrl}
              </p>
            )}

            <div className="mt-5 grid grid-cols-2 gap-4">
              <QrBlock url={info.tablesUrl} label="ウェイター用 QR" />
              <QrBlock
                url={info.kitchenOpenUrl ?? info.kitchenUrl}
                label="キッチン用 QR"
              />
            </div>
            <p className="mt-3 text-center text-[12px] text-stone-400">
              カメラで読み取って Safari / Chrome で開く
            </p>
          </>
        )}
      </div>

      {info && (
        <div className="mx-4 mt-4 overflow-hidden rounded-2xl bg-white shadow-sm">
          <UrlRow label="ウェイター（テーブル一覧）" url={info.tablesUrl} />
          <UrlRow label="キッチン（伝票モニター）" url={info.kitchenUrl} />
          {info.kitchenOpenUrl && (
            <UrlRow label="キッチン接続確認" url={info.kitchenOpenUrl} />
          )}
          {info.kitchenConnectUrl && (
            <UrlRow label="キッチン接続・QR" url={info.kitchenConnectUrl} />
          )}
          <UrlRow label="ウェイターホーム" url={info.waiterUrl} />
        </div>
      )}

      <div className="mx-4 mt-4 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-[17px] font-bold text-stone-900">アプリのように使う（PWA）</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-stone-600">
          App Store 不要。Safari で URL を開き、ホーム画面に追加するだけでアプリと同じ全画面操作ができます。
        </p>
        <a
          href="/waiter/install"
          className="mt-4 flex w-full items-center justify-center rounded-xl py-3.5 text-[15px] font-semibold text-white"
          style={{ backgroundColor: ORANGE }}
        >
          アプリに追加する手順を見る
        </a>
      </div>

      <div className="mx-4 mt-4 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-[17px] font-bold text-stone-900">
          {platform === "android" ? "Android — ホーム画面に追加" : "iPhone — ホーム画面に追加"}
        </h2>
        {platform === "ios" || platform === "other" ? (
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-[14px] leading-relaxed text-stone-600">
            <li>SafariでウェイターURLを開く</li>
            <li>画面下の <strong>共有</strong> ボタン（□↑）をタップ</li>
            <li><strong>ホーム画面に追加</strong> を選択</li>
            <li>名前を「ウェイター」のまま <strong>追加</strong></li>
          </ol>
        ) : (
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-[14px] leading-relaxed text-stone-600">
            <li>ChromeでウェイターURLを開く</li>
            <li>右上メニュー（⋮）→ <strong>ホーム画面に追加</strong></li>
            <li>または画面下部の「アプリをインストール」をタップ</li>
          </ol>
        )}
        <p className="mt-4 text-[13px] text-stone-400">
          全画面で起動し、ブラウザのUIが非表示になります
        </p>
      </div>

      <div className="mx-4 mt-4 rounded-2xl border border-dashed p-5" style={{ borderColor: ORANGE }}>
        <h2 className="text-[15px] font-bold text-stone-800">キッチン用 iPad / タブレット</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-stone-600">
          キッチンQRを読み取り、Safariでホーム画面に追加。充電しながら常時表示してください。
        </p>
        {info?.kitchenConnectUrl && (
          <a
            href={info.kitchenConnectUrl}
            className="mt-3 flex w-full items-center justify-center rounded-xl border-2 border-stone-800 py-3 text-[14px] font-semibold text-stone-800"
          >
            キッチン接続ページを開く
          </a>
        )}
      </div>

      <div className="mx-4 mt-4 rounded-2xl bg-stone-100 p-5">
        <h2 className="text-[15px] font-bold text-stone-800">
          {info?.cloud ? "クラウド運用のポイント" : "本番デプロイのチェックリスト"}
        </h2>
        <ul className="mt-3 space-y-2 text-[14px] leading-relaxed text-stone-600">
          {info?.cloud ? (
            <>
              <li>• 店舗のMacは不要 — このURLが常時稼働</li>
              <li>• iPhone / iPad をホーム画面に追加して使う</li>
              <li>• キッチン伝票は /kitchen 画面で表示</li>
              <li>• レシートは STORES 決済端末を使用</li>
            </>
          ) : (
            <>
              <li>• Vercel + Neon でデプロイすると Mac 不要になります</li>
              <li>• <code className="text-[13px]">PUBLIC_BASE_URL</code> を本番URLに設定</li>
              <li>• 各スタッフ端末でホーム画面に追加</li>
            </>
          )}
        </ul>
      </div>
    </div>
  );
}
