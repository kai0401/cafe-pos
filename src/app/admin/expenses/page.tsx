"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ExpenseCategoryPieChart } from "@/components/admin/expense-pie-chart";
import { ADMIN_INPUT_CLASS, KpiCard, PageHeader } from "@/components/admin/ui";
import { EXPENSE_CATEGORY_LABELS, formatYen } from "@/lib/format";

const CATEGORIES = Object.keys(EXPENSE_CATEGORY_LABELS);

type Expense = {
  id: string;
  category: string;
  amount: number;
  description: string | null;
  expenseDate: string;
  isRecurring: boolean;
  source?: string;
  merchantName?: string | null;
  receiptImagePath?: string | null;
};

type Summary = {
  total: number;
  count: number;
  byCategory: { category: string; amount: number }[];
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    category: "RENT",
    amount: "",
    description: "",
    expenseDate: new Date().toISOString().slice(0, 10),
    isRecurring: false,
  });

  const load = useCallback(() => {
    Promise.all([
      fetch("/api/admin/expenses").then((r) => r.json()),
      fetch("/api/admin/expenses?summary=1").then((r) => r.json()),
    ])
      .then(([list, sum]) => {
        setExpenses(list);
        setSummary(sum);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      });
      const data = await res.json();
      if (!res.ok) setMessage(data.error ?? "登録に失敗しました");
      else {
        setMessage("経費を登録しました");
        setForm((f) => ({ ...f, amount: "", description: "" }));
        load();
      }
    } finally {
      setLoading(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("この経費を削除しますか？")) return;
    await fetch(`/api/admin/expenses?id=${id}`, { method: "DELETE" });
    load();
  }

  const receiptCount = expenses.filter((e) => e.source === "RECEIPT_SCAN").length;

  return (
    <div>
      <PageHeader
        eyebrow="経費"
        title="経費管理"
        description="レシートから自動登録、または手入力で計上"
      >
        <Link href="/admin/expenses/scan" className="admin-btn admin-btn--accent">
          レシートを登録
        </Link>
      </PageHeader>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="今月の経費" value={formatYen(summary?.total ?? 0)} />
        <KpiCard title="登録件数" value={`${summary?.count ?? 0}件`} />
        <KpiCard title="レシート登録" value={`${receiptCount}件`} />
        <div className="admin-card flex flex-col justify-center p-5">
          <p className="admin-label">レシート</p>
          <Link
            href="/admin/expenses/scan"
            className="mt-2 text-sm text-[var(--admin-accent)] underline-offset-4 hover:underline"
          >
            写真から登録する
          </Link>
        </div>
      </div>

      <section className="admin-card mb-8 p-6">
        <h2 className="admin-brand-serif mb-5 text-base text-[var(--admin-ink)]">
          カテゴリ別（今月）
        </h2>
        <ExpenseCategoryPieChart data={summary?.byCategory ?? []} />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <form onSubmit={submit} className="admin-card space-y-4 p-6">
          <h2 className="admin-brand-serif text-base text-[var(--admin-ink)]">手入力</h2>

          <div>
            <label className="admin-label">カテゴリ</label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className={ADMIN_INPUT_CLASS}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {EXPENSE_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="admin-label">金額</label>
              <input
                type="number"
                required
                min={1}
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                className={ADMIN_INPUT_CLASS}
              />
            </div>
            <div>
              <label className="admin-label">計上日</label>
              <input
                type="date"
                required
                value={form.expenseDate}
                onChange={(e) => setForm((f) => ({ ...f, expenseDate: e.target.value }))}
                className={ADMIN_INPUT_CLASS}
              />
            </div>
          </div>

          <div>
            <label className="admin-label">メモ</label>
            <input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="例: 6月分家賃"
              className={ADMIN_INPUT_CLASS}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-[var(--admin-muted)]">
            <input
              type="checkbox"
              checked={form.isRecurring}
              onChange={(e) => setForm((f) => ({ ...f, isRecurring: e.target.checked }))}
              className="accent-[var(--admin-accent)]"
            />
            毎月発生する固定費
          </label>

          <button
            type="submit"
            disabled={loading}
            className="admin-btn admin-btn--primary w-full py-2.5"
          >
            {loading ? "登録中…" : "登録する"}
          </button>
          {message && <p className="text-sm text-[var(--admin-sage)]">{message}</p>}
        </form>

        <div className="admin-card overflow-hidden">
          <h2 className="admin-brand-serif border-b border-[var(--admin-line)] px-5 py-4 text-base text-[var(--admin-ink)]">
            登録済み
          </h2>
          {expenses.length === 0 ? (
            <p className="p-10 text-center text-sm text-[var(--admin-muted)]">
              レシートを登録するか、手入力で計上してください
            </p>
          ) : (
            <div className="divide-y divide-[var(--admin-line)]/60">
              {expenses.map((e) => (
                <div key={e.id} className="flex items-center gap-3 px-5 py-3.5">
                  {e.receiptImagePath && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/admin/receipts/image?path=${encodeURIComponent(e.receiptImagePath)}`}
                      alt=""
                      className="h-12 w-10 shrink-0 rounded object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[var(--admin-ink)]">
                      {EXPENSE_CATEGORY_LABELS[e.category] ?? e.category}
                      {e.source === "RECEIPT_SCAN" && (
                        <span className="admin-tag ml-2 !py-0 text-[10px]">レシート</span>
                      )}
                      {e.isRecurring && (
                        <span className="admin-tag ml-1 !py-0 text-[10px]">固定費</span>
                      )}
                    </p>
                    <p className="text-xs text-[var(--admin-muted)]">
                      {String(e.expenseDate).slice(0, 10)}
                      {e.merchantName && ` · ${e.merchantName}`}
                      {e.description && !e.merchantName && ` · ${e.description}`}
                    </p>
                  </div>
                  <span className="shrink-0 tabular-nums text-sm text-[var(--admin-ink)]">
                    {formatYen(e.amount)}
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(e.id)}
                    className="shrink-0 text-xs text-[var(--admin-muted)] hover:text-[var(--admin-vermillion)]"
                  >
                    削除
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
