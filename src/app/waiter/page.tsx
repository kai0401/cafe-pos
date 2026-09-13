"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { WaiterHeader } from "@/components/waiter/waiter-ui";
import { waiterFetch } from "@/lib/waiter-api";
import { POS_ACCENT } from "@/lib/pos-theme";
import { dismissInstallPrompt, isStandalone } from "@/lib/pwa-install";
import {
  getCurrentStaffName,
  loadStaffSuggestions,
  setCurrentStaffName,
} from "@/lib/waiter-staff";

const ORANGE_LIGHT = "rgba(255,255,255,0.12)";

function IconOrder() {
  return (
    <svg width="56" height="56" viewBox="0 0 48 48" fill="none" stroke="white" strokeWidth="2">
      <rect x="10" y="6" width="28" height="36" rx="3" />
      <path d="M16 16h16M16 24h16M16 32h10" strokeLinecap="round" />
      <path d="M30 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconBook() {
  return (
    <svg width="36" height="36" viewBox="0 0 48 48" fill="none" stroke="white" strokeWidth="2">
      <path d="M8 8h14a4 4 0 014 4v28H12a4 4 0 01-4-4V8z" />
      <path d="M22 12h14a4 4 0 014 4v24" />
    </svg>
  );
}

function IconMenu() {
  return (
    <svg width="36" height="36" viewBox="0 0 48 48" fill="none" stroke="white" strokeWidth="2">
      <path d="M14 8l-4 8h32l-4-8H14z" strokeLinejoin="round" />
      <path d="M10 16v22a2 2 0 002 2h24a2 2 0 002-2V16" />
      <path d="M20 24h8" strokeLinecap="round" />
    </svg>
  );
}

function IconJob() {
  return (
    <svg width="36" height="36" viewBox="0 0 48 48" fill="none" stroke="white" strokeWidth="2">
      <circle cx="24" cy="24" r="16" />
      <path d="M16 24l6 6 12-12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="36" height="36" viewBox="0 0 48 48" fill="none" stroke="white" strokeWidth="2">
      <circle cx="24" cy="24" r="6" />
      <path d="M24 4v6M24 38v6M4 24h6M38 24h6M9.9 9.9l4.2 4.2M33.9 33.9l4.2 4.2M9.9 38.1l4.2-4.2M33.9 14.1l4.2-4.2" strokeLinecap="round" />
    </svg>
  );
}

function Tile({
  href,
  label,
  icon,
  badge,
  large,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  large?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`relative flex flex-col items-center justify-center text-white active:brightness-110 ${
        large ? "py-10" : "py-6"
      }`}
      style={{ backgroundColor: ORANGE_LIGHT }}
    >
      {badge !== undefined && badge > 0 && (
        <span className="absolute right-3 top-3 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
          {badge}
        </span>
      )}
      {icon}
      <span className={`mt-1.5 font-medium ${large ? "text-[17px]" : "text-[13px]"}`}>{label}</span>
    </Link>
  );
}

export default function WaiterHomePage() {
  const [soldOutCount, setSoldOutCount] = useState(0);
  const [staffName, setStaffName] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    // ホーム画面アプリ起動なら「アプリに追加」導線も出さない
    if (isStandalone()) dismissInstallPrompt();
    setStaffName(getCurrentStaffName() ?? "");
    waiterFetch("/api/waiter/menu")
      .then((r) => r.json())
      .then((cats: { soldOutCount?: number }[]) => {
        setSoldOutCount(cats.reduce((s, c) => s + (c.soldOutCount ?? 0), 0));
      })
      .catch(() => {});
  }, []);

  function openEdit() {
    setDraft(staffName);
    setEditOpen(true);
    void loadStaffSuggestions().then(setSuggestions);
  }

  function saveEdit(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCurrentStaffName(trimmed);
    setStaffName(trimmed);
    setEditOpen(false);
  }

  return (
    <div className="flex min-h-screen flex-col pb-14" style={{ backgroundColor: POS_ACCENT }}>
      <WaiterHeader title="ホーム" />

      <div className="flex-1 px-3 pt-3">
        <div className="mb-2 overflow-hidden rounded-md">
          <Tile href="/waiter/tables" label="注文" icon={<IconOrder />} large />
        </div>

        <div className="mb-2 grid grid-cols-2 gap-px overflow-hidden rounded-md bg-white/20">
          <Tile href="/waiter/history" label="取引履歴" icon={<IconBook />} />
          <Tile href="/waiter/menu-status" label="メニュー" icon={<IconMenu />} badge={soldOutCount} />
        </div>

        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md bg-white/20">
          <Tile href="/kitchen/open" label="キッチン" icon={<IconJob />} />
          <Tile href="/waiter/settings" label="設定" icon={<IconSettings />} />
        </div>

        <p className="mt-10 text-center text-[12px] text-white/50">version 0.1.0</p>
      </div>

      <div className="waiter-fixed-bottom pb-safe border-t border-stone-200 bg-[var(--pos-bg)]">
        <button
          type="button"
          onClick={openEdit}
          className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-stone-50"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-300 text-stone-600">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </div>
          <span className="flex-1 text-[15px] text-stone-700">{staffName || "スタッフ未設定"}</span>
          <span className="text-[13px] text-stone-400">変更</span>
        </button>
      </div>

      {editOpen && (
        <div className="fixed inset-0 z-[120] flex items-end bg-black/40">
          <div className="pb-safe mx-auto w-full max-w-[var(--waiter-width)] rounded-t-2xl bg-white px-5 pt-5">
            <h2 className="text-[18px] font-bold text-stone-900">スタッフ名</h2>
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveEdit(draft);
              }}
              className="mt-4 w-full rounded-xl border border-stone-200 px-4 py-3 text-[17px] outline-none"
              placeholder="名前"
            />
            {suggestions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {suggestions.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => saveEdit(name)}
                    className="rounded-full border border-stone-200 px-3 py-1.5 text-[14px]"
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              disabled={!draft.trim()}
              onClick={() => saveEdit(draft)}
              className="mt-5 w-full rounded-xl py-3.5 text-[16px] font-semibold text-white disabled:opacity-40"
              style={{ backgroundColor: POS_ACCENT }}
            >
              保存
            </button>
            <button
              type="button"
              onClick={() => setEditOpen(false)}
              className="mt-2 w-full py-2 text-[14px] text-stone-400"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
