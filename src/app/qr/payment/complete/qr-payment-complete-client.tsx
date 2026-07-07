"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { formatYen } from "@/lib/format";

export default function QrPaymentCompleteClient() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const cancelled = searchParams.get("cancelled");
  const pending = searchParams.get("pending");
  const invalid = searchParams.get("error") === "invalid";

  const [amount, setAmount] = useState<number | null>(null);
  const [returnUrl, setReturnUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    fetch(`/api/payments/stores/${sessionId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.session?.amount) setAmount(data.session.amount);
        if (typeof data.returnUrl === "string") setReturnUrl(data.returnUrl);
      })
      .catch(() => {});
  }, [sessionId]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-stone-50 p-6">
      <div className="max-w-sm rounded-2xl bg-white p-8 text-center shadow-sm">
        {invalid ? (
          <>
            <p className="text-[20px] font-bold text-stone-800">決済情報が見つかりません</p>
            <p className="mt-3 text-[14px] text-stone-500">スタッフにお声がけください</p>
          </>
        ) : cancelled ? (
          <>
            <p className="text-[20px] font-bold text-stone-800">お支払いがキャンセルされました</p>
            <p className="mt-3 text-[14px] text-stone-500">再度お試しいただくか、スタッフにお声がけください</p>
          </>
        ) : pending ? (
          <>
            <p className="text-[20px] font-bold text-stone-800">お支払いを確認中です</p>
            <p className="mt-3 text-[14px] text-stone-500">しばらくお待ちください</p>
          </>
        ) : (
          <>
            <p className="text-[48px]">✓</p>
            <p className="mt-2 text-[20px] font-bold text-stone-800">お支払い完了</p>
            {amount !== null && (
              <p className="mt-2 text-[24px] font-bold text-amber-700">{formatYen(amount)}</p>
            )}
            <p className="mt-4 text-[14px] text-stone-500">ご利用ありがとうございました</p>
          </>
        )}
        {returnUrl ? (
          <Link href={returnUrl} className="mt-8 inline-block text-[14px] text-amber-700 underline">
            注文画面に戻る
          </Link>
        ) : (
          <p className="mt-8 text-[13px] text-stone-400">この画面は閉じて大丈夫です</p>
        )}
      </div>
    </div>
  );
}
