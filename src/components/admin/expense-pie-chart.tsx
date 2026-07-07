"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { EXPENSE_CATEGORY_LABELS, formatYen } from "@/lib/format";

const COLORS = [
  "#b45309",
  "#dc2626",
  "#059669",
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#0891b2",
  "#65a30d",
  "#78716c",
];

export function ExpenseCategoryPieChart({
  data,
}: {
  data: { category: string; amount: number }[];
}) {
  const chartData = data.map((d) => ({
    name: EXPENSE_CATEGORY_LABELS[d.category] ?? d.category,
    value: d.amount,
    category: d.category,
  }));

  if (chartData.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-stone-400">
        経費データがありません
      </p>
    );
  }

  const total = chartData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
      <div className="mx-auto w-full max-w-[280px]">
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={95}
              paddingAngle={2}
              label={({ name, percent }) =>
                percent && percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ""
              }
              labelLine={false}
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v) => formatYen(Number(v))}
              labelFormatter={(label) => label}
            />
          </PieChart>
        </ResponsiveContainer>
        <p className="text-center text-sm font-semibold text-stone-700">
          合計 {formatYen(total)}
        </p>
      </div>

      <ul className="min-w-0 flex-1 space-y-2">
        {chartData.map((d, i) => (
          <li key={d.category} className="flex items-center gap-2 text-sm">
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
            />
            <span className="min-w-0 flex-1 truncate text-stone-700">{d.name}</span>
            <span className="shrink-0 font-semibold tabular-nums text-stone-900">
              {formatYen(d.value)}
            </span>
            <span className="shrink-0 text-xs text-stone-400 w-10 text-right">
              {total > 0 ? `${Math.round((d.value / total) * 100)}%` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
