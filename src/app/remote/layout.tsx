import type { Metadata, Viewport } from "next";
import { POS_ACCENT } from "@/lib/pos-theme";

export const metadata: Metadata = {
  title: "遠隔ダッシュボード | あづま家",
  description: "日次・月次売上と取引履歴（店舗外から）",
  appleWebApp: {
    capable: true,
    title: "遠隔売上",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: POS_ACCENT,
  viewportFit: "cover",
};

export default function RemoteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
