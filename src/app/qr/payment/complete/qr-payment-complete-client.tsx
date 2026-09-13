"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { formatYen } from "@/lib/format";

export default function QrPaymentCompleteClient() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const cancelled = searchParams.get("cancelled");
  const invalid = searchParams.get("error") === "invalid";

  const [amount, setAmount] = useState<number | null>(null);
  const [returnUrl, setReturnUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"pending" | "paid" | "cancelled" | "invalid">(
    invalid ? "invalid" : cancelled ? "cancelled" : "pending",
  );
  const [pollingError, setPollingError] = useState("");

  const loadSession = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/payments/stores/${sessionId}`, { cache: "no-store" });
      const data = await res.json();
      if (data.session?.amount) setAmount(data.session.amount);
      if (typeof data.returnUrl === "string") setReturnUrl(data.returnUrl);
      if (data.session?.status === "PAID") {
        setStatus("paid");
        setPollingError("");
      } else if (data.session?.status === "FAILED" || data.session?.status === "CANCELLED") {
        setStatus("cancelled");
      } else if (data.session?.status) {
        setStatus("pending");
      }
    } catch {
      setPollingError("支払い状況を更新できませんでした");
    }
  }, [sessionId]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (status !== "pending") return;
    const tick = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      void loadSession();
    };
    const timer = setInterval(tick, 5000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void loadSession();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [status, loadSession]);

  return (
    <div className="pos-shell flex min-h-[100dvh] items-center justify-center bg-[var(--pos-bg)] p-6">
      <div className="max-w-sm rounded-2xl bg-[var(--pos-surface)] p-8 text-center shadow-sm">
        {status === "invalid" ? (
          <>
            <p className="text-[20px] font-bold text-stone-800">決済情報が見つかりません</p>
            <p className="mt-3 text-[14px] text-stone-500">スタッフにお声がけください</p>
          </>
        ) : status === "cancelled" ? (
          <>
            <p className="text-[20px] font-bold text-stone-800">お支払いがキャンセルされました</p>
            <p className="mt-3 text-[14px] text-stone-500">再度お試しいただくか、スタッフにお声がけください</p>
          </>
        ) : status === "pending" ? (
          <>
            <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-[var(--pos-line)] border-t-[var(--pos-accent)]" />
            <p className="mt-4 text-[20px] font-bold text-stone-800">お支払いを確認中です</p>
            <p className="mt-3 text-[14px] text-stone-500">しばらくお待ちください（自動で更新されます）</p>
            {pollingError && <p className="mt-2 text-[13px] text-[var(--pos-danger)]">{pollingError}</p>}
            <button type="button" onClick={() => void loadSession()} className="mt-4 text-[14px] text-[var(--pos-accent)] underline">
              今すぐ更新
            </button>
          </>
        ) : (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--pos-success)] text-[32px] font-bold text-white">
              ✓
            </div>
            <p className="mt-4 text-[20px] font-bold text-stone-800">お支払い完了</p>
            {amount !== null && (
              <p className="mt-2 text-[24px] font-bold text-[var(--pos-accent)]">{formatYen(amount)}</p>
            )}
            <p className="mt-4 text-[14px] text-stone-500">ご利用ありがとうございました</p>
          </>
        )}
        {returnUrl ? (
          <Link
            href={returnUrl}
            className="mt-8 inline-block w-full rounded-xl bg-[var(--pos-accent)] py-3.5 text-[15px] font-semibold text-white active:bg-[var(--pos-accent-press)]"
          >
            注文画面に戻る
          </Link>
        ) : (
          <p className="mt-8 text-[13px] text-stone-400">この画面は閉じて大丈夫です</p>
        )}
      </div>
    </div>
  );
}
