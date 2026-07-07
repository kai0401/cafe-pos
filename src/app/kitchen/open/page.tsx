"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type ConnectInfo = {
  kitchenUrl: string;
  remoteUrl?: string | null;
  remoteActive?: boolean;
};

export default function KitchenOpenPage() {
  const [status, setStatus] = useState<"checking" | "ok" | "fail">("checking");
  const [origin, setOrigin] = useState("");
  const [connect, setConnect] = useState<ConnectInfo | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    Promise.all([
      fetch("/api/health").then((r) => r.ok),
      fetch("/api/connect").then((r) => r.json()),
    ])
      .then(([ok, info]) => {
        setConnect(info);
        setStatus(ok ? "ok" : "fail");
      })
      .catch(() => setStatus("fail"));
  }, []);

  const copyUrl = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }, []);

  const kitchenHref = connect?.kitchenUrl ?? "/kitchen";

  return (
    <div className="flex min-h-screen flex-col bg-stone-950 p-6 pt-safe pb-safe text-white">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <img
          src="/icons/kitchen-icon-180.png"
          alt=""
          width={80}
          height={80}
          className="rounded-2xl"
        />
        <h1 className="mt-4 text-[24px] font-black">キッチン</h1>

        {status === "checking" && (
          <p className="mt-6 text-[15px] text-stone-400">接続確認中…</p>
        )}
        {status === "ok" && (
          <p className="mt-6 rounded-xl bg-emerald-900/50 px-4 py-3 text-[15px] font-medium text-emerald-300">
            ✓ サーバーに接続できました
          </p>
        )}
        {status === "fail" && (
          <p className="mt-6 rounded-xl bg-red-900/50 px-4 py-3 text-[15px] text-red-300">
            サーバーに接続できません
          </p>
        )}

        <Link
          href="/kitchen"
          className="mt-8 flex w-full max-w-[340px] items-center justify-center rounded-xl bg-amber-500 py-5 text-[18px] font-bold text-stone-900 active:bg-amber-400"
        >
          キッチンを開く
        </Link>

        {connect?.remoteActive && connect.remoteUrl && (
          <a
            href={`${connect.remoteUrl}/kitchen`}
            className="mt-3 flex w-full max-w-[340px] items-center justify-center rounded-xl border-2 border-amber-500 py-4 text-[15px] font-semibold text-amber-400"
          >
            どこでも接続（HTTPS）
          </a>
        )}

        <Link href="/kitchen/install" className="mt-4 text-[14px] text-stone-400 underline">
          ホーム画面に追加する
        </Link>
        <Link href="/kitchen/connect" className="mt-2 text-[14px] text-stone-400 underline">
          接続URL・QRコード
        </Link>
      </div>

      {connect?.kitchenUrl && (
        <div className="mx-auto w-full max-w-[340px] rounded-xl bg-stone-900 p-4">
          <p className="text-[12px] font-medium text-stone-500">キッチンURL</p>
          <p className="mt-2 break-all text-[13px] text-stone-300">{connect.kitchenUrl}</p>
          <button
            type="button"
            onClick={() => void copyUrl(connect.kitchenUrl)}
            className="mt-3 w-full rounded-lg border border-stone-700 py-2.5 text-[14px] text-stone-300"
          >
            {copied ? "コピーしました" : "URLをコピー"}
          </button>
          <img
            src={`/api/connect/qr?url=${encodeURIComponent(connect.kitchenUrl)}`}
            alt="キッチンQR"
            width={180}
            height={180}
            className="mx-auto mt-4 rounded-lg border border-stone-700"
          />
        </div>
      )}

      <p className="mt-4 text-center text-[11px] text-stone-600">現在: {origin || "…"}</p>
    </div>
  );
}
