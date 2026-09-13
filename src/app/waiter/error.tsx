"use client";

export default function WaiterError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--pos-bg)] p-6 text-center">
      <p className="text-lg font-semibold text-stone-800">エラーが発生しました</p>
      <p className="mt-2 text-sm text-stone-500">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-lg bg-[var(--pos-accent)] px-6 py-2.5 text-white"
      >
        再試行
      </button>
    </div>
  );
}
