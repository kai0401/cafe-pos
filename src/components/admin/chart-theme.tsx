"use client";

import { formatYen } from "@/lib/format";

/** 管理画面チャート共通トーン（globals.css の --admin-* に対応） */
export const CHART_ACCENT = "#9a5c38";
export const CHART_SAGE = "#5c6b54";
export const CHART_VERMILLION = "#b84a3a";
export const CHART_GOLD = "#c9a227";
export const CHART_MUTED = "#8a7d70";
export const CHART_GRID = "rgba(138, 125, 112, 0.18)";
export const CHART_TICK = { fill: CHART_MUTED, fontSize: 11 } as const;

/** 円グラフ等の系列色（ブラウン→セージ→暖色系で編集紙面に馴染む順） */
export const CHART_SERIES = [
  CHART_ACCENT,
  CHART_SAGE,
  "#b87a52",
  "#8a9a80",
  CHART_GOLD,
  CHART_VERMILLION,
  CHART_MUTED,
  "#6b5544",
];

type TooltipPayload = { value: number; name?: string; payload?: Record<string, unknown> };

/** 紙面トーンの共通ツールチップ */
export function AdminChartTooltip({
  active,
  payload,
  label,
  nameMap,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
  nameMap?: Record<string, string>;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[var(--admin-line)] bg-[var(--admin-paper-raised)] px-3 py-2 text-xs shadow-md">
      {label != null && label !== "" && <p className="mb-1 text-[var(--admin-muted)]">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="font-medium tabular-nums text-[var(--admin-ink)]">
          {p.name && nameMap?.[p.name] ? `${nameMap[p.name]} ` : ""}
          {formatYen(p.value)}
        </p>
      ))}
    </div>
  );
}
