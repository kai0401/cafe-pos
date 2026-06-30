import Link from "next/link";

const NAV = [
  { href: "/admin/dashboard", label: "ダッシュボード" },
  { href: "/admin/analytics/daily", label: "日別売上" },
  { href: "/admin/analytics/hourly", label: "時間帯別" },
  { href: "/admin/analytics/products", label: "商品別売上" },
  { href: "/admin/reports/monthly", label: "月次レポート" },
  { href: "/admin/imports", label: "CSVインポート" },
  { href: "/admin/products", label: "商品管理" },
  { href: "/waiter", label: "ウェイター" },
];

export function AdminNav() {
  return (
    <aside className="w-full shrink-0 border-b border-stone-200 bg-stone-900 text-stone-100 md:w-56 md:border-b-0 md:border-r">
      <div className="p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">Cafe POS</p>
        <p className="mt-1 text-lg font-bold">管理</p>
        <p className="mt-1 text-xs text-stone-400">11:00–18:00 / 木曜定休</p>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-4 md:flex-col md:overflow-visible md:px-3 md:pb-6">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="whitespace-nowrap rounded-lg px-3 py-2 text-sm text-stone-300 transition hover:bg-stone-800 hover:text-white"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-stone-100 md:flex-row">
      <AdminNav />
      <main className="flex-1 p-6 md:p-8">{children}</main>
    </div>
  );
}
