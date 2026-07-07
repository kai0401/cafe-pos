"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/admin/dashboard";
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "ログインに失敗しました");
        return;
      }
      router.push(next);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-shell flex min-h-screen items-center justify-center px-6">
      <form onSubmit={submit} className="admin-card w-full max-w-sm p-10">
        <p className="admin-label">管理</p>
        <h1 className="admin-brand-serif mt-2 text-2xl text-[var(--admin-ink)]">ログイン</h1>
        <p className="mt-2 text-sm text-[var(--admin-muted)]">PINを入力してください</p>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="admin-input mt-8 text-center text-2xl tracking-[0.35em]"
          placeholder="····"
          autoFocus
        />
        {error && <p className="mt-3 text-sm text-[var(--admin-vermillion)]">{error}</p>}
        <button
          type="submit"
          disabled={loading || !pin}
          className="admin-btn admin-btn--primary mt-8 w-full py-3"
        >
          {loading ? "確認中…" : "入る"}
        </button>
      </form>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={<p className="admin-shell p-6 text-center text-[var(--admin-muted)]">読み込み中…</p>}
    >
      <LoginForm />
    </Suspense>
  );
}
