import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
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

export default function QrOrderPage() {
  return (
    <Suspense fallback={<QrLoading />}>
      <QrOrderClient />
    </Suspense>
  );
}
