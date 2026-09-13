import type { Metadata, Viewport } from "next";
import { POS_ACCENT } from "@/lib/pos-theme";
import { RegisterServiceWorker } from "@/components/pwa/register-service-worker";
import { WaiterInstallPrompt } from "@/components/pwa/waiter-install-prompt";
import { WaiterOfflineBanner } from "@/components/pwa/waiter-offline-banner";
import { WaiterStaffGate } from "@/components/waiter/waiter-staff-gate";

export const metadata: Metadata = {
  title: "ウェイター",
  manifest: "/manifest-waiter.json",
  appleWebApp: {
    capable: true,
    title: "ウェイター",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: [{ url: "/icons/waiter-icon-180.png", sizes: "180x180", type: "image/png" }],
    icon: [
      { url: "/icons/waiter-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/waiter-icon-512.png", sizes: "512x512", type: "image/png" },
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
  viewportFit: "cover",
  themeColor: POS_ACCENT,
};

export default function WaiterLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="waiter-shell min-h-[100dvh] bg-[var(--pos-bg)]">
      <RegisterServiceWorker script="/sw-waiter.js" />
      <WaiterOfflineBanner />
      <WaiterInstallPrompt />
      <WaiterStaffGate>
        <div className="mx-auto min-h-[100dvh] w-full max-w-[var(--waiter-width)] bg-[var(--pos-bg)] px-safe">
          {children}
        </div>
      </WaiterStaffGate>
    </div>
  );
}
