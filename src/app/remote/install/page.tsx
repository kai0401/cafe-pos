"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RemoteShell } from "@/components/remote/remote-ui";
import { POS_ACCENT } from "@/lib/pos-theme";

function detectPlatform(): "ios" | "android" | "other" {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

export default function RemoteInstallPage() {
  const [platform, setPlatform] = useState<"ios" | "android" | "other">("other");
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    const mq = window.matchMedia("(display-mode: standalone)");
    setStandalone(mq.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
  }, []);

  return (
    <RemoteShell title="ホーム画面に追加" backHref="/remote">
      {standalone ? (
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-[16px] font-bold text-stone-900">すでにホーム画面から起動中です</p>
          <Link href="/remote" className="mt-4 inline-block text-[15px] font-semibold" style={{ color: POS_ACCENT }}>
            ダッシュボードへ →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl bg-amber-50 px-4 py-3 text-[14px] leading-relaxed text-amber-950">
            <strong>重要:</strong> iPhone は必ず <strong>Safari</strong> で開いてください。
            Chrome / LINE / Instagram 内ブラウザでは「ホーム画面に追加」が出ません。
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <ol className="space-y-4 text-[15px] leading-relaxed text-stone-800">
              {platform === "android" ? (
                <>
                  <li>
                    <strong>1.</strong> このページを Chrome で開く
                  </li>
                  <li>
                    <strong>2.</strong> 右上メニュー（⋮）→ <strong>ホーム画面に追加</strong> / アプリをインストール
                  </li>
                  <li>
                    <strong>3.</strong> ホーム画面の「遠隔売上」アイコンから起動
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <strong>1.</strong> Safari で{" "}
                    <a href="https://azumaya-pos.vercel.app/remote" className="underline" style={{ color: POS_ACCENT }}>
                      azumaya-pos.vercel.app/remote
                    </a>{" "}
                    を開く
                  </li>
                  <li>
                    <strong>2.</strong> PIN（スタッフ用）を入力してダッシュボードを表示
                  </li>
                  <li>
                    <strong>3.</strong> 画面下の共有ボタン → <strong>ホーム画面に追加</strong>
                  </li>
                  <li>
                    <strong>4.</strong> ホーム画面の「遠隔売上」アイコンから起動
                  </li>
                </>
              )}
            </ol>
          </div>

          <p className="text-center text-[13px] text-stone-500">
            追加できない場合は Safari で開き直してください
          </p>
        </div>
      )}
    </RemoteShell>
  );
}
