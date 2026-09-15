"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** 遠隔の入口は店舗ダッシュボード（モニター）をデフォルトに */
export default function RemoteOpenPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/monitor");
  }, [router]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#f6f1ea] text-[15px] text-stone-500">
      店舗ダッシュボードへ移動中…
    </div>
  );
}
