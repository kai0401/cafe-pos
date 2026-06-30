import { formatPercent, formatYen } from "@/lib/format";

type KpiCardProps = {
  title: string;
  value: string;
  sub?: string;
  change?: number | null;
};

export function KpiCard({ title, value, sub, change }: KpiCardProps) {
  const changeColor =
    change === null || change === undefined
      ? "text-stone-400"
      : change >= 0
        ? "text-emerald-600"
        : "text-rose-600";

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-stone-500">{title}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-stone-900">{value}</p>
      {change !== undefined && (
        <p className={`mt-1 text-sm font-medium ${changeColor}`}>{formatPercent(change)}</p>
      )}
      {sub && <p className="mt-1 text-xs text-stone-400">{sub}</p>}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-stone-500">{description}</p>}
      </div>
      {children}
    </div>
  );
}

export function StatTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | number)[][];
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="bg-stone-50 text-left text-stone-600">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-stone-100">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 text-stone-800">
                  {typeof cell === "number" && j > 0 ? formatYen(cell) : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FilterToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-stone-300"
      />
      {label}
    </label>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-12 text-center">
      <p className="text-stone-600">{message}</p>
      <a href="/admin/imports" className="mt-4 inline-block text-sm font-medium text-amber-700 hover:underline">
        CSVをインポートする →
      </a>
    </div>
  );
}
