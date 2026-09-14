import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { buildShopQrBridgeUrl, getFreshShopPublicUrl } from "@/domain/ops/shop-bridge";
import { isCloudRuntime } from "@/lib/runtime-config";
import QrOrderClient from "./qr-order-client";

export const metadata: Metadata = {
  title: "ご注文",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#e25b45",
  viewportFit: "cover",
};

function QrLoading() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#f7f7f7] p-6 text-center">
      <p className="text-[15px] text-stone-500">メニューを準備しています…</p>
    </div>
  );
}

function BridgeUnavailable({ ageSeconds }: { ageSeconds: number | null }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#f7f7f7] p-6 text-center">
      <p className="text-[18px] font-bold text-stone-900">ただいま注文を受け付けできません</p>
      <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-stone-600">
        店舗サーバーへの接続準備中です。しばらくしてからもう一度QRを読み取るか、スタッフをお呼びください。
      </p>
      {ageSeconds != null && (
        <p className="mt-4 text-[12px] text-stone-400">最終接続: {ageSeconds}秒前</p>
      )}
    </div>
  );
}

export default async function QrOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ tableId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tableId } = await params;
  const sp = await searchParams;

  // 印刷QRは固定の Vercel URL。クラウドでは心拍の店舗トンネルへ転送する
  if (isCloudRuntime()) {
    const bridge = await getFreshShopPublicUrl();
    if (bridge.url) {
      redirect(buildShopQrBridgeUrl(bridge.url, tableId, sp));
    }
    return <BridgeUnavailable ageSeconds={bridge.ageSeconds} />;
  }

  return (
    <Suspense fallback={<QrLoading />}>
      <QrOrderClient />
    </Suspense>
  );
}
