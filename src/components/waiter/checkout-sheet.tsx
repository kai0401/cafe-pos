"use client";

import { useEffect, useMemo, useState } from "react";
import { formatYen, PAYMENT_LABELS } from "@/lib/format";
import { POS_ACCENT } from "@/lib/pos-theme";
import { waiterFetch } from "@/lib/waiter-api";

const PAYMENT_METHODS = ["CASH", "CREDIT_CARD", "TRANSIT_IC", "QR", "STORES"] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];

type Props = {
  open: boolean;
  orderId: string;
  tableName: string;
  amount: number;
  itemCount: number;
  customerCount: number;
  onClose: () => void;
  onCompleted: (message: string) => void;
};

export function CheckoutSheet({
  open,
  orderId,
  tableName,
  amount,
  itemCount,
  customerCount,
  onClose,
  onCompleted,
}: Props) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [discount, setDiscount] = useState("");
  const [tendered, setTendered] = useState(String(amount));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [storesSession, setStoresSession] = useState<{
    id: string;
    amount: number;
    paymentUrl?: string | null;
  } | null>(null);

  const discountValue = Math.max(0, Math.floor(Number(discount) || 0));
  const payableAmount = Math.max(0, amount - discountValue);

  useEffect(() => {
    if (!open) return;
    setPaymentMethod("CASH");
    setDiscount("");
    setTendered(String(amount));
    setError("");
    setStoresSession(null);
  }, [open, amount, orderId]);

  const changeLabel = useMemo(() => {
    const paid = Number(tendered);
    if (!paid || paid < payableAmount) return null;
    return paid - payableAmount;
  }, [tendered, payableAmount]);

  if (!open) return null;

  async function completeCheckout() {
    setError("");
    if (discountValue > amount) {
      setError("値引き額が合計を超えています");
      return;
    }
    if (paymentMethod === "CASH") {
      const paid = Number(tendered);
      if (!paid || paid < payableAmount) {
        setError("お預かり金額が不足しています");
        return;
      }
    }

    if (paymentMethod === "STORES") {
      setLoading(true);
      try {
        const res = await waiterFetch("/api/payments/stores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId,
            discount: discountValue,
            mode: "terminal",
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "STORES決済の開始に失敗しました");
          return;
        }
        setStoresSession(data.session);
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      const res = await waiterFetch("/api/waiter/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "checkout",
          orderId,
          paymentMethod,
          tendered: paymentMethod === "CASH" ? Number(tendered) : undefined,
          discount: discountValue,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "会計に失敗しました");
        return;
      }
      const change =
        paymentMethod === "CASH" && tendered ? Number(tendered) - data.totalAmount : 0;
      onCompleted(
        change > 0
          ? `会計完了 ${formatYen(data.totalAmount)}（お釣り ${formatYen(change)}）`
          : `会計完了（${formatYen(data.totalAmount)}）`,
      );
    } finally {
      setLoading(false);
    }
  }

  async function confirmStoresPayment() {
    if (!storesSession) return;
    setLoading(true);
    setError("");
    try {
      const res = await waiterFetch("/api/payments/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm",
          sessionId: storesSession.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "決済確認に失敗しました");
        return;
      }
      onCompleted(
        `会計完了（${formatYen(data.checkout?.totalAmount ?? storesSession.amount)}）`,
      );
    } finally {
      setLoading(false);
    }
  }

  if (storesSession) {
    return (
      <div className="fixed inset-0 z-50 flex items-end bg-black/40">
        <div className="pb-safe w-full rounded-t-2xl bg-white p-6">
          <h2 className="text-center text-[17px] font-bold">STORES決済</h2>
          <p className="mt-2 text-center text-[13px] text-stone-500">{tableName}</p>
          <p className="mt-4 text-center text-[32px] font-bold tabular-nums" style={{ color: POS_ACCENT }}>
            {formatYen(storesSession.amount)}
          </p>
          <p className="mt-3 text-center text-[14px] text-stone-500">
            端末で決済が完了したら確認してください
          </p>
          {error && <p className="mt-3 text-center text-[13px] text-red-600">{error}</p>}
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => {
                setStoresSession(null);
                onClose();
              }}
              className="flex-1 rounded-lg border py-3.5"
            >
              キャンセル
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void confirmStoresPayment()}
              className="flex-[2] rounded-lg py-3.5 text-[16px] font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: POS_ACCENT }}
            >
              {loading ? "確認中…" : "決済完了を確認"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40">
      <div className="pb-safe max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white">
        <div className="border-b border-stone-100 px-5 pb-4 pt-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[17px] font-bold">会計 · {tableName}</h2>
            <span className="text-[13px] text-stone-400">
              {itemCount}点 / {customerCount}人
            </span>
          </div>
          <p className="mt-2 text-center text-[34px] font-bold tabular-nums" style={{ color: POS_ACCENT }}>
            {formatYen(payableAmount)}
          </p>
          {discountValue > 0 && (
            <div className="mt-1 flex justify-center gap-3 text-[13px] text-stone-500">
              <span>小計 {formatYen(amount)}</span>
              <span className="text-red-500">値引き −{formatYen(discountValue)}</span>
            </div>
          )}
        </div>

        <div className="px-5 pt-4">
          <label className="mb-1 block text-[13px] font-medium text-stone-500">値引き（円）</label>
          <input
            type="number"
            inputMode="numeric"
            placeholder="0"
            value={discount}
            onChange={(e) => {
              setDiscount(e.target.value);
              const d = Math.max(0, Math.floor(Number(e.target.value) || 0));
              setTendered(String(Math.max(0, amount - d)));
            }}
            className="w-full rounded-lg border border-stone-300 px-4 py-2.5 text-[16px]"
          />
        </div>

        <div className="px-5 pt-4">
          <p className="mb-2 text-[13px] font-medium text-stone-500">支払い方法</p>
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setPaymentMethod(m)}
                className={`rounded-lg border py-3 text-[15px] font-medium active:bg-stone-50 ${
                  paymentMethod === m
                    ? "border-[var(--pos-accent)] bg-[var(--pos-accent-soft)] text-[var(--pos-accent-press)]"
                    : "border-stone-200 text-stone-700"
                }`}
              >
                {PAYMENT_LABELS[m]}
              </button>
            ))}
          </div>
        </div>

        {paymentMethod === "CASH" && (
          <div className="px-5 pt-4">
            <label className="mb-1 block text-[13px] font-medium text-stone-500">お預かり</label>
            <input
              type="number"
              inputMode="numeric"
              value={tendered}
              onChange={(e) => setTendered(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-4 py-3 text-right text-[22px] font-semibold tabular-nums"
            />
            <div className="mt-2 flex gap-2">
              {[
                { label: "ちょうど", value: payableAmount },
                { label: "¥1,000", value: 1000 },
                { label: "¥5,000", value: 5000 },
                { label: "¥10,000", value: 10000 },
              ].map((q) => (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => setTendered(String(Math.max(q.value, payableAmount)))}
                  className="flex-1 rounded-lg border border-stone-300 py-3 text-[13px] font-medium text-stone-700 active:bg-stone-100"
                >
                  {q.label}
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-baseline justify-between rounded-lg bg-stone-50 px-4 py-2.5">
              <span className="text-[14px] text-stone-500">お釣り</span>
              <span
                className={`text-[20px] font-bold tabular-nums ${
                  changeLabel !== null ? "text-stone-900" : "text-red-500"
                }`}
              >
                {changeLabel !== null ? formatYen(changeLabel) : "不足"}
              </span>
            </div>
          </div>
        )}

        {error && <p className="px-5 pt-3 text-center text-[13px] text-red-600">{error}</p>}

        <div className="flex gap-3 px-5 py-5">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border py-3.5">
            キャンセル
          </button>
          <button
            type="button"
            onClick={() => void completeCheckout()}
            disabled={loading}
            className="flex-[2] rounded-lg py-3.5 text-[16px] font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: POS_ACCENT }}
          >
            {loading ? "処理中…" : "会計完了"}
          </button>
        </div>
      </div>
    </div>
  );
}
