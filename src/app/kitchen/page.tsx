"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatOrderItemNote } from "@/lib/order-modifiers";
import { kitchenFetch } from "@/lib/kitchen-api";
import {
  countdownBadgeClass,
  countdownBarClass,
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

const STATUS_FLOW = ["NEW", "COOKING", "DONE", "SERVED"] as const;

export default function KitchenPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [connectionError, setConnectionError] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const prevCount = useRef(0);

  const loadingRef = useRef(false);

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
        if (typeof window !== "undefined" && "AudioContext" in window) {
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
      }
      prevCount.current = data.length;
      setTickets(data);
    } catch {
      setConnectionError(true);
    } finally {
      loadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(() => {
      if (document.hidden) return;
      load();
    }, 5000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  async function advanceStatus(ticket: Ticket) {
    const idx = STATUS_FLOW.indexOf(ticket.status as (typeof STATUS_FLOW)[number]);
    const next = STATUS_FLOW[idx + 1];
    if (!next) return;

    const prevStatus = ticket.status;
    setTickets((prev) =>
      prev.map((t) => (t.id === ticket.id ? { ...t, status: next } : t)),
    );

    try {
      const res = await kitchenFetch("/api/kitchen/tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: ticket.id, status: next }),
      });
      if (!res.ok) throw new Error("update failed");
    } catch {
      setTickets((prev) =>
        prev.map((t) => (t.id === ticket.id ? { ...t, status: prevStatus } : t)),
      );
      setConnectionError(true);
    }
  }

  const newTickets = tickets.filter((t) => t.status === "NEW");
  const cookingTickets = tickets.filter((t) => t.status === "COOKING");
  const doneTickets = tickets.filter((t) => t.status === "DONE");

  function TicketCard({
    ticket,
    urgent,
    tick,
  }: {
    ticket: Ticket;
    urgent?: boolean;
    tick: number;
  }) {
    const countdown = getServeCountdown(ticket.queuedAt, tick);
    const ageMin = Math.floor((tick - new Date(ticket.queuedAt).getTime()) / 60000);
    const actionColor =
      ticket.status === "NEW"
        ? "bg-red-500 text-white active:bg-red-400"
        : ticket.status === "COOKING"
          ? "bg-amber-500 text-stone-900 active:bg-amber-400"
          : "bg-emerald-500 text-stone-900 active:bg-emerald-400";
    return (
      <div
        className={`overflow-hidden rounded-2xl bg-stone-800 ${urgent ? "ring-2 ring-red-400" : ""} ${countdown.overdue ? "animate-pulse" : ""}`}
      >
        <div className="h-1.5 w-full bg-stone-700">
          <div
            className={`h-full transition-[width] duration-1000 ease-linear ${countdownBarClass(countdown.urgency)}`}
            style={{ width: `${Math.round(countdown.progress * 100)}%` }}
          />
        </div>
        <div className="flex items-center justify-between bg-stone-700/60 px-4 py-2.5">
          <span className="text-3xl font-black leading-none">{ticket.orderItem.order.table.name}</span>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-stone-400">
                {new Date(ticket.queuedAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-[14px] font-bold leading-none tabular-nums ${countdownBadgeClass(countdown.urgency)}`}
              >
                {countdown.label}
              </span>
            </div>
            <span className="text-[11px] tabular-nums text-stone-500">経過 {ageMin}分</span>
          </div>
        </div>
        <div className="px-4 pb-4 pt-3">
          <p className="text-2xl font-bold leading-snug">
            {ticket.orderItem.productName}
            {ticket.orderItem.quantity > 1 && (
              <span className="ml-2 rounded-lg bg-amber-500/20 px-2 py-0.5 text-[22px] text-amber-400">
                ×{ticket.orderItem.quantity}
              </span>
            )}
          </p>
          {formatOrderItemNote(ticket.orderItem.note) && (
            <p className="mt-2 rounded-lg bg-amber-500/10 px-3 py-2 text-lg text-amber-300">
              📝 {formatOrderItemNote(ticket.orderItem.note)}
            </p>
          )}
          <button
            type="button"
            onClick={() => advanceStatus(ticket)}
            className={`mt-4 w-full rounded-xl py-4 text-xl font-bold ${actionColor}`}
          >
            {ticket.status === "NEW" && "調理開始"}
            {ticket.status === "COOKING" && "調理完了"}
            {ticket.status === "DONE" && "提供済にする"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="kitchen-top-bar min-h-screen bg-stone-950 p-4 pb-safe text-white">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-black">キッチン</h1>
          <div className="flex gap-1.5">
            <span className="rounded-full bg-red-500/20 px-2.5 py-1 text-[13px] font-bold text-red-400">
              新規 {newTickets.length}
            </span>
            <span className="rounded-full bg-amber-500/20 px-2.5 py-1 text-[13px] font-bold text-amber-400">
              調理中 {cookingTickets.length}
            </span>
            <span className="rounded-full bg-emerald-500/20 px-2.5 py-1 text-[13px] font-bold text-emerald-400">
              完了 {doneTickets.length}
            </span>
          </div>
          {lastUpdated && !connectionError && (
            <span className="hidden text-xs text-stone-500 sm:inline">
              {lastUpdated.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} 更新
            </span>
          )}
          <span className="rounded-full bg-stone-800 px-2.5 py-1 text-[11px] text-stone-400">
            提供目標 {KITCHEN_SERVE_TARGET_MINUTES}分
          </span>
        </div>
        <div className="flex shrink-0 gap-3">
          <button
            type="button"
            onClick={load}
            className="kitchen-header-btn min-w-[44px] text-[15px] text-amber-400"
          >
            ↻ 更新
          </button>
          <Link href="/kitchen/connect" className="kitchen-header-btn text-[15px] text-amber-400">
            接続
          </Link>
          <Link href="/waiter" className="kitchen-header-btn text-[15px] text-stone-500">
            ウェイター
          </Link>
        </div>
      </div>

      {connectionError && (
        <div className="mb-4 rounded-xl bg-red-600 px-4 py-3 text-center font-bold">
          ⚠ サーバーに接続できません。新しい注文が表示されていない可能性があります
        </div>
      )}

      {newTickets.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-lg font-bold text-red-400">🔔 新規 ({newTickets.length})</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {newTickets.map((t) => (
              <TicketCard key={t.id} ticket={t} tick={now} urgent />
            ))}
          </div>
        </section>
      )}

      {cookingTickets.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-lg font-bold text-amber-400">調理中 ({cookingTickets.length})</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {cookingTickets.map((t) => (
              <TicketCard key={t.id} ticket={t} tick={now} />
            ))}
          </div>
        </section>
      )}

      {doneTickets.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-lg font-bold text-green-400">完了 ({doneTickets.length})</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {doneTickets.map((t) => (
              <TicketCard key={t.id} ticket={t} tick={now} />
            ))}
          </div>
        </section>
      )}

      {tickets.length === 0 && (
        <p className="mt-32 text-center text-2xl text-stone-600">注文待ちはありません</p>
      )}
    </div>
  );
}
