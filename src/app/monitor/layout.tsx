import type { Metadata, Viewport } from "next";
import { POS_ACCENT } from "@/lib/pos-theme";
import { RegisterServiceWorker } from "@/components/pwa/register-service-worker";

export const metadata: Metadata = {
  title: "店舗ダッシュボード",
  description: "遠隔から店舗の稼働状況・売上・天気を確認",
  manifest: "/manifest-monitor.json",
  appleWebApp: {
    capable: true,
    title: "店舗ダッシュ",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: [{ url: "/icons/remote-icon-180.png", sizes: "180x180", type: "image/png" }],
    icon: [
      { url: "/icons/remote-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/remote-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: POS_ACCENT,
  viewportFit: "cover",
};

export default function MonitorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh]">
      <RegisterServiceWorker script="/sw-remote.js" />
      {children}
    </div>
  );
}
