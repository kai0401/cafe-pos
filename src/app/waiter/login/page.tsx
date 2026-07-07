"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

const ORANGE = "#e8912d";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/waiter/tables";
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [required, setRequired] = useState(true);

  useEffect(() => {
    fetch("/api/auth/staff")
      .then((r) => r.json())
      .then((data) => {
        if (!data.authRequired) router.replace(next);
        else setRequired(data.authRequired);
      })
      .catch(() => setRequired(false));
  }, [next, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "ログインに失敗しました");
        return;
      }
      router.replace(next);
    } catch {
      setError("通信エラー");
    } finally {
      setLoading(false);
    }
  }

  if (!required) return null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#efefef] p-6">
      <img src="/icons/waiter-icon-180.png" alt="" width={72} height={72} className="rounded-2xl" />
      <h1 className="mt-4 text-[22px] font-bold text-stone-900">ウェイター</h1>
      <p className="mt-2 text-[14px] text-stone-500">スタッフ PIN を入力</p>

      <form onSubmit={submit} className="mt-8 w-full max-w-[300px]">
        <input
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          placeholder="PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="w-full rounded-xl border border-stone-300 px-4 py-3.5 text-center text-[24px] tracking-[0.3em]"
        />
        {error && <p className="mt-3 text-center text-[14px] text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading || !pin}
          className="mt-4 w-full rounded-xl py-3.5 text-[17px] font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: ORANGE }}
        >
          {loading ? "確認中…" : "ログイン"}
        </button>
      </form>
    </div>
  );
}

export default function WaiterLoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-stone-400">読み込み中…</div>}>
      <LoginForm />
    </Suspense>
  );
}
