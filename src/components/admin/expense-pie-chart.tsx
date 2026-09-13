"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { EXPENSE_CATEGORY_LABELS, formatYen } from "@/lib/format";
import { AdminChartTooltip, CHART_SERIES } from "@/components/admin/chart-theme";

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
      <p className="py-16 text-center text-sm text-[var(--admin-muted)]">
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
                <Cell key={i} fill={CHART_SERIES[i % CHART_SERIES.length]} />
              ))}
            </Pie>
            <Tooltip content={<AdminChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <p className="text-center text-sm font-semibold text-[var(--admin-ink)]">
          合計 {formatYen(total)}
        </p>
      </div>

      <ul className="min-w-0 flex-1 space-y-2">
        {chartData.map((d, i) => (
          <li key={d.category} className="flex items-center gap-2 text-sm">
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: CHART_SERIES[i % CHART_SERIES.length] }}
            />
            <span className="min-w-0 flex-1 truncate text-[var(--admin-ink)]">{d.name}</span>
            <span className="shrink-0 font-semibold tabular-nums text-[var(--admin-ink)]">
              {formatYen(d.value)}
            </span>
            <span className="w-10 shrink-0 text-right text-xs text-[var(--admin-muted)]">
              {total > 0 ? `${Math.round((d.value / total) * 100)}%` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
