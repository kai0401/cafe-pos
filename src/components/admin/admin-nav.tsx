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
  { href: "/admin/products/photos", label: "商品写真" },
  { href: "/admin/qr", label: "QRオーダー" },
  { href: "/admin/settings", label: "営業設定" },
] as const;

const OPS = [
  { href: "/monitor", label: "遠隔モニター" },
  { href: "/waiter/tables", label: "ウェイター" },
  { href: "/kitchen", label: "キッチンモニター" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/admin/dashboard") return pathname === href;
  if (href === "/admin/products") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav() {
  const pathname = usePathname();
  const [storeName, setStoreName] = useState("あづま家");
  const [hoursLabel, setHoursLabel] = useState("読み込み中…");

  useEffect(() => {
    fetch("/api/admin/store")
      .then((r) => r.json())
      .then((s) => {
        if (typeof s.name === "string" && s.name.trim()) setStoreName(s.name.trim());
        const closed = formatClosedDaysLabel(s.regularClosedDays);
        setHoursLabel(`${s.openTime ?? "11:00"} – ${s.closeTime ?? "18:00"}\n${closed}`);
      })
      .catch(() => setHoursLabel("営業時間未設定"));
  }, []);

  const [hoursLine, closedLine] = hoursLabel.split("\n");

  return (
    <aside className="admin-sidebar w-full shrink-0 print:hidden md:w-52 lg:w-56">
      <div className="px-6 pb-2 pt-8 md:pt-10">
        <p className="admin-brand-serif text-[1.35rem] leading-tight tracking-wide text-[var(--admin-ink)]">
          {storeName}
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
        <div className="mt-3 hidden border-t border-[var(--admin-line)] pt-3 md:block">
          <p className="mb-1 px-2 text-[10px] tracking-[0.18em] text-[var(--admin-muted)]">店舗画面</p>
          {OPS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="admin-nav-link whitespace-nowrap"
            >
              {item.label} ↗
            </a>
          ))}
        </div>
        <div className="flex gap-0.5 md:hidden">
          {OPS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="admin-nav-link whitespace-nowrap"
            >
              {item.label}
            </a>
          ))}
        </div>
      </nav>
    </aside>
  );
}
