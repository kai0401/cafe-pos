"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatYen } from "@/lib/format";

const COLORS = ["#b45309", "#d97706", "#f59e0b", "#78716c", "#a8a29e"];

export function SalesLineChart({
  data,
}: {
  data: { date: string; sales: number; cumulative?: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}万`} />
        <Tooltip formatter={(v) => formatYen(Number(v))} />
        <Line type="monotone" dataKey="sales" stroke="#b45309" strokeWidth={2} dot={false} />
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
        <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}万`} />
        <Tooltip formatter={(v, _n, p) => [formatYen(Number(v)), (p.payload as { band?: string }).band ?? ""]} />
        <Bar dataKey="sales" fill="#b45309" radius={[4, 4, 0, 0]} />
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
      <BarChart data={data} layout="vertical" margin={{ left: 80 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
        <XAxis type="number" tickFormatter={(v) => `${(v / 10000).toFixed(0)}万`} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
        <Tooltip formatter={(v) => formatYen(Number(v))} />
        <Bar dataKey="sales" fill="#92400e" radius={[0, 4, 4, 0]} />
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
        <Pie data={data} dataKey="amount" nameKey="label" cx="50%" cy="50%" outerRadius={90} label>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v) => formatYen(Number(v))} />
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
        <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
        <XAxis dataKey="label" />
        <YAxis tickFormatter={(v) => `${(v / 10000).toFixed(0)}万`} />
        <Tooltip formatter={(v) => formatYen(Number(v))} />
        <Bar dataKey="sales" fill="#78716c" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
