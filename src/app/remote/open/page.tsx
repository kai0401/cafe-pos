"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { POS_ACCENT } from "@/lib/pos-theme";

export default function RemoteOpenPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "ok" | "fail">("checking");

  useEffect(() => {
    fetch("/api/health")
      .then((r) => {
        if (!r.ok) throw new Error("health");
        setStatus("ok");
        router.replace("/remote");
      })
      .catch(() => setStatus("fail"));
  }, [router]);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#f4f2ee] p-6 text-center">
      <img
        src="/icons/remote-icon-180.png"
        alt=""
        width={80}
        height={80}
        className="rounded-2xl shadow-md"
      />
      <h1 className="mt-4 text-[22px] font-bold text-stone-900">遠隔売上</h1>
      {status === "checking" && <p className="mt-6 text-[15px] text-stone-500">起動中…</p>}
      {status === "ok" && <p className="mt-6 text-[15px] text-stone-500">ダッシュボードへ移動中…</p>}
      {status === "fail" && (
        <div className="mt-6 w-full max-w-[340px] rounded-xl bg-red-50 px-4 py-3 text-left text-[14px] text-red-800">
          <p className="font-medium">接続できません</p>
          <p className="mt-2">通信環境を確認してから、もう一度開いてください。</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-3 rounded-lg px-4 py-2 text-[14px] font-semibold text-white"
            style={{ backgroundColor: POS_ACCENT }}
          >
            再読み込み
          </button>
        </div>
      )}
    </div>
  );
}
