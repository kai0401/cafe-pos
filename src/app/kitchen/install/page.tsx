"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { detectPlatform, isInAppBrowser, isStandalone } from "@/lib/pwa-install";

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 border-b border-stone-800 py-5 last:border-b-0">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--pos-accent)] text-[15px] font-bold text-white">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-[16px] font-bold text-white">{title}</h3>
        <div className="mt-2 text-[14px] leading-relaxed text-stone-400">{children}</div>
      </div>
    </div>
  );
}

export default function KitchenInstallPage() {
  const [platform, setPlatform] = useState<"ios" | "android" | "other">("ios");
  const [installed, setInstalled] = useState(false);
  const [inApp, setInApp] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    setInstalled(isStandalone());
    setInApp(isInAppBrowser());
  }, []);

  return (
    <div className="min-h-screen bg-stone-950 pb-8 text-white">
      <header className="kitchen-top-bar sticky top-0 z-20 flex shrink-0 items-center bg-[var(--pos-accent)] px-3">
        <Link href="/kitchen/open" className="kitchen-header-btn min-w-[72px] text-[15px] text-white">
          ‹ 戻る
        </Link>
        <h1 className="flex-1 text-center text-[16px] font-semibold">アプリに追加</h1>
        <div className="min-w-[72px]" />
      </header>

      <div className="mx-4 mt-4 rounded-2xl bg-stone-900 p-5">
        <div className="flex flex-col items-center text-center">
          <img src="/icons/kitchen-icon-180.png" alt="" width={88} height={88} className="rounded-2xl" />
          <h2 className="mt-4 text-[20px] font-bold">キッチン</h2>
          <p className="mt-2 text-[14px] text-stone-400">iPad / タブレットを常時表示モニターに</p>
        </div>

        {installed && (
          <div className="mt-5 rounded-xl bg-emerald-900/40 px-4 py-3 text-center text-[14px] font-medium text-emerald-300">
            ✓ すでにアプリモードで起動しています
          </div>
        )}

        {inApp && !installed && (
          <div className="mt-5 rounded-xl bg-amber-900/30 px-4 py-3 text-[14px] leading-relaxed text-amber-200">
            <strong>重要:</strong> Safari で開いてから「ホーム画面に追加」してください。
          </div>
        )}
      </div>

      {!installed && (
        <div className="mx-4 mt-4 rounded-2xl bg-stone-900 px-5">
          {platform === "android" ? (
            <>
              <Step n={1} title="Chromeでこのページを開く">
                キッチン用 URL を Chrome で開いてください。
              </Step>
              <Step n={2} title="ホーム画面に追加">
                メニュー（⋮）→ <strong>ホーム画面に追加</strong> をタップします。
              </Step>
              <Step n={3} title="全画面で常時表示">
                追加したアイコンから起動し、充電しながら置いておきます。
              </Step>
            </>
          ) : (
            <>
              <Step n={1} title="Safariで開く">
                <Link href="/kitchen/connect" className="text-amber-400 underline">
                  接続ページ
                </Link>
                の QR を読み取るか、URL を Safari に貼り付けてください。
              </Step>
              <Step n={2} title="共有 → ホーム画面に追加">
                画面下の共有ボタンから <strong>ホーム画面に追加</strong> を選びます。
              </Step>
              <Step n={3} title="常時表示">
                ホーム画面のアイコンから起動。新規注文は音で通知します。充電しながら設置してください。
              </Step>
            </>
          )}
        </div>
      )}

      <div className="mx-4 mt-4">
        <Link
          href="/kitchen"
          className="flex w-full items-center justify-center rounded-xl bg-amber-500 py-4 text-[16px] font-semibold text-stone-900"
        >
          ブラウザのまま使う
        </Link>
      </div>
    </div>
  );
}
