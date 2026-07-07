"use client";

import { useCallback, useEffect, useState } from "react";

const ORANGE = "#e8912d";

type ConnectInfo = {
  tablesUrl: string;
  cloud?: boolean;
  remoteUrl?: string | null;
  lanUrl?: string | null;
  remoteActive?: boolean;
};

export default function WaiterOpenPage() {
  const [status, setStatus] = useState<"checking" | "ok" | "fail">("checking");
  const [origin, setOrigin] = useState("");
  const [connect, setConnect] = useState<ConnectInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

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
      setCopyFailed(true);
      setTimeout(() => setCopyFailed(false), 2000);
    }
  }, []);

  const tablesHref = connect?.tablesUrl ?? "/waiter/tables";
  const isCloud = connect?.cloud === true;
  const isLan = !isCloud && (origin.startsWith("http://192.168.") || origin.startsWith("http://10.") || origin.startsWith("http://172."));
  const showRemoteHint = !isCloud && isLan && connect?.remoteActive && connect.remoteUrl;

  return (
    <div className="flex min-h-screen flex-col bg-[#efefef] p-6">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <img
          src="/icons/waiter-icon-180.png"
          alt=""
          width={80}
          height={80}
          className="rounded-2xl shadow-md"
        />
        <h1 className="mt-4 text-[22px] font-bold text-stone-900">ウェイター</h1>

        {status === "checking" && (
          <p className="mt-6 text-[15px] text-stone-500">接続確認中…</p>
        )}

        {status === "ok" && (
          <p className="mt-6 rounded-xl bg-emerald-50 px-4 py-3 text-[15px] font-medium text-emerald-800">
            {isCloud ? "✓ クラウド接続OK — 店舗PC不要" : "✓ 接続OK — 下のボタンをタップ"}
          </p>
        )}

        {status === "fail" && (
          <div className="mt-6 w-full max-w-[340px] rounded-xl bg-red-50 px-4 py-3 text-left text-[14px] text-red-800">
            <p className="font-medium">接続できません</p>
            {connect?.remoteUrl && origin !== connect.remoteUrl && (
              <p className="mt-2">
                外出先（LTE）の場合は下の HTTPS URL を Safari で開いてください。
              </p>
            )}
          </div>
        )}

        <a
          href={tablesHref}
          className="mt-8 flex w-full max-w-[340px] items-center justify-center rounded-xl py-5 text-[18px] font-bold text-white active:brightness-95"
          style={{ backgroundColor: ORANGE }}
        >
          テーブル一覧を開く
        </a>

        {!isCloud && connect?.remoteActive && connect.remoteUrl && (
          <a
            href={`${connect.remoteUrl}/waiter/tables`}
            className="mt-3 flex w-full max-w-[340px] items-center justify-center rounded-xl border-2 border-[#e8912d] py-4 text-[15px] font-semibold text-[#e8912d]"
          >
            どこでも接続（HTTPS）
          </a>
        )}

        {showRemoteHint && (
          <p className="mt-4 max-w-[340px] text-[13px] leading-relaxed text-amber-800">
            店外（LTE）では上の「どこでも接続」を使ってください。Wi‑Fi専用URLは外では開けません。
          </p>
        )}

        <a
          href="/waiter/install"
          className="mt-4 text-[14px] font-medium text-stone-500 underline"
        >
          ホーム画面に追加する
        </a>
      </div>

      {connect?.tablesUrl && (
        <div className="mx-auto w-full max-w-[340px] rounded-xl bg-white p-4 shadow-sm">
          <p className="text-[12px] font-medium text-stone-500">接続URL（コピーして Safari に貼り付け）</p>
          <p className="mt-2 break-all text-[13px] text-stone-800">{connect.tablesUrl}</p>
          <button
            type="button"
            onClick={() => void copyUrl(connect.tablesUrl)}
            className="mt-3 w-full rounded-lg border border-stone-200 py-2.5 text-[14px] font-medium text-stone-700"
          >
            {copied ? "コピーしました" : copyFailed ? "コピーできませんでした" : "URLをコピー"}
          </button>
          <img
            src={`/api/connect/qr?url=${encodeURIComponent(connect.tablesUrl)}`}
            alt="接続QR"
            width={180}
            height={180}
            className="mx-auto mt-4 rounded-lg border border-stone-200"
          />
        </div>
      )}

      <p className="mt-4 text-center text-[11px] text-stone-400">現在: {origin || "…"}</p>
    </div>
  );
}
