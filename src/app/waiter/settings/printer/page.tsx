"use client";

import { useEffect, useState } from "react";
import { PrimaryButton, Toast, WaiterHeader } from "@/components/waiter/waiter-ui";

type PrinterConfig = {
  ip: string;
  port: number;
  printKitchenTicket: boolean;
  printReceipt: boolean;
  kickDrawer: boolean;
  cols: number;
  storeName: string;
};

function ToggleRow({
  label,
  sub,
  checked,
  onChange,
}: {
  label: string;
  sub?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3.5">
      <div>
        <p className="text-[16px] text-stone-900">{label}</p>
        {sub && <p className="mt-0.5 text-[12px] text-stone-400">{sub}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? "bg-emerald-500" : "bg-stone-300"}`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[22px]" : "translate-x-0.5"}`}
        />
      </button>
    </div>
  );
}

export default function PrinterSettingsPage() {
  const [config, setConfig] = useState<PrinterConfig | null>(null);
  const [toast, setToast] = useState("");
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetch("/api/printer")
      .then((r) => r.json())
      .then((data) => {
        if (data?.error) setLoadError(data.error);
        else setConfig(data);
      })
      .catch(() => setLoadError("プリンター設定の読み込みに失敗しました"));
  }, []);

  function update(patch: Partial<PrinterConfig>) {
    setConfig((c) => (c ? { ...c, ...patch } : c));
  }

  async function save() {
    if (!config) return;
    setSaving(true);
    try {
      const res = await fetch("/api/printer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        setConfig(await res.json());
        setToast("保存しました");
      } else {
        const data = await res.json();
        setToast(data.error ?? "保存に失敗しました");
      }
    } finally {
      setSaving(false);
    }
  }

  async function testPrint() {
    if (!config?.ip) {
      setToast("先にIPアドレスを入力して保存してください");
      return;
    }
    setTesting(true);
    try {
      await fetch("/api/printer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const res = await fetch("/api/printer/test", { method: "POST" });
      const data = await res.json();
      setToast(res.ok ? "テスト印刷を送信しました" : (data.error ?? "テスト印刷に失敗しました"));
    } finally {
      setTesting(false);
    }
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col bg-[#efefef]">
        <WaiterHeader title="プリンター設定" backHref="/waiter/settings" />
        <p className="p-8 text-center text-[14px] text-red-600">{loadError}</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#efefef] text-stone-500">
        読み込み中…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#efefef] pb-8">
      <WaiterHeader title="プリンター設定" backHref="/waiter/settings" />

      <div className="bg-[#efefef] px-4 py-2 text-[12px] font-medium text-stone-500">
        Epson TM-m30（LAN / Wi‑Fi 接続）
      </div>

      <div className="border-b border-stone-200 bg-white px-4 py-3.5">
        <label className="mb-1 block text-[13px] text-stone-500">IPアドレス</label>
        <input
          type="text"
          inputMode="decimal"
          placeholder="例: 192.168.1.50"
          value={config.ip}
          onChange={(e) => update({ ip: e.target.value })}
          className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-[16px]"
        />
        <p className="mt-1.5 text-[12px] text-stone-400">
          プリンター本体のステータスシート（電源投入時に紙送りボタン長押し）で確認できます
        </p>
      </div>

      <div className="flex gap-3 border-b border-stone-200 bg-white px-4 py-3.5">
        <div className="flex-1">
          <label className="mb-1 block text-[13px] text-stone-500">ポート</label>
          <input
            type="number"
            value={config.port}
            onChange={(e) => update({ port: Number(e.target.value) })}
            className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-[16px]"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-[13px] text-stone-500">用紙幅</label>
          <select
            value={config.cols}
            onChange={(e) => update({ cols: Number(e.target.value) })}
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-[16px]"
          >
            <option value={48}>80mm（48桁）</option>
            <option value={32}>58mm（32桁）</option>
          </select>
        </div>
      </div>

      <div className="border-b border-stone-200 bg-white px-4 py-3.5">
        <label className="mb-1 block text-[13px] text-stone-500">レシート店名</label>
        <input
          type="text"
          value={config.storeName}
          onChange={(e) => update({ storeName: e.target.value })}
          className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-[16px]"
        />
      </div>

      <div className="bg-[#efefef] px-4 py-2 text-[12px] font-medium text-stone-500">自動印刷</div>

      <ToggleRow
        label="注文伝票"
        sub="キッチンに注文送信したとき"
        checked={config.printKitchenTicket}
        onChange={(v) => update({ printKitchenTicket: v })}
      />
      <ToggleRow
        label="レシート"
        sub="会計完了したとき"
        checked={config.printReceipt}
        onChange={(v) => update({ printReceipt: v })}
      />
      <ToggleRow
        label="キャッシュドロワー"
        sub="現金会計のときに開く"
        checked={config.kickDrawer}
        onChange={(v) => update({ kickDrawer: v })}
      />

      <div className="mt-6 space-y-3 px-4">
        <PrimaryButton onClick={save} disabled={saving}>
          {saving ? "保存中…" : "保存"}
        </PrimaryButton>
        <PrimaryButton onClick={testPrint} disabled={testing} variant="secondary">
          {testing ? "送信中…" : "テスト印刷"}
        </PrimaryButton>
      </div>

      <Toast message={toast} onClose={() => setToast("")} />
    </div>
  );
}
