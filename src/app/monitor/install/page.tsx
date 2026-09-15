"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { POS_ACCENT } from "@/lib/pos-theme";

function detectPlatform(): "ios" | "android" | "other" {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

export default function MonitorInstallPage() {
  const [platform, setPlatform] = useState<"ios" | "android" | "other">("other");
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    const mq = window.matchMedia("(display-mode: standalone)");
    setStandalone(mq.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
  }, []);

  return (
    <div className="min-h-[100dvh] bg-[#f6f1ea] px-4 py-8">
      <div className="mx-auto max-w-lg space-y-4">
        <Link href="/monitor" className="text-[14px] font-medium" style={{ color: POS_ACCENT }}>
          ← ダッシュボード
        </Link>
        <h1 className="text-[22px] font-bold text-stone-900">ホーム画面に追加</h1>

        {standalone ? (
          <p className="rounded-2xl bg-white p-5 text-[15px] shadow-sm">すでにホーム画面から起動中です。</p>
        ) : (
          <>
            <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
              <img src="/icons/remote-icon-180.png" alt="" width={56} height={56} className="rounded-xl" />
              <div>
                <p className="text-[16px] font-bold">店舗ダッシュ</p>
                <p className="text-[12px] text-stone-500">緑アイコン · 店舗ダッシュボード</p>
              </div>
            </div>
            <div className="rounded-2xl bg-amber-50 px-4 py-3 text-[14px] leading-relaxed text-amber-950">
              <strong>Safari</strong> でこのダッシュボードを開いてから追加してください。名前が「店舗ダッシュ」か確認。
            </div>
            <ol className="space-y-3 rounded-2xl bg-white p-5 text-[15px] leading-relaxed shadow-sm">
              {platform === "android" ? (
                <>
                  <li>1. PIN入力後、店舗ダッシュボードを表示</li>
                  <li>2. メニュー（⋮）→ ホーム画面に追加</li>
                  <li>3. 「店舗ダッシュ」になっていることを確認</li>
                </>
              ) : (
                <>
                  <li>1. Safari でダッシュボード表示（PIN済み）</li>
                  <li>2. 共有 → ホーム画面に追加</li>
                  <li>3. 名前「店舗ダッシュ」を確認して追加</li>
                </>
              )}
            </ol>
            <Link
              href="/monitor"
              className="block rounded-xl py-3.5 text-center text-[15px] font-semibold text-white"
              style={{ backgroundColor: POS_ACCENT }}
            >
              ダッシュボードを開く
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
