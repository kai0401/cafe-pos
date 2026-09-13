"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Toast } from "@/components/waiter/waiter-ui";
import { loadStaffSuggestions, getCurrentStaffName, setCurrentStaffName } from "@/lib/waiter-staff";
import { waiterFetch } from "@/lib/waiter-api";

import { POS_ACCENT } from "@/lib/pos-theme";

const SEGMENTS = ["家族連れ", "20代", "30代", "40代", "50代〜", "外国人観光客"];

export default function EntryPage() {
  const params = useParams();
  const router = useRouter();
  const tableId = params.tableId as string;

  const [count, setCount] = useState<number | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [moreValue, setMoreValue] = useState("10");
  const [segment, setSegment] = useState<string | null>(null);
  const [staff, setStaff] = useState("");
  const [staffOpen, setStaffOpen] = useState(false);
  const [staffDraft, setStaffDraft] = useState("");
  const [staffSuggestions, setStaffSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [tableName, setTableName] = useState("");
  const [eatInType, setEatInType] = useState<"DINE_IN" | "TAKEOUT">("DINE_IN");

  useEffect(() => {
    waiterFetch(`/api/waiter/tables/${tableId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.name) setTableName(data.name);
        if (data?.eatInType === "TAKEOUT") setEatInType("TAKEOUT");
      })
      .catch(() => setToast("テーブル情報の読み込みに失敗しました"));
    loadStaffSuggestions().then((names) => {
      setStaffSuggestions(names);
      const current = getCurrentStaffName();
      if (current) setStaff(current);
      else if (names[0]) setStaff(names[0]);
    });
  }, [tableId]);

  function saveStaffName(name: string) {
    const trimmed = name.trim();
    setStaff(trimmed);
    setStaffOpen(false);
    if (!trimmed) return;
    setCurrentStaffName(trimmed);
    setStaffSuggestions((prev) => [trimmed, ...prev.filter((s) => s !== trimmed)].slice(0, 8));
  }

  async function submit(continueToOrder: boolean) {
    if (!count) {
      setToast("人数を選択してください");
      return;
    }
    setLoading(true);
    try {
      const res = await waiterFetch("/api/waiter/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "open", tableId, customerCount: count }),
      });
      const order = await res.json();
      if (!res.ok) {
        setToast(order.error ?? "入店処理に失敗しました");
        return;
      }
      if (order?.id && (staff || segment)) {
        const metaRes = await waiterFetch("/api/waiter/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "updateMeta",
            orderId: order.id,
            staffName: staff || undefined,
            customerSegment: segment || undefined,
          }),
        });
        if (!metaRes.ok) {
          const meta = await metaRes.json();
          setToast(meta.error ?? "スタッフ・客層の保存に失敗しました");
          return;
        }
      }
      router.push(continueToOrder ? `/waiter/order/${tableId}/categories` : "/waiter/tables");
    } catch {
      setToast("通信エラー");
    } finally {
      setLoading(false);
    }
  }

  const cellBase =
    "flex items-center justify-center border-b border-r border-stone-200 bg-white py-3.5 text-[19px] active:bg-stone-100";

  return (
    <div className="flex min-h-screen flex-col bg-[var(--pos-bg)]">
      <header
        className="waiter-top-bar sticky top-0 z-20 flex shrink-0 items-center px-3 text-white"
        style={{ backgroundColor: POS_ACCENT }}
      >
        <div className="min-w-[72px]" />
        <h1 className="flex-1 text-center text-[16px] font-semibold">
          入店処理{tableName ? ` — ${tableName}` : ""}
        </h1>
        <button
          type="button"
          onClick={() => router.push("/waiter/tables")}
          className="waiter-header-btn min-w-[72px] justify-end text-right text-[15px]"
        >
          終了
        </button>
      </header>

      <div className="waiter-scroll-pad-bottom flex-1 overflow-y-auto">
      <div className="px-4 pb-1 pt-3 text-[13px] font-medium text-stone-500">
        人数{eatInType === "TAKEOUT" ? "（テイクアウト）" : ""}
      </div>
      <div className="grid grid-cols-5 border-l border-t border-stone-200">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => {
              setCount(n);
              setMoreOpen(false);
            }}
            className={`${cellBase} ${count === n && !moreOpen ? "!bg-[var(--pos-accent)] font-bold !text-white" : "text-stone-900"}`}
          >
            {n}
            <span className="mt-1 text-[11px]">人</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setMoreOpen(true);
            setCount(Number(moreValue) || 10);
          }}
          className={`${cellBase} !text-[14px] ${moreOpen ? "!bg-[var(--pos-accent)] font-bold !text-white" : "text-stone-900"}`}
        >
          それ以上
        </button>
      </div>
      {moreOpen && (
        <div className="flex items-center gap-2 border-b border-stone-200 bg-white px-4 py-3">
          <input
            type="number"
            inputMode="numeric"
            min={10}
            value={moreValue}
            onChange={(e) => {
              setMoreValue(e.target.value);
              setCount(Math.max(1, Number(e.target.value) || 0));
            }}
            className="w-24 rounded-lg border border-stone-300 px-3 py-2 text-[18px]"
          />
          <span className="text-[15px] text-stone-600">人</span>
        </div>
      )}

      <div className="px-4 pb-1 pt-4 text-[13px] font-medium text-stone-500">客層</div>
      <div className="grid grid-cols-3 border-l border-t border-stone-200">
        {SEGMENTS.map((seg) => (
          <button
            key={seg}
            type="button"
            onClick={() => setSegment((prev) => (prev === seg ? null : seg))}
            className={`${cellBase} !text-[15px] ${segment === seg ? "!bg-[var(--pos-accent)] font-bold !text-white" : "text-stone-900"}`}
          >
            {seg}
          </button>
        ))}
      </div>

      <div className="px-4 pb-1 pt-4 text-[13px] font-medium text-stone-500">スタッフ</div>
      <button
        type="button"
        onClick={() => {
          setStaffDraft(staff);
          setStaffOpen(true);
        }}
        className="flex items-center justify-between border-b border-t border-stone-200 bg-white px-4 py-3.5 text-left active:bg-stone-50"
      >
        <span className={`text-[16px] ${staff ? "text-stone-900" : "text-stone-400"}`}>
          {staff || "未選択"}
        </span>
        <span className="text-[16px] text-stone-300">›</span>
      </button>

      </div>

      <div
        className="waiter-fixed-bottom pb-safe z-30 flex"
        style={{ backgroundColor: POS_ACCENT }}
      >
        <button
          type="button"
          disabled={loading}
          onClick={() => submit(false)}
          className="flex flex-1 items-center justify-center gap-1.5 py-4 text-[15px] font-semibold text-white disabled:opacity-50"
        >
          ✔ 入店処理をする
        </button>
        <div className="my-3 w-px bg-white/40" />
        <button
          type="button"
          disabled={loading}
          onClick={() => submit(true)}
          className="flex flex-1 items-center justify-center gap-1.5 py-4 text-[15px] font-semibold text-white disabled:opacity-50"
        >
          続けて注文する
        </button>
      </div>

      {staffOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40">
          <div className="pb-safe w-full rounded-t-2xl bg-white p-5">
            <h2 className="mb-3 text-[17px] font-bold">スタッフ</h2>
            {staffSuggestions.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {staffSuggestions.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => saveStaffName(name)}
                    className="rounded-full border border-stone-300 px-3.5 py-2.5 text-[14px] text-stone-700 active:bg-[var(--pos-accent-soft)]"
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
            <input
              value={staffDraft}
              onChange={(e) => setStaffDraft(e.target.value)}
              placeholder="スタッフ名を入力"
              className="mb-3 w-full rounded-lg border border-stone-300 px-4 py-2.5 text-[16px]"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStaffOpen(false)}
                className="flex-1 rounded-lg border border-stone-300 py-2.5 text-[15px]"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => saveStaffName(staffDraft)}
                className="flex-1 rounded-lg bg-[var(--pos-accent)] py-2.5 text-[15px] font-semibold text-white"
              >
                決定
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast message={toast} onClose={() => setToast("")} />
    </div>
  );
}
