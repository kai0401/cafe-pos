"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  getCurrentStaffName,
  loadStaffSuggestions,
  setCurrentStaffName,
} from "@/lib/waiter-staff";
import { POS_ACCENT } from "@/lib/pos-theme";

const SKIP_PATHS = new Set([
  "/waiter/install",
  "/waiter/connect",
  "/waiter/open",
  "/waiter/login",
]);

/** 端末初回（スタッフ名未設定）だけ名前入力を必須にする */
export function WaiterStaffGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [needName, setNeedName] = useState(false);
  const [draft, setDraft] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (SKIP_PATHS.has(pathname)) {
      setReady(true);
      setNeedName(false);
      return;
    }
    const current = getCurrentStaffName();
    if (current) {
      setNeedName(false);
      setReady(true);
      return;
    }
    setNeedName(true);
    setReady(true);
    void loadStaffSuggestions().then(setSuggestions);
  }, [pathname]);

  function confirm(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCurrentStaffName(trimmed);
    setNeedName(false);
  }

  if (!ready) {
    return <div className="min-h-[100dvh] bg-[var(--pos-bg)]" />;
  }

  if (!needName) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[110] flex flex-col bg-[var(--pos-bg)]">
      <div className="mx-auto flex w-full max-w-[var(--waiter-width)] flex-1 flex-col px-5 pt-16">
        <p className="text-[13px] font-medium text-stone-500">あづま家 ウェイター</p>
        <h1 className="mt-2 text-[24px] font-bold text-stone-900">スタッフ名を入力</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-stone-600">
          この端末で最初に一度だけ入力します。伝票の担当名に使います。
        </p>

        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") confirm(draft);
          }}
          placeholder="例: たろう"
          className="mt-8 w-full rounded-xl border border-stone-200 bg-white px-4 py-3.5 text-[18px] outline-none focus:border-stone-400"
        />

        {suggestions.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {suggestions.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  setDraft(name);
                  confirm(name);
                }}
                className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-[14px] text-stone-700"
              >
                {name}
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          disabled={!draft.trim()}
          onClick={() => confirm(draft)}
          className="mt-8 w-full rounded-xl py-3.5 text-[16px] font-semibold text-white disabled:opacity-40"
          style={{ backgroundColor: POS_ACCENT }}
        >
          はじめる
        </button>
      </div>
    </div>
  );
}
