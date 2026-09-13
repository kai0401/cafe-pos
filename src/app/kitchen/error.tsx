"use client";

export default function KitchenError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-stone-950 p-6 text-center text-white">
      <p className="text-xl font-bold">キッチン画面エラー</p>
      <p className="mt-2 text-sm text-stone-400">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-lg bg-[var(--pos-accent)] px-6 py-2.5 font-semibold text-white"
      >
        再読み込み
      </button>
    </div>
  );
}
