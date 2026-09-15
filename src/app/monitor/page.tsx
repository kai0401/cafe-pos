"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { POS_ACCENT } from "@/lib/pos-theme";

type WeatherSnap = {
  date: string;
  locationName: string;
  label: string;
  tempMax: number | null;
  tempMin: number | null;
  precipitation: number;
};

type OpsSnapshot = {
  generatedAt: string;
  source: "live" | "heartbeat";
  mode: "cloud" | "local";
  cloud: boolean;
  ok: boolean;
  db: "ok" | "error";
  hostname: string | null;
  lanIp: string | null;
  shopPublicUrl?: string | null;
  qrPrintUrl?: string | null;
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
  printer: {
    supported: boolean;
    ip: string | null;
    reachable: boolean | null;
    status: "ok" | "offline" | "unchecked" | "cloud";
    detail: string;
  };
  weather: {
    locationName: string;
    today: WeatherSnap | null;
    tomorrow: WeatherSnap | null;
  };
  outlook: {
    todayDow: string;
    tomorrowDow: string;
    sameDateLastYear: { date: string; netSales: number | null };
    sameWeekdayLastYear: { date: string; netSales: number | null };
    ratioVsSameDate: number | null;
    ratioVsSameWeekday: number | null;
    projectedToday: number | null;
    projectedTomorrow: number | null;
    weekdayAvgToday: number | null;
    weekdayAvgTomorrow: number | null;
    sampleCountToday: number;
    sampleCountTomorrow: number;
  };
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
      <p className="mt-0.5 text-[26px] font-bold tabular-nums leading-none text-stone-900">{value}</p>
      {sub && <p className="mt-1 text-[12px] text-stone-400">{sub}</p>}
    </div>
  );
}

function weatherEmoji(label: string): string {
  if (label.includes("雷")) return "⛈";
  if (label.includes("雪")) return "❄";
  if (label.includes("雨")) return "🌧";
  if (label.includes("霧")) return "🌫";
  if (label.includes("曇")) return "☁";
  if (label.includes("晴")) return "☀";
  return "🌤";
}

function WeatherRow({ title, w, dow }: { title: string; w: WeatherSnap | null; dow: string }) {
  if (!w) {
    return (
      <div className="rounded-xl bg-sky-50 px-4 py-3">
        <p className="text-[14px] font-semibold text-stone-800">
          {title}（{dow}）
        </p>
        <p className="mt-2 text-[16px] text-stone-500">取得中…</p>
      </div>
    );
  }
  const temp =
    w.tempMax != null && w.tempMin != null
      ? `${Math.round(w.tempMin)}〜${Math.round(w.tempMax)}℃`
      : w.tempMax != null
        ? `最高 ${Math.round(w.tempMax)}℃`
        : "—";
  const wet = w.precipitation >= 1;
  return (
    <div className={`rounded-xl px-4 py-3 ${wet ? "bg-sky-100" : "bg-amber-50"}`}>
      <p className="text-[13px] font-semibold text-stone-700">
        {title}（{dow}） · {w.date}
      </p>
      <div className="mt-2 flex items-center gap-3">
        <span className="text-[36px] leading-none" aria-hidden>
          {weatherEmoji(w.label)}
        </span>
        <div className="min-w-0">
          <p className="text-[24px] font-black leading-none text-stone-900">{w.label}</p>
          <p className="mt-1.5 text-[18px] font-bold tabular-nums text-stone-800">{temp}</p>
          <p className={`mt-1 text-[14px] font-semibold ${wet ? "text-sky-800" : "text-stone-600"}`}>
            降水 {w.precipitation.toFixed(1)} mm
          </p>
        </div>
      </div>
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
            <Link href="/monitor/install" className="rounded-xl bg-white/15 px-3 py-2 text-[14px]">
              追加
            </Link>
            <Link href="/admin/dashboard" className="rounded-xl bg-white/15 px-3 py-2 text-[14px]">
              管理
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-4 py-5">
        {loading && !data && <p className="py-16 text-center text-stone-500">読み込み中…</p>}
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-800">{error}</div>
        )}

        {data && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill ok={shopOnline} label={shopOnline ? "店舗オンライン" : "店舗オフライン / 要確認"} />
              <StatusPill ok={data.db === "ok"} label={data.db === "ok" ? "DB OK" : "DB 異常"} />
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
                <Link
                  href="/remote"
                  className="mt-4 inline-flex text-[14px] font-semibold"
                  style={{ color: POS_ACCENT }}
                >
                  取引履歴・月次売上 →
                </Link>
              </Card>

              <Card title={`天気 · ${data.weather.locationName}`}>
                <div className="space-y-3">
                  <WeatherRow title="今日" w={data.weather.today} dow={data.outlook.todayDow} />
                  <WeatherRow title="明日" w={data.weather.tomorrow} dow={data.outlook.tomorrowDow} />
                </div>
              </Card>

              <Card title="前年比・見込み">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Metric
                      label="対 前年同日"
                      value={
                        data.outlook.ratioVsSameDate != null
                          ? `${data.outlook.ratioVsSameDate}%`
                          : "—"
                      }
                      sub={
                        data.outlook.sameDateLastYear.netSales != null
                          ? `${data.outlook.sameDateLastYear.date} ${yen(data.outlook.sameDateLastYear.netSales)}`
                          : "前年データなし"
                      }
                    />
                    <Metric
                      label="対 前年同曜"
                      value={
                        data.outlook.ratioVsSameWeekday != null
                          ? `${data.outlook.ratioVsSameWeekday}%`
                          : "—"
                      }
                      sub={
                        data.outlook.sameWeekdayLastYear.netSales != null
                          ? `${data.outlook.sameWeekdayLastYear.date} ${yen(data.outlook.sameWeekdayLastYear.netSales)}`
                          : "前年データなし"
                      }
                    />
                  </div>
                  <div className="border-t border-stone-100 pt-3 grid grid-cols-2 gap-3">
                    <Metric
                      label={`今日見込み（${data.outlook.todayDow}）`}
                      value={
                        data.outlook.projectedToday != null
                          ? yen(data.outlook.projectedToday)
                          : "—"
                      }
                      sub={`直近同曜平均 · ${data.outlook.sampleCountToday}日`}
                    />
                    <Metric
                      label={`明日見込み（${data.outlook.tomorrowDow}）`}
                      value={
                        data.outlook.projectedTomorrow != null
                          ? yen(data.outlook.projectedTomorrow)
                          : "—"
                      }
                      sub={`直近同曜平均 · ${data.outlook.sampleCountTomorrow}日`}
                    />
                  </div>
                </div>
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

              <Card
                title="プリンター"
                tone={data.printer.status === "offline" ? "warn" : data.printer.status === "ok" ? "ok" : "default"}
              >
                <p className="text-[15px] font-semibold leading-relaxed text-stone-800">
                  {data.printer.detail}
                </p>
                <p className="mt-2 text-[12px] text-stone-400">
                  店内LAN・電源ONのときのみ到達確認できます（心拍とは別）
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
                title="お客様QR（LTE）"
                tone={data.shopPublicUrl ? "ok" : "warn"}
              >
                <p className="text-[13px] leading-relaxed text-stone-700">
                  印刷入口: {data.qrPrintUrl ?? "https://azumaya-pos.vercel.app"}
                  <br />
                  転送先: {data.shopPublicUrl ?? "トンネル未接続"}
                </p>
              </Card>

              <Card
                title="店舗心拍"
                tone={data.heartbeat?.stale ? "warn" : data.heartbeat ? "ok" : "default"}
              >
                <p className="text-[15px] text-stone-700">
                  {data.heartbeat?.receivedAt
                    ? `${ageLabel(data.heartbeat.ageSeconds)}（${data.heartbeat.source ?? "shop"}）`
                    : "未受信"}
                </p>
              </Card>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-white px-4 py-4">
              <p className="text-[13px] font-medium text-stone-500">くわしい売上・取引履歴</p>
              <Link
                href="/remote"
                className="mt-2 inline-flex text-[16px] font-semibold"
                style={{ color: POS_ACCENT }}
              >
                月次・取引明細を開く →
              </Link>
            </div>

            <p className="pb-8 text-center text-[12px] text-stone-400">
              15秒ごとに自動更新 · 天気は日暮里駅周辺 · 見込みは直近同曜日の平均
            </p>
          </>
        )}
      </main>
    </div>
  );
}
