"use client";

import { useEffect, useState } from "react";
import { WaiterHeader } from "@/components/waiter/waiter-ui";
import {
  loadWaiterOrderSettings,
  saveWaiterOrderSettings,
  type WaiterOrderSettings,
} from "@/lib/waiter-order-settings";

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-stone-200 px-4 py-4">
      <div className="pr-4">
        <p className="text-[17px] text-stone-900">{label}</p>
        <p className="mt-1 text-[13px] text-stone-500">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-8 w-14 shrink-0 rounded-full transition ${
          checked ? "bg-[#e8912d]" : "bg-stone-300"
        }`}
      >
        <span
          className={`absolute top-1 h-6 w-6 rounded-full bg-white transition ${
            checked ? "left-7" : "left-1"
          }`}
        />
      </button>
    </div>
  );
}

export default function WaiterOrderSettingsPage() {
  const [settings, setSettings] = useState<WaiterOrderSettings>({
    confirmBeforeSend: true,
    confirmBeforeCancel: true,
  });

  useEffect(() => {
    setSettings(loadWaiterOrderSettings());
  }, []);

  function update(patch: Partial<WaiterOrderSettings>) {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveWaiterOrderSettings(next);
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-[#efefef]">
      <WaiterHeader title="注文設定" backHref="/waiter/settings" />
      <div className="bg-white">
        <ToggleRow
          label="キッチン送信前の確認"
          description="注文をキッチンへ送る前に確認ダイアログを表示"
          checked={settings.confirmBeforeSend}
          onChange={(value) => update({ confirmBeforeSend: value })}
        />
        <ToggleRow
          label="取引中止前の確認"
          description="テーブル会計画面で取引中止時に確認を表示"
          checked={settings.confirmBeforeCancel}
          onChange={(value) => update({ confirmBeforeCancel: value })}
        />
      </div>
      <p className="px-4 py-3 text-[12px] text-stone-400">
        設定はこの端末のブラウザに保存されます
      </p>
    </div>
  );
}
