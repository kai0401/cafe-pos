"use client";

import Link from "next/link";
import { POS_ACCENT } from "@/lib/pos-theme";

export function RemoteShell({
  title,
  backHref,
  children,
  right,
}: {
  title: string;
  backHref?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] bg-[#f4f2ee] text-stone-900">
      <header
        className="sticky top-0 z-20 border-b border-stone-200/80 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white"
        style={{ backgroundColor: POS_ACCENT }}
      >
        <div className="mx-auto flex max-w-lg items-center gap-3">
          {backHref ? (
            <Link href={backHref} className="shrink-0 text-[15px] font-medium text-white/90">
              ← 戻る
            </Link>
          ) : (
            <p className="text-[11px] font-medium tracking-[0.18em] text-white/80">REMOTE</p>
          )}
          <h1 className="min-w-0 flex-1 truncate text-[18px] font-bold tracking-tight">{title}</h1>
          {right}
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {children}
      </main>
    </div>
  );
}

export function yen(n: number) {
  return `¥${n.toLocaleString("ja-JP")}`;
}

export function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  return `${y}年${Number(m)}月`;
}
