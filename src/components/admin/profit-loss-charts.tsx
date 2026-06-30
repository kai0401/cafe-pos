"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatYen } from "@/lib/format";

const CHART_GRID = "rgba(154, 146, 136, 0.12)";
const CHART_TICK = "#9a9288";

function DarkTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; name: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="border border-[#2a241c] bg-[#12100e]/95 px-3 py-2 text-xs shadow-xl backdrop-blur-sm">
      <p className="mb-1 text-[#9a9288]">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="font-mono font-semibold text-[#f0d78c]">
          {formatYen(p.value)}
        </p>
      ))}
    </div>
  );
}

export function ProfitLossDailyChart({
  data,
}: {
  data: { date: string; dayOfWeek: string; revenue: number }[];
}) {
  const chartData = data.map((d) => ({
    label: `${d.date.slice(5)} (${d.dayOfWeek})`,
    revenue: d.revenue,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="plRevenueGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d4af37" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#d4af37" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={CHART_GRID} strokeDasharray="4 4" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: CHART_TICK, fontSize: 10 }}
          interval="preserveStartEnd"
          tickLine={false}
          axisLine={{ stroke: CHART_GRID }}
        />
        <YAxis
          tick={{ fill: CHART_TICK, fontSize: 10 }}
          tickFormatter={(v) => `${(Number(v) / 10000).toFixed(0)}万`}
          tickLine={false}
          axisLine={false}
          width={42}
        />
        <Tooltip content={<DarkTooltip />} />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="#d4af37"
          strokeWidth={2}
          fill="url(#plRevenueGrad)"
          dot={false}
          activeDot={{ r: 4, fill: "#f0d78c", stroke: "#d4af37", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ProfitLossCategoryChart({
  data,
}: {
  data: { name: string; profit: number; revenue: number }[];
}) {
  const top = data.slice(0, 8);
  const colors = ["#d4af37", "#c9a227", "#b8942f", "#a08030", "#8a7340", "#6ecf9a", "#5cb88a", "#4a9a72"];

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, top.length * 36)}>
      <BarChart data={top} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={CHART_GRID} strokeDasharray="4 4" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: CHART_TICK, fontSize: 10 }}
          tickFormatter={(v) => `${(Number(v) / 10000).toFixed(0)}万`}
          tickLine={false}
          axisLine={{ stroke: CHART_GRID }}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: CHART_TICK, fontSize: 11 }}
          width={72}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip content={<DarkTooltip />} />
        <Bar dataKey="profit" radius={[0, 3, 3, 0]} barSize={14}>
          {top.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
