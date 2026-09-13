"use client";

import { useEffect, useState } from "react";
import { ADMIN_INPUT_CLASS, PageHeader } from "@/components/admin/ui";

const DOW = ["月", "火", "水", "木", "金", "土", "日"];

export default function StoreSettingsPage() {
  const [name, setName] = useState("");
  const [invoiceRegNumber, setInvoiceRegNumber] = useState("");
  const [openTime, setOpenTime] = useState("11:00");
  const [closeTime, setCloseTime] = useState("18:00");
  const [closedDays, setClosedDays] = useState<number[]>([]);
  const [storesEnabled, setStoresEnabled] = useState(false);
  const [storesApiConfigured, setStoresApiConfigured] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/admin/store")
      .then((r) => r.json())
      .then((s) => {
        setName(s.name ?? "");
        setInvoiceRegNumber(s.invoiceRegNumber ?? "");
        setOpenTime(s.openTime ?? "11:00");
        setCloseTime(s.closeTime ?? "18:00");
        setClosedDays(s.regularClosedDays ?? []);
        setStoresEnabled(s.storesEnabled ?? false);
        setStoresApiConfigured(s.storesApiConfigured ?? false);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  function toggleDay(i: number) {
    setClosedDays((prev) => (prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i].sort()));
  }

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/store", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          invoiceRegNumber,
          openTime,
          closeTime,
          regularClosedDays: closedDays,
          storesEnabled,
        }),
      });
      const data = await res.json();
      setMessage(res.ok ? "保存しました" : (data.error ?? "保存に失敗しました"));
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) {
    return (
      <div className="max-w-xl">
        <PageHeader eyebrow="SETTINGS" title="営業設定" description="店舗情報・営業時間・定休日" />
        <div className="admin-card p-10 text-center text-sm text-[var(--admin-muted)]">読み込み中…</div>
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <PageHeader eyebrow="SETTINGS" title="営業設定" description="店舗情報・営業時間・定休日" />

      <div className="admin-card space-y-6 p-6">
        <div>
          <label className="admin-label">店舗名</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={ADMIN_INPUT_CLASS} />
          <p className="mt-1.5 text-xs text-[var(--admin-muted)]">レシート・レポートの表示名に使われます</p>
        </div>

        <div>
          <label className="admin-label">インボイス登録番号</label>
          <input
            value={invoiceRegNumber}
            onChange={(e) => setInvoiceRegNumber(e.target.value)}
            placeholder="T1234567890123"
            className={ADMIN_INPUT_CLASS}
          />
          <p className="mt-1.5 text-xs text-[var(--admin-muted)]">
            設定するとレシートに「登録番号」として印字されます
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="admin-label">開店時間</label>
            <input
              type="time"
              value={openTime}
              onChange={(e) => setOpenTime(e.target.value)}
              className={ADMIN_INPUT_CLASS}
            />
          </div>
          <div>
            <label className="admin-label">閉店時間</label>
            <input
              type="time"
              value={closeTime}
              onChange={(e) => setCloseTime(e.target.value)}
              className={ADMIN_INPUT_CLASS}
            />
          </div>
        </div>

        <div>
          <label className="admin-label">定休日</label>
          <div className="flex flex-wrap gap-2">
            {DOW.map((label, i) => {
              const active = closedDays.includes(i);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={`h-10 w-10 rounded-full text-sm font-semibold transition ${
                    active
                      ? "bg-[var(--admin-vermillion)] text-white"
                      : "border border-[var(--admin-line)] bg-[var(--admin-paper-raised)] text-[var(--admin-muted)] hover:border-[var(--admin-accent)]"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-xs text-[var(--admin-muted)]">
            赤茶色の曜日が定休日です（売上分析の営業日判定に使用）
          </p>
        </div>

        <div className="border-t border-[var(--admin-line)]/70 pt-5">
          <h3 className="admin-label !mb-3">STORES決済</h3>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={storesEnabled}
              onChange={(e) => setStoresEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--admin-line)] accent-[var(--admin-accent)]"
            />
            <span className="text-sm text-[var(--admin-ink)]">STORES決済を有効にする</span>
          </label>
          <p className="mt-2 text-xs leading-relaxed text-[var(--admin-muted)]">
            ウェイター会計・QRオーダーのお客様支払いで STORES決済が使えます。
            {storesApiConfigured
              ? " APIキー設定済み（オンライン決済URL対応）"
              : " 端末連携モード（STORES端末で決済後に「決済完了」）"}
          </p>
          <p className="mt-1 text-xs text-[var(--admin-muted)]">
            オンライン決済を使う場合は .env に{" "}
            <code className="rounded bg-[var(--admin-accent-soft)] px-1">STORES_API_KEY</code>{" "}
            を設定してください
          </p>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="admin-btn admin-btn--primary disabled:opacity-50"
          >
            {saving ? "保存中…" : "保存"}
          </button>
          {message && <span className="text-sm text-[var(--admin-sage)]">{message}</span>}
        </div>
      </div>
    </div>
  );
}
