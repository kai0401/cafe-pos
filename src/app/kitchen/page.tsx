"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

export default function KitchenPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [connectionError, setConnectionError] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const prevCount = useRef(0);
  const loadingRef = useRef(false);
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
      setTickets(data);
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

  const openTickets = useMemo(
    () =>
      [...tickets].sort(
        (a, b) => new Date(a.queuedAt).getTime() - new Date(b.queuedAt).getTime(),
      ),
    [tickets],
  );
  const waitingCount = tickets.filter((t) => t.status === "NEW" || t.status === "COOKING").length;
  const readyCount = tickets.filter((t) => t.status === "DONE").length;

  return (
    <div className="min-h-screen bg-stone-950 pb-safe text-white">
      <div className="kitchen-top-bar sticky top-0 z-20 flex items-center justify-between bg-[var(--pos-accent)] px-4 text-white">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[22px] font-black">キッチン</h1>
          <span className="rounded-full bg-white/20 px-2.5 py-1 text-[13px] font-bold">
            未完了 {waitingCount}
          </span>
          <span className="rounded-full bg-white/20 px-2.5 py-1 text-[13px] font-bold">
            提供待ち {readyCount}
          </span>
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] text-white/90">
            提供目標 {KITCHEN_SERVE_TARGET_MINUTES}分
          </span>
        </div>
        <div className="flex shrink-0 gap-3">
          <button
            type="button"
            onClick={() => void load()}
            className="kitchen-header-btn min-w-[44px] text-[15px] text-white"
          >
            ↻ 更新
          </button>
          <Link href="/kitchen/connect" className="kitchen-header-btn text-[15px] text-white/90">
            接続
          </Link>
        </div>
      </div>

      {connectionError && (
        <div className="mx-4 mt-3 rounded-xl bg-red-600 px-4 py-3 text-center font-bold">
          ⚠ サーバーに接続できません。新しい注文が表示されていない可能性があります
        </div>
      )}

      {!initialLoaded && tickets.length === 0 && (
        <div className="mt-32 flex flex-col items-center gap-4">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-stone-700 border-t-[var(--pos-accent)]" />
          <p className="text-lg text-stone-500">キッチンに接続中…</p>
        </div>
      )}

      {initialLoaded && tickets.length === 0 && (
        <div className="mt-32 flex flex-col items-center gap-3 text-center">
          <p className="text-2xl font-bold text-stone-500">注文待ちはありません</p>
          <p className="text-[14px] text-stone-600">
            新しい注文は自動で表示されます
            {lastUpdated &&
              ` · 最終更新 ${lastUpdated.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`}
          </p>
        </div>
      )}

      {openTickets.length > 0 && (
        <div className="divide-y divide-stone-800">
          {openTickets.map((ticket) => {
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
                className={`flex w-full items-stretch px-4 py-4 text-left disabled:opacity-50 ${
                  ready ? "bg-emerald-950/40" : "bg-stone-950"
                }`}
              >
                <div className="w-[72px] shrink-0">
                  <p className="text-[22px] font-black leading-none">{ticket.orderItem.order.table.name}</p>
                  <p className="mt-1 text-[11px] tabular-nums text-stone-500">
                    {new Date(ticket.queuedAt).toLocaleTimeString("ja-JP", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div className="min-w-0 flex-1 px-3">
                  <p className="text-[20px] font-bold leading-snug">
                    {ticket.orderItem.productName}
                    {ticket.orderItem.quantity > 1 && (
                      <span className="ml-2 text-[18px] text-amber-400">×{ticket.orderItem.quantity}</span>
                    )}
                  </p>
                  {note && <p className="mt-1 text-[14px] text-amber-300">{note}</p>}
                </div>
                <div className="flex w-[108px] shrink-0 flex-col items-end justify-center gap-1">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[13px] font-bold ${
                      ready ? "bg-emerald-500 text-stone-900" : "bg-red-500 text-white"
                    }`}
                  >
                    {ready ? "提供済みにする" : "完了にする"}
                  </span>
                  <span className={`text-[12px] font-bold tabular-nums ${countdownBadgeClass(countdown.urgency)}`}>
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
