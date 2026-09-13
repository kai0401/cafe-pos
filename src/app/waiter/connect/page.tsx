"use client";

import { useCallback, useEffect, useState } from "react";
import { WaiterHeader } from "@/components/waiter/waiter-ui";
import { POS_ACCENT } from "@/lib/pos-theme";


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
        <a href={url} className="break-all text-[15px] font-medium text-[var(--pos-accent-press)] underline">
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
    <div className="min-h-screen bg-[var(--pos-bg)] pb-8">
      <WaiterHeader title="スマホ接続" backHref="/waiter/settings" />

      {!online && (
        <div className="mx-4 mt-3 rounded-xl bg-[var(--pos-accent-soft)] px-4 py-3 text-center text-[13px] text-[var(--pos-accent-press)]">
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
          {info?.cloud ? "クラウドで接続（Mac不要）" : "お店のWi-Fiで接続"}
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-stone-600">
          {info?.cloud ? (
            <>
              ウェイターとキッチンは<strong>インターネット</strong>（LTE / Wi‑Fiどちらでも可）で開きます。店舗に Mac
              や PC を置く必要はありません。
            </>
          ) : (
            <>
              ウェイターとキッチンは<strong>お店のWi-Fi</strong>で開きます。お客様のQR注文は携帯回線なので、この端末をお客様用Wi-Fiに繋ぐ必要はありません。
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
            ) : (
              <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-[14px] font-medium text-emerald-800">
                ✓ お店のWi-Fi用 — {info.lanUrl || info.waiterUrl}
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
          style={{ backgroundColor: POS_ACCENT }}
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

      <div className="mx-4 mt-4 rounded-2xl border border-dashed p-5" style={{ borderColor: POS_ACCENT }}>
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
        <h2 className="text-[15px] font-bold text-stone-800">使い分け</h2>
        <ul className="mt-3 space-y-2 text-[14px] leading-relaxed text-stone-600">
          {info?.cloud ? (
            <>
              <li>• ウェイター / キッチン … クラウドURL（LTE / Wi‑Fiどちらでも可）</li>
              <li>• お客様のQR注文 … 同じクラウドURL（テーブル常設シール）</li>
              <li>• 管理画面 … 同じURLの /admin</li>
              <li>• 伝票はキッチン画面、レシートはSTORES端末（店舗Mac不要）</li>
            </>
          ) : (
            <>
              <li>• ウェイター / キッチン … お店のWi-Fi（このページのURL）</li>
              <li>• お客様のQR注文 … 携帯回線（お店のWi-Fi不要）</li>
              <li>• 管理画面 … 外出先からも公開URLで入れます</li>
              <li>• プリンターは店内サーバー稼働時のみ利用できます</li>
            </>
          )}
        </ul>
      </div>
    </div>
  );
}
