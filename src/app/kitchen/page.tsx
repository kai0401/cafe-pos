"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

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
const STATUS_LABEL: Record<string, string> = {
  NEW: "新規",
  COOKING: "調理中",
  DONE: "完了",
  SERVED: "提供済",
};

export default function KitchenPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const prevCount = useRef(0);

  const load = useCallback(async () => {
    const res = await fetch("/api/kitchen/tickets");
    const data: Ticket[] = await res.json();
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
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [load]);

  async function advanceStatus(ticket: Ticket) {
    const idx = STATUS_FLOW.indexOf(ticket.status as (typeof STATUS_FLOW)[number]);
    const next = STATUS_FLOW[idx + 1];
    if (!next) return;
    await fetch("/api/kitchen/tickets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId: ticket.id, status: next }),
    });
    load();
  }

  const newTickets = tickets.filter((t) => t.status === "NEW");
  const cookingTickets = tickets.filter((t) => t.status === "COOKING");
  const doneTickets = tickets.filter((t) => t.status === "DONE");

  function TicketCard({ ticket, urgent }: { ticket: Ticket; urgent?: boolean }) {
    const ageMin = Math.floor((Date.now() - new Date(ticket.queuedAt).getTime()) / 60000);
    return (
      <div
        className={`rounded-2xl p-5 ${urgent ? "bg-red-900 ring-2 ring-red-400" : "bg-stone-800"} ${ageMin >= 15 ? "animate-pulse" : ""}`}
      >
        <div className="flex items-baseline justify-between">
          <span className="text-4xl font-black">{ticket.orderItem.order.table.name}</span>
          <span className="text-sm text-stone-400">
            {new Date(ticket.queuedAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
            {ageMin >= 10 && <span className="ml-2 text-red-400">{ageMin}分</span>}
          </span>
        </div>
        <p className="mt-3 text-2xl font-bold leading-snug">
          {ticket.orderItem.productName}
          <span className="ml-2 text-amber-400">×{ticket.orderItem.quantity}</span>
        </p>
        {ticket.orderItem.note && (
          <p className="mt-2 text-lg text-amber-300">📝 {ticket.orderItem.note}</p>
        )}
        <button
          type="button"
          onClick={() => advanceStatus(ticket)}
          className="mt-4 w-full rounded-xl bg-amber-500 py-4 text-xl font-bold text-stone-900 active:bg-amber-400"
        >
          {ticket.status === "NEW" && "調理開始"}
          {ticket.status === "COOKING" && "完了"}
          {ticket.status === "DONE" && "提供済"}
        </button>
        <p className="mt-2 text-center text-xs text-stone-500">{STATUS_LABEL[ticket.status]}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 p-4 text-white">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-black">キッチン</h1>
        <div className="flex gap-4">
          <button type="button" onClick={load} className="text-amber-400">
            ↻ 更新
          </button>
          <Link href="/waiter" className="text-amber-400">
            ウェイター
          </Link>
        </div>
      </div>

      {newTickets.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-lg font-bold text-red-400">🔔 新規 ({newTickets.length})</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {newTickets.map((t) => (
              <TicketCard key={t.id} ticket={t} urgent />
            ))}
          </div>
        </section>
      )}

      {cookingTickets.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-lg font-bold text-amber-400">調理中 ({cookingTickets.length})</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {cookingTickets.map((t) => (
              <TicketCard key={t.id} ticket={t} />
            ))}
          </div>
        </section>
      )}

      {doneTickets.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-lg font-bold text-green-400">完了 ({doneTickets.length})</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {doneTickets.map((t) => (
              <TicketCard key={t.id} ticket={t} />
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
