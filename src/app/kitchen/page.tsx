"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatOrderItemNote } from "@/lib/order-modifiers";
import { kitchenFetch } from "@/lib/kitchen-api";
import {
  countdownBadgeClass,
  getServeCountdown,
  KITCHEN_SERVE_TARGET_MINUTES,
} from "@/lib/kitchen-serve-time";

type Ticket = {
  id: string;
  status: string;
  queuedAt: string;
  orderItem: {
    productName: string;
    quantity: number;
    note: string | null;
    order: { table: { name: string } };
  };
};

function nextKitchenStatus(status: string) {
  if (status === "DONE") return "SERVED";
  if (status === "NEW" || status === "COOKING") return "DONE";
  return null;
}

function playNewOrderChime() {
  if (typeof window === "undefined" || !("AudioContext" in window)) return;
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.value = 0.1;
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    /* ignore */
  }
}

/** 画面上の順番を固定。新規は末尾追加、消えたものだけ除去 */
function mergeStableOrder(prevOrder: string[], next: Ticket[]): { order: string[]; tickets: Ticket[] } {
  const byId = new Map(next.map((t) => [t.id, t]));
  const nextIds = new Set(next.map((t) => t.id));
  const kept = prevOrder.filter((id) => nextIds.has(id));
  const known = new Set(kept);
  const newcomers = next
    .filter((t) => !known.has(t.id))
    .sort((a, b) => {
      const ta = new Date(a.queuedAt).getTime();
      const tb = new Date(b.queuedAt).getTime();
      if (ta !== tb) return ta - tb;
      return a.id.localeCompare(b.id);
    })
    .map((t) => t.id);
  const order = [...kept, ...newcomers];
  return {
    order,
    tickets: order.map((id) => byId.get(id)!).filter(Boolean),
  };
}

export default function KitchenPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [connectionError, setConnectionError] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const prevCount = useRef(0);
  const loadingRef = useRef(false);
  const displayOrderRef = useRef<string[]>([]);
  const [busyTicketIds, setBusyTicketIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const res = await kitchenFetch("/api/kitchen/tickets");
      if (!res.ok) throw new Error("fetch failed");
      const data: Ticket[] = await res.json();
      setConnectionError(false);
      setLastUpdated(new Date());
      if (data.length > prevCount.current && prevCount.current > 0) {
        playNewOrderChime();
      }
      prevCount.current = data.length;
      const merged = mergeStableOrder(displayOrderRef.current, data);
      displayOrderRef.current = merged.order;
      setTickets(merged.tickets);
    } catch {
      setConnectionError(true);
    } finally {
      loadingRef.current = false;
      setInitialLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(() => {
      if (document.hidden) return;
      void load();
    }, 5000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const advanceStatus = useCallback(
    async (ticket: Ticket) => {
      const next = nextKitchenStatus(ticket.status);
      if (!next) return;
      let alreadyBusy = false;
      setBusyTicketIds((prev) => {
        if (prev.has(ticket.id)) {
          alreadyBusy = true;
          return prev;
        }
        return new Set(prev).add(ticket.id);
      });
      if (alreadyBusy) return;

      // 完了→提供済みで消えるまで、見た目だけ先に更新（並びは変えない）
      if (next === "DONE") {
        setTickets((prev) => prev.map((t) => (t.id === ticket.id ? { ...t, status: "DONE" } : t)));
      } else if (next === "SERVED") {
        setTickets((prev) => prev.filter((t) => t.id !== ticket.id));
        displayOrderRef.current = displayOrderRef.current.filter((id) => id !== ticket.id);
        prevCount.current = Math.max(0, prevCount.current - 1);
      }

      try {
        const res = await kitchenFetch("/api/kitchen/tickets", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticketId: ticket.id, status: next }),
        });
        if (!res.ok) throw new Error("update failed");
        await load();
      } catch {
        setConnectionError(true);
        await load();
      } finally {
        setBusyTicketIds((prev) => {
          const nextSet = new Set(prev);
          nextSet.delete(ticket.id);
          return nextSet;
        });
      }
    },
    [load],
  );

  const waitingCount = tickets.filter((t) => t.status === "NEW" || t.status === "COOKING").length;
  const readyCount = tickets.filter((t) => t.status === "DONE").length;

  return (
    <div className="min-h-screen bg-stone-950 pb-safe text-white">
      <div className="kitchen-top-bar sticky top-0 z-20 flex items-center justify-between bg-[var(--pos-accent)] px-3 text-white md:px-5">
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <h1 className="text-[18px] font-black tracking-tight md:text-[28px]">キッチン</h1>
          <span className="rounded-full bg-white/20 px-2.5 py-1 text-[12px] font-bold md:px-3 md:py-1.5 md:text-[16px]">
            未完了 {waitingCount}
          </span>
          <span className="rounded-full bg-white/20 px-2.5 py-1 text-[12px] font-bold md:px-3 md:py-1.5 md:text-[16px]">
            提供待ち {readyCount}
          </span>
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] text-white/90 md:px-3 md:py-1.5 md:text-[14px]">
            目標 {KITCHEN_SERVE_TARGET_MINUTES}分
          </span>
        </div>
        <div className="flex shrink-0 gap-2 md:gap-3">
          <button
            type="button"
            onClick={() => void load()}
            className="kitchen-header-btn min-w-[44px] text-[14px] text-white md:min-w-[48px] md:text-[17px]"
          >
            ↻ 更新
          </button>
          <Link
            href="/kitchen/connect"
            className="kitchen-header-btn text-[14px] text-white/90 md:text-[17px]"
          >
            接続
          </Link>
        </div>
      </div>

      {connectionError && (
        <div className="mx-3 mt-3 rounded-xl bg-red-600 px-3 py-3 text-center text-[14px] font-bold md:mx-4 md:px-4 md:py-4 md:text-[18px]">
          ⚠ サーバーに接続できません。新しい注文が表示されていない可能性があります
        </div>
      )}

      {!initialLoaded && tickets.length === 0 && (
        <div className="mt-24 flex flex-col items-center gap-3 md:mt-32 md:gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-700 border-t-[var(--pos-accent)] md:h-9 md:w-9" />
          <p className="text-[15px] text-stone-500 md:text-[20px]">キッチンに接続中…</p>
        </div>
      )}

      {initialLoaded && tickets.length === 0 && (
        <div className="mt-24 flex flex-col items-center gap-2 text-center md:mt-32 md:gap-3">
          <p className="text-[18px] font-bold text-stone-500 md:text-[28px]">注文待ちはありません</p>
          <p className="text-[13px] text-stone-600 md:text-[16px]">
            新しい注文は自動で表示されます
            {lastUpdated &&
              ` · 最終更新 ${lastUpdated.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`}
          </p>
        </div>
      )}

      {tickets.length > 0 && (
        <div className="divide-y divide-stone-800">
          {tickets.map((ticket) => {
            const countdown = getServeCountdown(ticket.queuedAt, now);
            const note = formatOrderItemNote(ticket.orderItem.note);
            const ready = ticket.status === "DONE";
            const busy = busyTicketIds.has(ticket.id);
            return (
              <button
                key={ticket.id}
                type="button"
                disabled={busy}
                onClick={() => void advanceStatus(ticket)}
                className={`flex w-full items-stretch px-3 py-3 text-left disabled:opacity-50 md:px-5 md:py-5 ${
                  ready ? "bg-emerald-950/40" : "bg-stone-950"
                }`}
              >
                <div className="w-[64px] shrink-0 md:w-[96px]">
                  <p className="text-[20px] font-black leading-none md:text-[32px]">
                    {ticket.orderItem.order.table.name}
                  </p>
                  <p className="mt-1.5 text-[12px] tabular-nums text-stone-500 md:mt-2 md:text-[15px]">
                    {new Date(ticket.queuedAt).toLocaleTimeString("ja-JP", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div className="min-w-0 flex-1 px-2.5 md:px-4">
                  <p className="text-[17px] font-bold leading-snug md:text-[28px]">
                    {ticket.orderItem.productName}
                    {ticket.orderItem.quantity > 1 && (
                      <span className="ml-1.5 text-[16px] text-amber-400 md:ml-2 md:text-[26px]">
                        ×{ticket.orderItem.quantity}
                      </span>
                    )}
                  </p>
                  {note && (
                    <p className="mt-1.5 text-[14px] leading-snug text-amber-300 md:mt-2 md:text-[20px]">
                      {note}
                    </p>
                  )}
                </div>
                <div className="flex w-[96px] shrink-0 flex-col items-end justify-center gap-1.5 md:w-[140px] md:gap-2">
                  <span
                    className={`rounded-full px-2 py-1 text-[11px] font-bold md:px-3 md:py-1.5 md:text-[16px] ${
                      ready ? "bg-emerald-500 text-stone-900" : "bg-red-500 text-white"
                    }`}
                  >
                    {ready ? "提供済みにする" : "完了にする"}
                  </span>
                  <span
                    className={`text-[12px] font-bold tabular-nums md:text-[16px] ${countdownBadgeClass(countdown.urgency)}`}
                  >
                    {countdown.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
