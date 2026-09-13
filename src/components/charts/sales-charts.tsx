"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AdminChartTooltip,
  CHART_ACCENT,
  CHART_GRID,
  CHART_MUTED,
  CHART_SAGE,
  CHART_SERIES,
  CHART_TICK,
  CHART_VERMILLION,
} from "@/components/admin/chart-theme";

function toMan(v: number | string) {
  return `${(Number(v) / 10000).toFixed(0)}万`;
}

export function SalesLineChart({
  data,
}: {
  data: { date: string; sales: number; cumulative?: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="4 4" stroke={CHART_GRID} vertical={false} />
        <XAxis dataKey="date" tick={CHART_TICK} tickFormatter={(v) => v.slice(5)} tickLine={false} axisLine={{ stroke: CHART_GRID }} />
        <YAxis tick={CHART_TICK} tickFormatter={toMan} tickLine={false} axisLine={false} width={44} />
        <Tooltip content={<AdminChartTooltip />} />
        <Line type="monotone" dataKey="sales" stroke={CHART_ACCENT} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#fffcf8", stroke: CHART_ACCENT, strokeWidth: 2 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function HourlyBarChart({
  data,
}: {
  data: { label: string; sales: number; band?: string }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="4 4" stroke={CHART_GRID} vertical={false} />
        <XAxis dataKey="label" tick={CHART_TICK} tickLine={false} axisLine={{ stroke: CHART_GRID }} />
        <YAxis tick={CHART_TICK} tickFormatter={toMan} tickLine={false} axisLine={false} width={44} />
        <Tooltip content={<AdminChartTooltip />} cursor={{ fill: "rgba(154, 92, 56, 0.06)" }} />
        <Bar dataKey="sales" fill={CHART_ACCENT} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ProductBarChart({
  data,
}: {
  data: { name: string; sales: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid strokeDasharray="4 4" stroke={CHART_GRID} horizontal={false} />
        <XAxis type="number" tick={CHART_TICK} tickFormatter={toMan} tickLine={false} axisLine={{ stroke: CHART_GRID }} />
        <YAxis type="category" dataKey="name" tick={{ ...CHART_TICK, fontSize: 11 }} width={104} tickLine={false} axisLine={false} />
        <Tooltip content={<AdminChartTooltip />} cursor={{ fill: "rgba(154, 92, 56, 0.06)" }} />
        <Bar dataKey="sales" radius={[0, 3, 3, 0]} barSize={16}>
          {data.map((_, i) => (
            <Cell key={i} fill={i % 2 === 0 ? CHART_ACCENT : CHART_SAGE} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PaymentPieChart({
  data,
}: {
  data: { label: string; amount: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="amount" nameKey="label" cx="50%" cy="50%" outerRadius={90} label={({ name }) => name}>
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_SERIES[i % CHART_SERIES.length]} />
          ))}
        </Pie>
        <Tooltip content={<AdminChartTooltip />} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function WeekdayBarChart({
  data,
}: {
  data: { label: string; sales: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="4 4" stroke={CHART_GRID} vertical={false} />
        <XAxis dataKey="label" tick={CHART_TICK} tickLine={false} axisLine={{ stroke: CHART_GRID }} />
        <YAxis tick={CHART_TICK} tickFormatter={toMan} tickLine={false} axisLine={false} width={44} />
        <Tooltip content={<AdminChartTooltip />} cursor={{ fill: "rgba(154, 92, 56, 0.06)" }} />
        <Bar dataKey="sales" fill={CHART_SAGE} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

const PL_NAME_MAP = { revenue: "売上", expenses: "経費", profit: "利益" };

export function ProfitLossComboChart({
  data,
}: {
  data: { label: string; revenue: number; expenses: number; profit: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data}>
        <CartesianGrid strokeDasharray="4 4" stroke={CHART_GRID} vertical={false} />
        <XAxis dataKey="label" tick={CHART_TICK} tickLine={false} axisLine={{ stroke: CHART_GRID }} />
        <YAxis tick={CHART_TICK} tickFormatter={toMan} tickLine={false} axisLine={false} width={44} />
        <Tooltip content={<AdminChartTooltip nameMap={PL_NAME_MAP} />} cursor={{ fill: "rgba(154, 92, 56, 0.06)" }} />
        <Bar dataKey="revenue" name="revenue" fill={CHART_ACCENT} radius={[3, 3, 0, 0]} />
        <Bar dataKey="expenses" name="expenses" fill={CHART_VERMILLION} radius={[3, 3, 0, 0]} />
        <Line type="monotone" dataKey="profit" name="profit" stroke={CHART_SAGE} strokeWidth={2} dot={{ r: 3, fill: CHART_SAGE }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function RatioGauge({
  label,
  value,
  target,
}: {
  label: string;
  value: number;
  target: number;
}) {
  const pct = Math.min(100, value);
  const over = value > target;
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-sm">
        <span className="font-medium text-[var(--admin-ink)]">{label}</span>
        <span
          className={`font-semibold tabular-nums ${over ? "text-[var(--admin-vermillion)]" : "text-[var(--admin-sage)]"}`}
        >
          {value}%{" "}
          <span className="text-xs font-normal text-[var(--admin-muted)]">目標 {target}%</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--admin-line)]/70">
        <div
          className={`h-full rounded-full transition-all ${over ? "bg-[var(--admin-vermillion)]" : "bg-[var(--admin-sage)]"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function EatInPieChart({
  dineIn,
  takeout,
}: {
  dineIn: number;
  takeout: number;
}) {
  const data = [
    { label: "イートイン", amount: dineIn },
    { label: "テイクアウト", amount: takeout },
  ].filter((d) => d.amount > 0);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="amount" nameKey="label" cx="50%" cy="50%" outerRadius={80} label={({ name }) => name}>
          {data.map((_, i) => (
            <Cell key={i} fill={i === 0 ? CHART_ACCENT : CHART_SAGE} />
          ))}
        </Pie>
        <Tooltip content={<AdminChartTooltip />} />
      </PieChart>
    </ResponsiveContainer>
  );
}
