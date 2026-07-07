"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  detectPlatform,
  isInAppBrowser,
  isStandalone,
} from "@/lib/pwa-install";

const ORANGE = "#e8912d";

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 border-b border-stone-100 py-5 last:border-b-0">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-white"
        style={{ backgroundColor: ORANGE }}
      >
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-[16px] font-bold text-stone-900">{title}</h3>
        <div className="mt-2 text-[14px] leading-relaxed text-stone-600">{children}</div>
      </div>
    </div>
  );
}

export default function WaiterInstallPage() {
  const [platform, setPlatform] = useState<"ios" | "android" | "other">("ios");
  const [installed, setInstalled] = useState(false);
  const [inApp, setInApp] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    setInstalled(isStandalone());
    setInApp(isInAppBrowser());
  }, []);

  return (
    <div className="min-h-screen bg-[#efefef] pb-8">
      <header
        className="waiter-top-bar sticky top-0 z-20 flex shrink-0 items-center px-3 text-white"
        style={{ backgroundColor: ORANGE }}
      >
        <Link href="/waiter" className="waiter-header-btn min-w-[72px] text-[15px]">
          ‹ 戻る
        </Link>
        <h1 className="flex-1 text-center text-[16px] font-semibold">アプリに追加</h1>
        <div className="min-w-[72px]" />
      </header>

      <div className="mx-4 mt-4 overflow-hidden rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <img
            src="/icons/waiter-icon-180.png"
            alt="ウェイター"
            width={88}
            height={88}
            className="rounded-2xl shadow-md"
          />
          <h2 className="mt-4 text-[20px] font-bold text-stone-900">ウェイター</h2>
          <p className="mt-2 text-[14px] text-stone-500">
            App Store不要 · ホーム画面から起動
          </p>
        </div>

        {installed && (
          <div className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-center text-[14px] font-medium text-emerald-800">
            ✓ すでにアプリモードで起動しています
          </div>
        )}

        {inApp && !installed && (
          <div className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-[14px] leading-relaxed text-amber-900">
            <strong>重要:</strong> 今はアプリ内ブラウザです。先に
            <strong>「Safariで開く」</strong>
            （画面下のメニュー）をタップしてください。
          </div>
        )}
      </div>

      {!installed && (
        <div className="mx-4 mt-4 rounded-2xl bg-white px-5 shadow-sm">
          {platform === "android" ? (
            <>
              <Step n={1} title="Chromeでこのページを開く">
                アドレスバーに表示されている URL を Chrome で開いてください。
              </Step>
              <Step n={2} title="インストール">
                画面に「アプリをインストール」または右上メニュー（⋮）→
                <strong>「ホーム画面に追加」</strong>
                をタップします。
              </Step>
              <Step n={3} title="ホーム画面から起動">
                追加した「ウェイター」アイコンをタップ。ブラウザの UI が消えてアプリのように使えます。
              </Step>
            </>
          ) : (
            <>
              <Step n={1} title="Safariで開く">
                カメラの QR から開いた場合は、画面下の
                <strong> aa ボタン → 「Safariで開く」</strong>
                を選んでください。Chrome では追加できません。
              </Step>
              <Step n={2} title="共有ボタンをタップ">
                画面<strong>下</strong>中央の
                <span className="mx-1 inline-flex h-7 w-7 items-center justify-center rounded-md bg-stone-200 text-[13px] font-bold">
                  □↑
                </span>
                共有アイコンをタップします。
              </Step>
              <Step n={3} title="ホーム画面に追加">
                メニューを下にスクロールし
                <strong>「ホーム画面に追加」</strong>
                を選び、右上の<strong>「追加」</strong>
                をタップします。
              </Step>
              <Step n={4} title="ホーム画面から起動">
                ホーム画面にできたオレンジの「ウェイター」アイコンから起動してください。以降はブックマークではなくこのアイコンを使います。
              </Step>
            </>
          )}
        </div>
      )}

      <div className="mx-4 mt-4 rounded-2xl bg-stone-100 p-5">
        <h3 className="text-[15px] font-bold text-stone-800">よくある質問</h3>
        <dl className="mt-3 space-y-3 text-[14px] text-stone-600">
          <div>
            <dt className="font-medium text-stone-800">App Store にないの？</dt>
            <dd className="mt-1">
              Webアプリ（PWA）方式です。インストール不要で、ホーム画面追加だけでアプリと同じ使い方ができます。
            </dd>
          </div>
          <div>
            <dt className="font-medium text-stone-800">オフラインでも使える？</dt>
            <dd className="mt-1">
              注文の送信にはネットワークが必要です。切れた場合は端末に保存され、復帰後に自動送信されます。
            </dd>
          </div>
          <div>
            <dt className="font-medium text-stone-800">本番（クラウド）でも同じ？</dt>
            <dd className="mt-1">
              はい。デプロイ後の URL でも同じ手順でホーム画面に追加できます。
            </dd>
          </div>
        </dl>
      </div>

      {!installed && (
        <div className="mx-4 mt-4">
          <Link
            href="/waiter/tables"
            className="flex w-full items-center justify-center rounded-xl py-4 text-[16px] font-semibold text-white"
            style={{ backgroundColor: ORANGE }}
          >
            ブラウザのまま使う
          </Link>
        </div>
      )}
    </div>
  );
}
