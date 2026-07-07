import type { Metadata, Viewport } from "next";
import { RegisterServiceWorker } from "@/components/pwa/register-service-worker";
import { StaffAuthGuard } from "@/components/pwa/staff-auth-guard";
import { WaiterInstallPrompt } from "@/components/pwa/waiter-install-prompt";
import { WaiterOfflineBanner } from "@/components/pwa/waiter-offline-banner";

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
  themeColor: "#e8912d",
};

export default function WaiterLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="waiter-shell min-h-[100dvh] bg-stone-950">
      <RegisterServiceWorker script="/sw-waiter.js" />
      <WaiterOfflineBanner />
      <WaiterInstallPrompt />
      <div className="mx-auto min-h-[100dvh] w-full max-w-[var(--waiter-width)] bg-[#efefef] px-safe">
        <StaffAuthGuard>{children}</StaffAuthGuard>
      </div>
    </div>
  );
}
