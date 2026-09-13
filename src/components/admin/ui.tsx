import { formatPercent, formatYen } from "@/lib/format";

export const ADMIN_INPUT_CLASS = "admin-input";

type KpiCardProps = {
  title: string;
  value: string;
  sub?: string;
  change?: number | null;
};

export function KpiCard({ title, value, sub, change }: KpiCardProps) {
  const changeColor =
    change === null || change === undefined
      ? "text-[var(--admin-muted)]"
      : change >= 0
        ? "text-[var(--admin-sage)]"
        : "text-[var(--admin-vermillion)]";

  return (
    <div className="admin-card p-5">
      <p className="admin-label !mb-2">{title}</p>
      <p className="admin-brand-serif text-2xl tracking-tight text-[var(--admin-ink)]">{value}</p>
      {change !== undefined && (
        <p className={`mt-1.5 text-sm font-medium ${changeColor}`}>{formatPercent(change)}</p>
      )}
      {sub && <p className="mt-1 text-xs text-[var(--admin-muted)]">{sub}</p>}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  children,
  eyebrow,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <header className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <p className="admin-label !mb-2 !text-[10px]">{eyebrow}</p>
        )}
        <h1 className="admin-brand-serif text-[1.75rem] leading-snug tracking-wide text-[var(--admin-ink)]">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-[var(--admin-muted)]">
            {description}
          </p>
        )}
      </div>
      {children && <div className="flex shrink-0 flex-wrap gap-2">{children}</div>}
    </header>
  );
}

export function StatTable({
  headers,
  rows,
  yenColumns = [],
}: {
  headers: string[];
  rows: (string | number)[][];
  yenColumns?: number[];
}) {
  return (
    <div className="admin-card overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="border-b border-[var(--admin-line)] text-left text-[var(--admin-muted)]">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-3 text-xs font-medium tracking-wider">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-t border-[var(--admin-line)]/60 transition-colors hover:bg-[var(--admin-accent-soft)]/40"
            >
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 text-[var(--admin-ink)]">
                  {typeof cell === "number"
                    ? yenColumns.includes(j)
                      ? formatYen(cell)
                      : cell.toLocaleString("ja-JP")
                    : cell}
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
    <label className="flex cursor-pointer items-center gap-2 rounded-full border border-[var(--admin-line)] bg-[var(--admin-paper-raised)] px-4 py-2 text-sm text-[var(--admin-ink)]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-[var(--admin-line)] accent-[var(--admin-accent)]"
      />
      {label}
    </label>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="admin-card border-dashed p-14 text-center">
      <p className="text-sm leading-relaxed text-[var(--admin-muted)]">{message}</p>
      <a
        href="/admin/imports"
        className="mt-5 inline-block text-sm text-[var(--admin-accent)] underline-offset-4 hover:underline"
      >
        CSVをインポートする
      </a>
    </div>
  );
}

export function UploadIcon({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      aria-hidden
    >
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <circle cx="12" cy="11" r="3" />
      <path d="M8 17h8" strokeLinecap="round" />
    </svg>
  );
}
