"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { formatClosedDaysLabel } from "@/lib/store-config";

const NAV = [
  { href: "/admin/dashboard", label: "ダッシュボード" },
  { href: "/admin/expenses", label: "経費管理" },
  { href: "/admin/shifts", label: "シフト管理" },
  { href: "/admin/analytics/daily", label: "日別売上" },
  { href: "/admin/analytics/hourly", label: "時間帯別" },
  { href: "/admin/analytics/products", label: "商品別売上" },
  { href: "/admin/reports/monthly", label: "月次レポート" },
  { href: "/admin/reports/profit-loss", label: "損益リポート" },
  { href: "/admin/closing", label: "レジ締め" },
  { href: "/admin/imports", label: "CSVインポート" },
  { href: "/admin/products", label: "商品管理" },
  { href: "/admin/qr", label: "QRオーダー" },
  { href: "/admin/settings", label: "営業設定" },
  { href: "/waiter", label: "ウェイター" },
];

function isActive(pathname: string, href: string) {
  if (href === "/admin/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav() {
  const pathname = usePathname();
  const [hoursLabel, setHoursLabel] = useState("読み込み中…");

  useEffect(() => {
    fetch("/api/admin/store")
      .then((r) => r.json())
      .then((s) => {
        const closed = formatClosedDaysLabel(s.regularClosedDays);
        setHoursLabel(`${s.openTime ?? "11:00"} – ${s.closeTime ?? "18:00"}\n${closed}`);
      })
      .catch(() => setHoursLabel("営業時間未設定"));
  }, []);

  const [hoursLine, closedLine] = hoursLabel.split("\n");

  return (
    <aside className="admin-sidebar w-full shrink-0 md:w-52 lg:w-56">
      <div className="px-6 pb-2 pt-8 md:pt-10">
        <p className="admin-brand-serif text-[1.35rem] leading-tight tracking-wide text-[var(--admin-ink)]">
          喫茶店
        </p>
        <p className="mt-1 text-[11px] tracking-[0.2em] text-[var(--admin-muted)]">管理</p>
        <p className="mt-4 border-t border-[var(--admin-line)] pt-4 text-[11px] leading-relaxed text-[var(--admin-muted)]">
          {hoursLine}
          <br />
          {closedLine}
        </p>
      </div>
      <nav className="flex gap-0.5 overflow-x-auto px-3 pb-5 md:flex-col md:overflow-visible md:px-4 md:pb-8">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`admin-nav-link whitespace-nowrap ${active ? "admin-nav-link--active" : ""}`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-4 pb-8 md:px-6">
        <button
          type="button"
          onClick={async () => {
            await fetch("/api/auth/login", { method: "DELETE" });
            window.location.href = "/admin/login";
          }}
          className="w-full rounded-lg border border-[var(--admin-line)] px-3 py-2 text-left text-xs text-[var(--admin-muted)] hover:border-[var(--admin-accent)] hover:text-[var(--admin-ink)]"
        >
          ログアウト
        </button>
      </div>
    </aside>
  );
}
