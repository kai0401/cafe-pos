"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { POS_ACCENT } from "@/lib/pos-theme";

type OpsSnapshot = {
  generatedAt: string;
  source: "live" | "heartbeat";
  mode: "cloud" | "local";
  cloud: boolean;
  ok: boolean;
  db: "ok" | "error";
  hostname: string | null;
  lanIp: string | null;
  note?: string;
  setup: { ready: boolean; products: number; tables: number };
  sales: {
    businessDate: string;
    salesCount: number;
    salesTotal: number;
    netTotal: number;
    customerCount: number;
    openOrderCount: number;
  } | null;
  floor: { occupiedTables: number; emptyTables: number; openOrders: number };
  kitchen: { waiting: number; ready: number; totalOpen: number };
  printer: { supported: boolean; ip: string | null; reachable: boolean | null };
  heartbeat: {
    receivedAt: string | null;
    ageSeconds: number | null;
    stale: boolean;
    source: string | null;
  } | null;
};

function yen(n: number) {
  return `¥${n.toLocaleString("ja-JP")}`;
}

function ageLabel(sec: number | null | undefined) {
  if (sec == null) return "—";
  if (sec < 60) return `${sec}秒前`;
  if (sec < 3600) return `${Math.floor(sec / 60)}分前`;
  return `${Math.floor(sec / 3600)}時間前`;
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-[13px] font-semibold ${
        ok ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
      }`}
    >
      {ok ? "●" : "○"} {label}
    </span>
  );
}

function Card({
  title,
  children,
  tone = "default",
}: {
  title: string;
  children: React.ReactNode;
  tone?: "default" | "warn" | "ok";
}) {
  const border =
    tone === "warn"
      ? "border-amber-300"
      : tone === "ok"
        ? "border-emerald-300"
        : "border-stone-200";
  return (
    <section className={`rounded-2xl border bg-white p-5 shadow-sm ${border}`}>
      <h2 className="text-[13px] font-semibold tracking-wide text-stone-500">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-[12px] text-stone-500">{label}</p>
      <p className="mt-0.5 text-[28px] font-bold tabular-nums leading-none text-stone-900">{value}</p>
      {sub && <p className="mt-1 text-[12px] text-stone-400">{sub}</p>}
    </div>
  );
}

export default function MonitorPage() {
  const [data, setData] = useState<OpsSnapshot | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/ops/snapshot", { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = `/staff?next=${encodeURIComponent("/monitor")}`;
        return;
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "取得失敗");
      setData(json);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "取得失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const poll = setInterval(() => void load(), 15_000);
    const clock = setInterval(() => setTick((n) => n + 1), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [load]);

  const shopOnline =
    data?.source === "live"
      ? data.ok
      : Boolean(data?.heartbeat && !data.heartbeat.stale && data.ok);

  return (
    <div className="min-h-screen bg-[#f6f1ea] text-stone-900">
      <header
        className="sticky top-0 z-10 border-b border-black/5 px-4 py-4 text-white"
        style={{ backgroundColor: POS_ACCENT }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div>
            <p className="text-[12px] font-medium text-white/80">あづま家 · 遠隔モニター</p>
            <h1 className="text-[22px] font-bold tracking-tight">店舗ダッシュボード</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-xl bg-white/15 px-3 py-2 text-[14px] font-semibold"
            >
              更新
            </button>
            <Link href="/admin/dashboard" className="rounded-xl bg-white/15 px-3 py-2 text-[14px]">
              管理
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-4 py-5">
        {loading && !data && (
          <p className="py-16 text-center text-stone-500">読み込み中…</p>
        )}
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-800">
            {error}
          </div>
        )}

        {data && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill ok={shopOnline} label={shopOnline ? "店舗オンライン" : "店舗オフライン / 要確認"} />
              <StatusPill ok={data.db === "ok"} label={data.db === "ok" ? "DB OK" : "DB 異常"} />
              <StatusPill
                ok={data.setup.ready}
                label={data.setup.ready ? "セットアップ済" : "セットアップ未完了"}
              />
              <span className="text-[12px] text-stone-500">
                {data.source === "heartbeat" ? "店舗心拍" : "ライブ"} · {data.mode}
                {tick >= 0 && data.generatedAt
                  ? ` · ${new Date(data.generatedAt).toLocaleTimeString("ja-JP")}`
                  : ""}
              </span>
            </div>

            {data.note && (
              <p className="rounded-xl bg-amber-50 px-4 py-3 text-[13px] text-amber-900">{data.note}</p>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Card title="本日の売上" tone="ok">
                <Metric
                  label={data.sales?.businessDate ?? "本日"}
                  value={data.sales ? yen(data.sales.netTotal) : "—"}
                  sub={
                    data.sales
                      ? `${data.sales.salesCount}件 · 客数 ${data.sales.customerCount}`
                      : undefined
                  }
                />
              </Card>

              <Card title="フロア" tone={data.floor.openOrders > 0 ? "warn" : "default"}>
                <div className="grid grid-cols-2 gap-4">
                  <Metric label="使用中卓" value={String(data.floor.occupiedTables)} />
                  <Metric label="未会計" value={String(data.floor.openOrders)} />
                </div>
              </Card>

              <Card title="キッチン" tone={data.kitchen.waiting > 0 ? "warn" : "default"}>
                <div className="grid grid-cols-2 gap-4">
                  <Metric label="調理中" value={String(data.kitchen.waiting)} />
                  <Metric label="提供待ち" value={String(data.kitchen.ready)} />
                </div>
              </Card>

              <Card title="プリンター">
                <p className="text-[16px] font-semibold">
                  {!data.printer.supported
                    ? "クラウド（直接印刷なし）"
                    : data.printer.reachable == null
                      ? data.printer.ip
                        ? `${data.printer.ip}（未確認）`
                        : "未設定"
                      : data.printer.reachable
                        ? `${data.printer.ip} · 到達OK`
                        : `${data.printer.ip} · 到達不可`}
                </p>
              </Card>

              <Card title="サーバー">
                <p className="text-[15px] leading-relaxed text-stone-700">
                  {data.hostname ?? "—"}
                  {data.lanIp ? ` · ${data.lanIp}` : ""}
                  <br />
                  商品 {data.setup.products} · 卓 {data.setup.tables}
                </p>
              </Card>

              <Card
                title="心拍"
                tone={data.heartbeat?.stale ? "warn" : data.heartbeat ? "ok" : "default"}
              >
                <p className="text-[15px] text-stone-700">
                  {data.heartbeat?.receivedAt
                    ? `${ageLabel(data.heartbeat.ageSeconds)}（${data.heartbeat.source ?? "shop"}）`
                    : "未受信（店内モニターまたは心拍設定が必要）"}
                </p>
              </Card>
            </div>

            <p className="pb-8 text-center text-[12px] text-stone-400">
              15秒ごとに自動更新 · クラウドでは店舗からの心拍を優先表示
            </p>
          </>
        )}
      </main>
    </div>
  );
}
