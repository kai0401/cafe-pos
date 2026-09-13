import type { Metadata, Viewport } from "next";
import { POS_ACCENT } from "@/lib/pos-theme";
import { RegisterServiceWorker } from "@/components/pwa/register-service-worker";

export const metadata: Metadata = {
  title: "キッチン",
  manifest: "/manifest-kitchen.json",
  appleWebApp: {
    capable: true,
    title: "キッチン",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: [{ url: "/icons/kitchen-icon-180.png", sizes: "180x180", type: "image/png" }],
    icon: [
      { url: "/icons/kitchen-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/kitchen-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: POS_ACCENT,
};

export default function KitchenLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="kitchen-shell min-h-[100dvh] bg-stone-950 text-white">
      <RegisterServiceWorker script="/sw-kitchen.js" />
      {children}
    </div>
  );
}
