"use client";

export default function QrError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#f7f7f7] p-6 text-center">
      <p className="text-[18px] font-semibold text-stone-800">ご注文ページを開けませんでした</p>
      <p className="mt-2 max-w-sm text-[14px] text-stone-500">
        {error.message || "通信エラーの可能性があります。もう一度お試しください。"}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-md bg-[#e25b45] px-8 py-3 text-[15px] font-semibold text-white"
      >
        再読み込み
      </button>
      <p className="mt-4 text-[13px] text-stone-400">スタッフをお呼びください</p>
    </div>
  );
}
