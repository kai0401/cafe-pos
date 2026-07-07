"use client";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="admin-card mx-auto max-w-lg p-8 text-center">
      <p className="admin-brand-serif text-lg text-[var(--admin-ink)]">読み込みエラー</p>
      <p className="mt-3 text-sm text-[var(--admin-muted)]">{error.message}</p>
      <button type="button" onClick={reset} className="admin-btn admin-btn--primary mt-6">
        再試行
      </button>
    </div>
  );
}
