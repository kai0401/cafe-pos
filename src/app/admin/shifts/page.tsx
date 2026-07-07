"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ADMIN_INPUT_CLASS, KpiCard, PageHeader } from "@/components/admin/ui";
import {
  SHIFT_ROLE_LABELS,
  SHIFT_STATUS_LABELS,
  formatYen,
} from "@/lib/format";

type Staff = {
  id: string;
  name: string;
  hourlyWage: number | null;
  role: string;
  color: string | null;
  isActive: boolean;
};

type Shift = {
  id: string;
  staffId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  role: string;
  status: string;
  note: string | null;
  staff: Staff;
};

type Summary = {
  shiftCount: number;
  totalHours: number;
  laborCost: number;
  staffSummary: { id: string; name: string; hours: number }[];
};

type ShiftBundle =
  | {
      view: "week";
      week: {
        weekStart: string;
        weekEnd: string;
        days: { date: string; label: string; dow: string }[];
      };
      staff: Staff[];
      shifts: Shift[];
      summary: Summary;
    }
  | {
      view: "month";
      month: {
        monthKey: string;
        monthLabel: string;
        monthStart: string;
        monthEnd: string;
        cells: {
          date: string;
          label: string;
          dow: string;
          inMonth: boolean;
          isToday: boolean;
        }[];
      };
      staff: Staff[];
      shifts: Shift[];
      summary: Summary;
    };

const ROLES = Object.keys(SHIFT_ROLE_LABELS);
const STATUSES = Object.keys(SHIFT_STATUS_LABELS);
const DOW_HEADERS = ["月", "火", "水", "木", "金", "土", "日"];

export default function ShiftsPage() {
  const [bundle, setBundle] = useState<ShiftBundle | null>(null);
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [weekAnchor, setWeekAnchor] = useState<string | undefined>(undefined);
  const [monthAnchor, setMonthAnchor] = useState<string | undefined>(undefined);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [staffForm, setStaffForm] = useState({
    name: "",
    hourlyWage: "",
    role: "HALL",
  });

  const [shiftForm, setShiftForm] = useState({
    id: "",
    staffId: "",
    shiftDate: "",
    startTime: "11:00",
    endTime: "18:00",
    role: "HALL",
    status: "SCHEDULED",
    note: "",
  });
  const [showShiftForm, setShowShiftForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const params = new URLSearchParams();
      if (viewMode === "month") {
        params.set("view", "month");
        if (monthAnchor) params.set("month", monthAnchor);
      } else if (weekAnchor) {
        params.set("week", weekAnchor);
      }
      const q = params.toString() ? `?${params}` : "";
      const res = await fetch(`/api/admin/shifts${q}`);
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "シフトの読み込みに失敗しました");
        return;
      }
      setBundle(data as ShiftBundle);
    } catch {
      setMessage("シフトの読み込みに失敗しました。ページを再読み込みしてください");
    } finally {
      setLoading(false);
    }
  }, [viewMode, weekAnchor, monthAnchor]);

  useEffect(() => {
    load();
  }, [load]);

  const shiftsByDate = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const s of bundle?.shifts ?? []) {
      const list = map.get(s.shiftDate) ?? [];
      list.push(s);
      map.set(s.shiftDate, list);
    }
    return map;
  }, [bundle?.shifts]);

  const periodLabel = useMemo(() => {
    if (!bundle) return "";
    if (bundle.view === "week") {
      return `${bundle.week.weekStart} 〜 ${bundle.week.weekEnd}`;
    }
    return bundle.month.monthLabel;
  }, [bundle]);

  const periodSub = viewMode === "week" ? "今週のシフト" : "今月のシフト";

  async function addStaff(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    const res = await fetch("/api/admin/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: staffForm.name,
        hourlyWage: staffForm.hourlyWage ? Number(staffForm.hourlyWage) : null,
        role: staffForm.role,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "スタッフ登録に失敗");
      return;
    }
    setStaffForm({ name: "", hourlyWage: "", role: "HALL" });
    setMessage("スタッフを追加しました");
    load();
  }

  async function toggleStaffActive(staff: Staff) {
    await fetch("/api/admin/staff", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: staff.id, isActive: !staff.isActive }),
    });
    load();
  }

  function openNewShift(date: string) {
    const firstStaff = bundle?.staff.find((s) => s.isActive);
    setShiftForm({
      id: "",
      staffId: firstStaff?.id ?? "",
      shiftDate: date,
      startTime: "11:00",
      endTime: "18:00",
      role: firstStaff?.role ?? "HALL",
      status: "SCHEDULED",
      note: "",
    });
    setShowShiftForm(true);
  }

  function openEditShift(shift: Shift) {
    setShiftForm({
      id: shift.id,
      staffId: shift.staffId,
      shiftDate: shift.shiftDate,
      startTime: shift.startTime,
      endTime: shift.endTime,
      role: shift.role,
      status: shift.status,
      note: shift.note ?? "",
    });
    setShowShiftForm(true);
  }

  async function saveShift(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    const payload = {
      ...shiftForm,
      note: shiftForm.note || null,
    };
    const res = await fetch("/api/admin/shifts", {
      method: shiftForm.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "シフト保存に失敗");
      return;
    }
    setShowShiftForm(false);
    setMessage(shiftForm.id ? "シフトを更新しました" : "シフトを登録しました");
    load();
  }

  async function removeShift(id: string) {
    if (!confirm("このシフトを削除しますか？")) return;
    await fetch(`/api/admin/shifts?id=${id}`, { method: "DELETE" });
    load();
  }

  function changeWeek(delta: number) {
    if (!bundle || bundle.view !== "week") return;
    const base = new Date(`${bundle.week.weekStart}T00:00:00Z`);
    base.setUTCDate(base.getUTCDate() + delta * 7);
    setWeekAnchor(base.toISOString().slice(0, 10));
  }

  function changeMonth(delta: number) {
    const key =
      bundle?.view === "month"
        ? bundle.month.monthKey
        : monthAnchor ?? new Date().toISOString().slice(0, 7);
    const [y, m] = key.split("-").map(Number);
    const d = new Date(Date.UTC(y!, m! - 1 + delta, 1));
    setMonthAnchor(d.toISOString().slice(0, 7));
  }

  function switchView(mode: "week" | "month") {
    if (mode === viewMode) return;
    setViewMode(mode);
    if (mode === "month" && bundle?.view === "week") {
      setMonthAnchor(bundle.week.weekStart.slice(0, 7));
    }
    if (mode === "week" && bundle?.view === "month") {
      setWeekAnchor(bundle.month.monthStart);
    }
  }

  function renderShiftCard(shift: Shift, compact = false) {
    return (
      <div
        key={shift.id}
        className={`rounded-lg border border-[var(--admin-line)] bg-[var(--admin-paper-raised)] text-[11px] ${
          compact ? "p-1" : "p-2"
        }`}
        style={{ borderLeftWidth: 3, borderLeftColor: shift.staff.color ?? "var(--admin-accent)" }}
      >
        <button type="button" onClick={() => openEditShift(shift)} className="w-full text-left">
          <p className={`font-medium text-[var(--admin-ink)] ${compact ? "truncate text-[10px]" : ""}`}>
            {shift.staff.name}
          </p>
          <p className={`text-[var(--admin-muted)] ${compact ? "text-[9px]" : ""}`}>
            {shift.startTime}–{shift.endTime}
          </p>
          {!compact && (
            <p className="text-[var(--admin-muted)]">{SHIFT_ROLE_LABELS[shift.role]}</p>
          )}
        </button>
        {!compact && (
          <button
            type="button"
            onClick={() => removeShift(shift.id)}
            className="mt-1 text-[10px] text-[var(--admin-vermillion)]"
          >
            削除
          </button>
        )}
      </div>
    );
  }

  function renderDayColumn(day: { date: string; label: string; dow: string }) {
    const dayShifts = shiftsByDate.get(day.date) ?? [];
    return (
      <div
        key={day.date}
        className="flex flex-col border-r border-[var(--admin-line)]/60 p-2 last:border-r-0"
      >
        <button
          type="button"
          onClick={() => openNewShift(day.date)}
          className="mb-2 rounded-md border border-dashed border-[var(--admin-line)] py-1 text-[11px] text-[var(--admin-muted)] hover:border-[var(--admin-accent)] hover:text-[var(--admin-accent)]"
        >
          ＋ 追加
        </button>
        <div className="space-y-2">
          {dayShifts.map((shift) => renderShiftCard(shift))}
        </div>
      </div>
    );
  }

  function renderMonthCell(cell: {
    date: string;
    label: string;
    inMonth: boolean;
    isToday: boolean;
  }) {
    const dayShifts = shiftsByDate.get(cell.date) ?? [];
    const visible = dayShifts.slice(0, 2);
    const overflow = dayShifts.length - visible.length;

    return (
      <div
        key={cell.date}
        className={`flex min-h-[88px] flex-col border-r border-b border-[var(--admin-line)]/60 p-1 last:border-r-0 ${
          cell.inMonth ? "bg-white" : "bg-[var(--admin-paper)]/50"
        } ${cell.isToday ? "ring-1 ring-inset ring-[var(--admin-accent)]" : ""}`}
      >
        <div className="mb-1 flex items-center justify-between gap-1">
          <span
            className={`text-xs font-medium ${
              cell.isToday
                ? "flex h-5 w-5 items-center justify-center rounded-full bg-[var(--admin-accent)] text-white"
                : cell.inMonth
                  ? "text-[var(--admin-ink)]"
                  : "text-[var(--admin-muted)]"
            }`}
          >
            {cell.label}
          </span>
          {cell.inMonth && (
            <button
              type="button"
              onClick={() => openNewShift(cell.date)}
              className="text-[10px] text-[var(--admin-muted)] hover:text-[var(--admin-accent)]"
              title="シフト追加"
            >
              ＋
            </button>
          )}
        </div>
        <div className="space-y-0.5">
          {visible.map((shift) => renderShiftCard(shift, true))}
          {overflow > 0 && (
            <p className="text-[9px] text-[var(--admin-muted)]">他{overflow}件</p>
          )}
        </div>
      </div>
    );
  }

  if (!bundle) {
    return (
      <div className="admin-card p-10 text-center">
        <p className="text-[var(--admin-muted)]">
          {loading ? "読み込み中…" : message || "データを読み込めませんでした"}
        </p>
        {!loading && (
          <button type="button" onClick={load} className="admin-btn admin-btn--primary mt-4">
            再読み込み
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="人事"
        title="シフト管理"
        description="週間・月間シフトの作成・スタッフ管理・人件費見込み"
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-[var(--admin-line)] p-0.5">
            <button
              type="button"
              onClick={() => switchView("week")}
              className={`rounded-md px-3 py-1.5 text-sm ${
                viewMode === "week"
                  ? "bg-[var(--admin-accent)] text-white"
                  : "text-[var(--admin-muted)] hover:text-[var(--admin-ink)]"
              }`}
            >
              週
            </button>
            <button
              type="button"
              onClick={() => switchView("month")}
              className={`rounded-md px-3 py-1.5 text-sm ${
                viewMode === "month"
                  ? "bg-[var(--admin-accent)] text-white"
                  : "text-[var(--admin-muted)] hover:text-[var(--admin-ink)]"
              }`}
            >
              月
            </button>
          </div>
          {viewMode === "week" ? (
            <>
              <button type="button" onClick={() => changeWeek(-1)} className="admin-btn admin-btn--ghost">
                ← 前週
              </button>
              <button type="button" onClick={() => setWeekAnchor(undefined)} className="admin-btn admin-btn--ghost">
                今週
              </button>
              <button type="button" onClick={() => changeWeek(1)} className="admin-btn admin-btn--ghost">
                次週 →
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => changeMonth(-1)} className="admin-btn admin-btn--ghost">
                ← 前月
              </button>
              <button type="button" onClick={() => setMonthAnchor(undefined)} className="admin-btn admin-btn--ghost">
                今月
              </button>
              <button type="button" onClick={() => changeMonth(1)} className="admin-btn admin-btn--ghost">
                次月 →
              </button>
            </>
          )}
        </div>
      </PageHeader>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <KpiCard title={periodLabel} value={`${bundle.summary.shiftCount}件`} sub={periodSub} />
        <KpiCard title="総勤務時間" value={`${bundle.summary.totalHours}h`} />
        <KpiCard
          title="人件費見込み"
          value={formatYen(bundle.summary.laborCost)}
          sub="時給登録スタッフのみ"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
        <div className="space-y-6">
          <form onSubmit={addStaff} className="admin-card space-y-3 p-5">
            <h2 className="admin-brand-serif text-base text-[var(--admin-ink)]">スタッフ追加</h2>
            <div>
              <label className="admin-label">名前</label>
              <input
                required
                value={staffForm.name}
                onChange={(e) => setStaffForm((f) => ({ ...f, name: e.target.value }))}
                className={ADMIN_INPUT_CLASS}
                placeholder="例: 田中"
              />
            </div>
            <div>
              <label className="admin-label">時給（任意）</label>
              <input
                type="number"
                min={0}
                value={staffForm.hourlyWage}
                onChange={(e) => setStaffForm((f) => ({ ...f, hourlyWage: e.target.value }))}
                className={ADMIN_INPUT_CLASS}
                placeholder="1100"
              />
            </div>
            <div>
              <label className="admin-label">役割</label>
              <select
                value={staffForm.role}
                onChange={(e) => setStaffForm((f) => ({ ...f, role: e.target.value }))}
                className={ADMIN_INPUT_CLASS}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {SHIFT_ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="admin-btn admin-btn--primary w-full">
              追加
            </button>
          </form>

          <div className="admin-card overflow-hidden">
            <h2 className="admin-brand-serif border-b border-[var(--admin-line)] px-5 py-4 text-base text-[var(--admin-ink)]">
              スタッフ一覧
            </h2>
            <div className="divide-y divide-[var(--admin-line)]/60">
              {bundle.staff.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-5 py-3">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ background: s.color ?? "var(--admin-accent)" }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${s.isActive ? "text-[var(--admin-ink)]" : "text-[var(--admin-muted)] line-through"}`}>
                      {s.name}
                    </p>
                    <p className="text-xs text-[var(--admin-muted)]">
                      {SHIFT_ROLE_LABELS[s.role]}
                      {s.hourlyWage ? ` · ${formatYen(s.hourlyWage)}/h` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleStaffActive(s)}
                    className="text-xs text-[var(--admin-muted)] hover:text-[var(--admin-ink)]"
                  >
                    {s.isActive ? "無効" : "有効"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="admin-card overflow-hidden">
          {viewMode !== bundle.view ? (
            <div className="p-10 text-center text-sm text-[var(--admin-muted)]">読み込み中…</div>
          ) : viewMode === "week" && bundle.view === "week" ? (
            <>
              <div className="grid grid-cols-7 border-b border-[var(--admin-line)] bg-[var(--admin-paper)]">
                {bundle.week.days.map((day) => (
                  <div key={day.date} className="border-r border-[var(--admin-line)]/60 px-2 py-3 text-center last:border-r-0">
                    <p className="text-xs text-[var(--admin-muted)]">{day.dow}</p>
                    <p className="text-sm font-medium text-[var(--admin-ink)]">{day.label}</p>
                  </div>
                ))}
              </div>
              <div className="grid min-h-[320px] grid-cols-7">
                {bundle.week.days.map((day) => renderDayColumn(day))}
              </div>
            </>
          ) : bundle.view === "month" ? (
            <>
              <div className="grid grid-cols-7 border-b border-[var(--admin-line)] bg-[var(--admin-paper)]">
                {DOW_HEADERS.map((dow) => (
                  <div
                    key={dow}
                    className="border-r border-[var(--admin-line)]/60 px-2 py-3 text-center text-xs font-medium text-[var(--admin-muted)] last:border-r-0"
                  >
                    {dow}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {bundle.month.cells.map((cell) => renderMonthCell(cell))}
              </div>
            </>
          ) : null}
        </div>
      </div>

      {showShiftForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <form onSubmit={saveShift} className="admin-card w-full max-w-md space-y-4 p-6">
            <h2 className="admin-brand-serif text-lg text-[var(--admin-ink)]">
              {shiftForm.id ? "シフト編集" : "シフト登録"}
            </h2>
            <div>
              <label className="admin-label">スタッフ</label>
              <select
                required
                value={shiftForm.staffId}
                onChange={(e) => setShiftForm((f) => ({ ...f, staffId: e.target.value }))}
                className={ADMIN_INPUT_CLASS}
              >
                <option value="">選択</option>
                {bundle.staff
                  .filter((s) => s.isActive)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="admin-label">日付</label>
              <input
                type="date"
                required
                value={shiftForm.shiftDate}
                onChange={(e) => setShiftForm((f) => ({ ...f, shiftDate: e.target.value }))}
                className={ADMIN_INPUT_CLASS}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="admin-label">開始</label>
                <input
                  type="time"
                  required
                  value={shiftForm.startTime}
                  onChange={(e) => setShiftForm((f) => ({ ...f, startTime: e.target.value }))}
                  className={ADMIN_INPUT_CLASS}
                />
              </div>
              <div>
                <label className="admin-label">終了</label>
                <input
                  type="time"
                  required
                  value={shiftForm.endTime}
                  onChange={(e) => setShiftForm((f) => ({ ...f, endTime: e.target.value }))}
                  className={ADMIN_INPUT_CLASS}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="admin-label">役割</label>
                <select
                  value={shiftForm.role}
                  onChange={(e) => setShiftForm((f) => ({ ...f, role: e.target.value }))}
                  className={ADMIN_INPUT_CLASS}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {SHIFT_ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="admin-label">状態</label>
                <select
                  value={shiftForm.status}
                  onChange={(e) => setShiftForm((f) => ({ ...f, status: e.target.value }))}
                  className={ADMIN_INPUT_CLASS}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {SHIFT_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="admin-label">メモ</label>
              <input
                value={shiftForm.note}
                onChange={(e) => setShiftForm((f) => ({ ...f, note: e.target.value }))}
                className={ADMIN_INPUT_CLASS}
                placeholder="任意"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowShiftForm(false)}
                className="admin-btn admin-btn--ghost flex-1"
              >
                キャンセル
              </button>
              <button type="submit" className="admin-btn admin-btn--primary flex-1" disabled={loading}>
                保存
              </button>
            </div>
          </form>
        </div>
      )}

      {message && (
        <p className="mt-6 text-center text-sm text-[var(--admin-sage)]">{message}</p>
      )}
    </div>
  );
}
