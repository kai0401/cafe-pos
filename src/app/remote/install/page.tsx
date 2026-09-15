"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RemoteShell } from "@/components/remote/remote-ui";

const REMOTE_TEAL = "#1f6f5b";

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
          <Link href="/remote" className="mt-4 inline-block text-[15px] font-semibold" style={{ color: REMOTE_TEAL }}>
            ダッシュボードへ →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
            <img src="/icons/remote-icon-180.png" alt="" width={56} height={56} className="rounded-xl" />
            <div>
              <p className="text-[16px] font-bold text-stone-900">遠隔売上</p>
              <p className="text-[12px] text-stone-500">緑のアイコンが正解です</p>
            </div>
          </div>

          <div className="rounded-2xl bg-amber-50 px-4 py-3 text-[14px] leading-relaxed text-amber-950">
            <p>
              <strong>必ずこの画面（または売上ダッシュボード）で追加</strong>してください。
              トップやPINだけの画面で追加すると「Cafe POS」など別アプリになります。
            </p>
            <p className="mt-2">
              iPhone は <strong>Safari</strong> 専用です（Chrome / LINE 内では追加不可）。
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <ol className="space-y-4 text-[15px] leading-relaxed text-stone-800">
              {platform === "android" ? (
                <>
                  <li>
                    <strong>1.</strong> PIN入力後、売上ダッシュボードを表示
                  </li>
                  <li>
                    <strong>2.</strong> 右上メニュー（⋮）→ <strong>ホーム画面に追加</strong>
                  </li>
                  <li>
                    <strong>3.</strong> 名前が「遠隔売上」・緑アイコンになっていることを確認して追加
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <strong>1.</strong> Safari でダッシュボードを開く（PIN入力済み）
                  </li>
                  <li>
                    <strong>2.</strong> 共有ボタン → <strong>ホーム画面に追加</strong>
                  </li>
                  <li>
                    <strong>3.</strong> 名前が「遠隔売上」か確認（Cafe POS / ウェイターならキャンセル）
                  </li>
                  <li>
                    <strong>4.</strong> 緑の「遠隔売上」アイコンから起動
                  </li>
                </>
              )}
            </ol>
          </div>

          <Link
            href="/remote"
            className="block rounded-xl py-3.5 text-center text-[15px] font-semibold text-white"
            style={{ backgroundColor: REMOTE_TEAL }}
          >
            ダッシュボードを開いてから追加する
          </Link>
        </div>
      )}
    </RemoteShell>
  );
}
