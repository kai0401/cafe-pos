"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const SKIP_PATHS = [
  "/waiter/login",
  "/waiter/open",
  "/waiter/install",
  "/waiter/connect",
  "/kitchen/open",
  "/kitchen/install",
  "/kitchen/connect",
];

export function StaffAuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    if (SKIP_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
      setChecked(true);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      setChecked(true);
    }, 5000);

    fetch("/api/auth/staff", { signal: controller.signal, cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data.authRequired) setNeedsLogin(true);
      })
      .catch(() => {
        // ネットワーク障害時はブロックせず続行（ローカル運用を優先）
      })
      .finally(() => {
        clearTimeout(timer);
        setChecked(true);
      });
  }, [pathname]);

  useEffect(() => {
    if (checked && needsLogin) {
      const next = pathname.startsWith("/kitchen") ? "/kitchen" : pathname;
      window.location.href = `/waiter/login?next=${encodeURIComponent(next)}`;
    }
  }, [checked, needsLogin, pathname]);

  if (needsLogin) {
    return (
      <div className="flex min-h-[40dvh] items-center justify-center text-stone-400">
        ログイン画面へ移動中…
      </div>
    );
  }

  return <>{children}</>;
}
