import type { Metadata, Viewport } from "next";
import { POS_ACCENT } from "@/lib/pos-theme";

export const metadata: Metadata = {
  title: "店舗モニター | あづま家",
  description: "遠隔から店舗の稼働状況を確認",
  appleWebApp: {
    capable: true,
    title: "店舗モニター",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: POS_ACCENT,
};

export default function MonitorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
