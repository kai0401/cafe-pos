import { Suspense } from "react";
import QrPaymentCompleteClient from "./qr-payment-complete-client";

export default function QrPaymentCompletePage() {
  return (
    <Suspense fallback={<p className="p-6 text-center text-stone-400">読み込み中…</p>}>
      <QrPaymentCompleteClient />
    </Suspense>
  );
}
