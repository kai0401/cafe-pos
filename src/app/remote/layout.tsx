import type { Metadata, Viewport } from "next";
import { RegisterServiceWorker } from "@/components/pwa/register-service-worker";

export const metadata: Metadata = {
  title: "遠隔売上",
  description: "日次・月次売上と取引履歴（店舗外から）",
  manifest: "/manifest-remote.json",
  appleWebApp: {
    capable: true,
    title: "遠隔売上",
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
  themeColor: "#1f6f5b",
  viewportFit: "cover",
};

export default function RemoteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-[#f4f2ee]">
      <RegisterServiceWorker script="/sw-remote.js" />
      {children}
    </div>
  );
}
