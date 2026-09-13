"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function WaiterOpenPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "ok" | "fail">("checking");

  useEffect(() => {
    fetch("/api/health")
      .then((r) => {
        if (!r.ok) throw new Error("health");
        setStatus("ok");
        router.replace("/waiter/tables");
      })
      .catch(() => setStatus("fail"));
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--pos-bg)] p-6 text-center">
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
        <p className="mt-6 text-[15px] text-stone-500">テーブル一覧へ移動中…</p>
      )}
      {status === "fail" && (
        <div className="mt-6 w-full max-w-[340px] rounded-xl bg-red-50 px-4 py-3 text-left text-[14px] text-red-800">
          <p className="font-medium">接続できません</p>
          <p className="mt-2">お店のWi‑Fiに繋いでから、もう一度開いてください。</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 w-full rounded-xl bg-red-700 py-3 text-[15px] font-semibold text-white"
          >
            再読み込み
          </button>
        </div>
      )}
    </div>
  );
}
