"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

export function StaffAccessForm() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pin || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/staff-access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "PINが違います");
        return;
      }
      window.location.replace(next);
    } catch {
      setError("通信エラー。もう一度お試しください");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-8 shadow-sm"
    >
      <p className="text-[11px] tracking-[0.2em] text-stone-400">CAFE POS</p>
      <h1 className="mt-1 text-2xl font-bold text-stone-900">スタッフ確認</h1>
      <p className="mt-2 text-sm text-stone-500">
        この端末で初めて開くときだけ、スタッフPINを入力してください。次回からは不要です。
      </p>
      <input
        type="password"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        placeholder="スタッフPIN"
        className="mt-6 w-full rounded-xl border border-stone-300 px-4 py-3 text-center text-2xl tracking-[0.4em] outline-none focus:border-stone-900"
      />
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={!pin || busy}
        className="mt-5 w-full rounded-xl bg-stone-900 px-4 py-3 text-base font-semibold text-white disabled:opacity-40"
      >
        {busy ? "確認中…" : "この端末を許可"}
      </button>
    </form>
  );
}
