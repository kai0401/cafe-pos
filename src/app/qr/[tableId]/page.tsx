import type { Metadata, Viewport } from "next";
import QrOrderClient from "./qr-order-client";

export const metadata: Metadata = {
  title: "QRオーダー",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#b45309",
};

export default function QrOrderPage() {
  return <QrOrderClient />;
}
