"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { WaiterHeader } from "@/components/waiter/waiter-ui";

const ORANGE = "#e8912d";
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

function IconStore() {
  return (
    <svg width="36" height="36" viewBox="0 0 48 48" fill="none" stroke="white" strokeWidth="2">
      <path d="M6 20l4-12h28l4 12" strokeLinejoin="round" />
      <rect x="8" y="20" width="32" height="22" rx="2" />
      <rect x="20" y="28" width="8" height="14" />
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

  useEffect(() => {
    fetch("/api/waiter/menu")
      .then((r) => r.json())
      .then((cats: { soldOutCount?: number }[]) => {
        setSoldOutCount(cats.reduce((s, c) => s + (c.soldOutCount ?? 0), 0));
      })
      .catch(() => {});
  }, []);

  return (
    <div className="flex min-h-screen flex-col pb-14" style={{ backgroundColor: ORANGE }}>
      <WaiterHeader title="メニュー" />

      <div className="flex-1 px-3 pt-3">
        {/* 注文 — 大ボタン */}
        <div className="mb-2 overflow-hidden rounded-md">
          <Tile href="/waiter/tables" label="注文" icon={<IconOrder />} large />
        </div>

        {/* 取引履歴 | 店舗 | メニュー */}
        <div className="mb-2 grid grid-cols-3 gap-px overflow-hidden rounded-md bg-white/20">
          <Tile href="/waiter/history" label="取引履歴" icon={<IconBook />} />
          <Tile href="/admin/dashboard" label="店舗" icon={<IconStore />} />
          <Tile href="/admin/products" label="メニュー" icon={<IconMenu />} badge={soldOutCount} />
        </div>

        {/* ジョブリスト | 設定 */}
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md bg-white/20">
          <Tile href="/kitchen" label="ジョブリスト" icon={<IconJob />} />
          <Tile href="/waiter/settings" label="設定" icon={<IconSettings />} />
        </div>

        <p className="mt-10 text-center text-[12px] text-white/50">version 0.1.0</p>
      </div>

      {/* 下部バー */}
      <div className="pb-safe fixed bottom-0 left-0 right-0 mx-auto w-full max-w-[var(--waiter-width)] border-t border-stone-200 bg-[#f5f5f5]">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-300 text-stone-600">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </div>
          <span className="text-[15px] text-stone-700">管理者</span>
          <span className="ml-auto text-stone-400">›</span>
        </div>
      </div>
    </div>
  );
}
