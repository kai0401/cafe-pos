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
  supported?: boolean;
  cloudNote?: string | null;
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
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? "bg-[var(--pos-accent)]" : "bg-stone-300"}`}
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
  const [discovering, setDiscovering] = useState(false);
  const [found, setFound] = useState<{ ip: string; port: number }[]>([]);
  const [reach, setReach] = useState<"unknown" | "ok" | "fail">("unknown");

  useEffect(() => {
    fetch("/api/printer")
      .then((r) => r.json())
      .then((data) => {
        if (data?.error) setLoadError(data.error);
        else setConfig(data);
      })
      .catch(() => setLoadError("プリンター設定の読み込みに失敗しました"));
  }, []);

  useEffect(() => {
    if (!config?.ip || config.supported === false) return;
    let cancelled = false;
    fetch("/api/printer/probe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ip: config.ip, port: config.port }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setReach(data.reachable ? "ok" : "fail");
      })
      .catch(() => {
        if (!cancelled) setReach("fail");
      });
    return () => {
      cancelled = true;
    };
  }, [config?.ip, config?.port, config?.supported]);

  function update(patch: Partial<PrinterConfig>) {
    setConfig((c) => (c ? { ...c, ...patch } : c));
    if (patch.ip !== undefined || patch.port !== undefined) setReach("unknown");
  }

  async function save(next = config) {
    if (!next) return false;
    setSaving(true);
    try {
      const res = await fetch("/api/printer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const data = await res.json();
      if (res.ok) {
        setConfig(data);
        setToast("保存しました");
        return true;
      }
      setToast(data.error ?? "保存に失敗しました");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function discover() {
    setDiscovering(true);
    setFound([]);
    try {
      const res = await fetch("/api/printer/discover");
      const data = await res.json();
      if (!res.ok) {
        setToast(data.error ?? "検索に失敗しました");
        return;
      }
      const printers = Array.isArray(data.printers) ? data.printers : [];
      setFound(printers);
      if (printers.length === 0) {
        setToast("見つかりませんでした。電源とWi‑Fiを確認してください");
      } else if (printers.length === 1 && printers[0]) {
        update({ ip: printers[0].ip, port: printers[0].port });
        setToast(`見つかりました: ${printers[0].ip}`);
      } else {
        setToast(`${printers.length}台見つかりました。IPを選んでください`);
      }
    } catch {
      setToast("検索に失敗しました");
    } finally {
      setDiscovering(false);
    }
  }

  async function testPrint() {
    if (!config?.ip) {
      setToast("先にIPアドレスを入力するか、検索してください");
      return;
    }
    setTesting(true);
    try {
      await save(config);
      const res = await fetch("/api/printer/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip: config.ip, port: config.port, cols: config.cols }),
      });
      const data = await res.json();
      if (res.ok) {
        setReach("ok");
        setToast("テスト印刷を送信しました");
      } else {
        setReach("fail");
        setToast(data.error ?? "テスト印刷に失敗しました");
      }
    } finally {
      setTesting(false);
    }
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col bg-[var(--pos-bg)]">
        <WaiterHeader title="プリンター設定" backHref="/waiter/settings" />
        <p className="p-8 text-center text-[14px] text-red-600">{loadError}</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--pos-bg)] text-stone-500">
        読み込み中…
      </div>
    );
  }

  if (config.supported === false) {
    return (
      <div className="min-h-screen bg-[var(--pos-bg)] pb-8">
        <WaiterHeader title="プリンター設定" backHref="/waiter/settings" />
        <div className="m-4 rounded-xl bg-white p-5 text-[14px] leading-relaxed text-stone-700">
          <p className="font-semibold text-stone-900">クラウド運用では LAN プリンターは使えません</p>
          <p className="mt-3">
            {config.cloudNote ?? "キッチンは画面表示、レシートは STORES 端末を使ってください。"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--pos-bg)] pb-8">
      <WaiterHeader title="プリンター設定" backHref="/waiter/settings" />

      <div className="mx-4 mt-3 rounded-xl border border-stone-200 bg-white px-4 py-3">
        <p className="text-[13px] text-stone-500">接続状態</p>
        <p className="mt-1 text-[16px] font-semibold text-stone-900">
          {!config.ip
            ? "未設定 — 同じWi‑Fiから探してください"
            : reach === "ok"
              ? `接続OK（${config.ip}）`
              : reach === "fail"
                ? `つながりません（${config.ip}）`
                : `確認中…（${config.ip}）`}
        </p>
      </div>

      <div className="bg-[var(--pos-bg)] px-4 py-2 text-[12px] font-medium text-stone-500">
        Epson TM-m30（LAN / Wi‑Fi）
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
          電源投入時に紙送りボタン長押しでステータスシートのIPを確認できます
        </p>
      </div>

      {found.length > 1 && (
        <div className="border-b border-stone-200 bg-white px-4 py-3">
          <p className="mb-2 text-[13px] text-stone-500">見つかったプリンター</p>
          <div className="flex flex-col gap-2">
            {found.map((p) => (
              <button
                key={p.ip}
                type="button"
                onClick={() => update({ ip: p.ip, port: p.port })}
                className={`rounded-lg border px-3 py-2.5 text-left text-[15px] ${
                  config.ip === p.ip
                    ? "border-[var(--pos-accent)] bg-[var(--pos-accent-soft)]"
                    : "border-stone-200"
                }`}
              >
                {p.ip}:{p.port}
              </button>
            ))}
          </div>
        </div>
      )}

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

      <div className="bg-[var(--pos-bg)] px-4 py-2 text-[12px] font-medium text-stone-500">自動印刷</div>

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
        <PrimaryButton onClick={discover} disabled={discovering}>
          {discovering ? "検索中…" : "同じWi‑Fiから探す"}
        </PrimaryButton>
        <PrimaryButton onClick={() => void save()} disabled={saving || !config.ip}>
          {saving ? "保存中…" : "保存"}
        </PrimaryButton>
        <PrimaryButton onClick={testPrint} disabled={testing || !config.ip} variant="secondary">
          {testing ? "送信中…" : "テスト印刷"}
        </PrimaryButton>
      </div>

      <Toast message={toast} onClose={() => setToast("")} />
    </div>
  );
}
