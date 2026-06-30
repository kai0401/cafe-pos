import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "ウェイター",
  manifest: "/manifest-waiter.json",
  appleWebApp: { capable: true, title: "ウェイター" },
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
      <div className="mx-auto min-h-[100dvh] w-full max-w-[var(--waiter-width)] bg-[#efefef]">
        {children}
      </div>
    </div>
  );
}
