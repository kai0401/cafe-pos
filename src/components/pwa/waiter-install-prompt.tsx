"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  detectPlatform,
  dismissInstallPrompt,
  isInAppBrowser,
  isInstallDismissed,
  isStandalone,
} from "@/lib/pwa-install";

const ORANGE = "#e8912d";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function WaiterInstallPrompt() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [inApp, setInApp] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "other">("other");
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone()) return;
    if (pathname === "/waiter/install" || pathname === "/waiter/connect" || pathname === "/waiter/open") return;
    if (pathname === "/waiter/tables") return;
    if (isInstallDismissed()) return;

    setInApp(isInAppBrowser());
    setPlatform(detectPlatform());
    setVisible(true);

    const onInstall = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onInstall);
    return () => window.removeEventListener("beforeinstallprompt", onInstall);
  }, [pathname]);

  function close() {
    dismissInstallPrompt();
    setVisible(false);
  }

  async function installAndroid() {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end bg-black/50">
      <div className="pb-safe mx-auto w-full max-w-[var(--waiter-width)] rounded-t-2xl bg-white px-5 pt-5 shadow-xl">
        {inApp ? (
          <>
            <h2 className="text-[18px] font-bold text-stone-900">Safariで開いてください</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-stone-600">
              今のブラウザではアプリ化できません。画面下または右上の
              <strong>「Safariで開く」</strong>
              をタップしてから、もう一度この手順を行ってください。
            </p>
            <button
              type="button"
              onClick={close}
              className="mt-5 w-full rounded-xl py-3.5 text-[16px] font-semibold text-white"
              style={{ backgroundColor: ORANGE }}
            >
              わかりました
            </button>
          </>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <img
                src="/icons/waiter-icon-180.png"
                alt=""
                width={56}
                height={56}
                className="rounded-xl"
              />
              <div>
                <h2 className="text-[18px] font-bold text-stone-900">ホーム画面に追加</h2>
                <p className="mt-1 text-[14px] text-stone-600">
                  アプリのように全画面で使えます（App Store不要）
                </p>
              </div>
            </div>

            {platform === "android" && installEvent ? (
              <button
                type="button"
                onClick={() => void installAndroid()}
                className="mt-5 w-full rounded-xl py-3.5 text-[16px] font-semibold text-white"
                style={{ backgroundColor: ORANGE }}
              >
                アプリをインストール
              </button>
            ) : (
              <Link
                href="/waiter/install"
                className="mt-5 flex w-full items-center justify-center rounded-xl py-3.5 text-[16px] font-semibold text-white"
                style={{ backgroundColor: ORANGE }}
                onClick={close}
              >
                追加手順を見る
              </Link>
            )}

            <button
              type="button"
              onClick={close}
              className="mt-3 w-full py-2 text-[14px] text-stone-400"
            >
              あとで
            </button>
          </>
        )}
      </div>
    </div>
  );
}
