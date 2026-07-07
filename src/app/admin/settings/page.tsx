"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/admin/ui";

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

  if (!loaded) return <p className="text-stone-400">読み込み中…</p>;

  const inputClass =
    "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-stone-500 focus:outline-none";

  return (
    <div className="max-w-xl">
      <PageHeader title="営業設定" description="店舗情報・営業時間・定休日" />

      <div className="space-y-5 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-600">店舗名</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          <p className="mt-1 text-xs text-stone-400">レシート・レポートの表示名に使われます</p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-stone-600">
            インボイス登録番号
          </label>
          <input
            value={invoiceRegNumber}
            onChange={(e) => setInvoiceRegNumber(e.target.value)}
            placeholder="T1234567890123"
            className={inputClass}
          />
          <p className="mt-1 text-xs text-stone-400">設定するとレシートに「登録番号」として印字されます</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-600">開店時間</label>
            <input
              type="time"
              value={openTime}
              onChange={(e) => setOpenTime(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-600">閉店時間</label>
            <input
              type="time"
              value={closeTime}
              onChange={(e) => setCloseTime(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-stone-600">定休日</label>
          <div className="flex gap-2">
            {DOW.map((label, i) => {
              const active = closedDays.includes(i);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={`h-10 w-10 rounded-full text-sm font-semibold transition ${
                    active
                      ? "bg-red-600 text-white"
                      : "border border-stone-300 bg-white text-stone-500"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-xs text-stone-400">赤色の曜日が定休日です（売上分析の営業日判定に使用）</p>
        </div>

        <div className="border-t border-stone-100 pt-5">
          <h3 className="mb-3 text-sm font-semibold text-stone-700">STORES決済</h3>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={storesEnabled}
              onChange={(e) => setStoresEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-stone-300"
            />
            <span className="text-sm text-stone-700">STORES決済を有効にする</span>
          </label>
          <p className="mt-2 text-xs text-stone-400">
            ウェイター会計・QRオーダーのお客様支払いで STORES決済が使えます。
            {storesApiConfigured
              ? " APIキー設定済み（オンライン決済URL対応）"
              : " 端末連携モード（STORES端末で決済後に「決済完了」）"}
          </p>
          <p className="mt-1 text-xs text-stone-400">
            オンライン決済を使う場合は .env に <code className="rounded bg-stone-100 px-1">STORES_API_KEY</code> を設定してください
          </p>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="rounded-lg bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "保存中…" : "保存"}
          </button>
          {message && <span className="text-sm text-emerald-600">{message}</span>}
        </div>
      </div>
    </div>
  );
}
