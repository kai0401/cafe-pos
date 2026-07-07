import { NextResponse } from "next/server";
import { syncStoresOnlinePayment } from "@/domain/payment/stores-payment-service";
import { PaymentSessionStatus } from "@prisma/client";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");
  const result = url.searchParams.get("result");

  const base = `${url.protocol}//${url.host}`;

  if (!sessionId) {
    return NextResponse.redirect(`${base}/qr/payment/complete?error=invalid`);
  }

  if (result === "success") {
    try {
      const session = await syncStoresOnlinePayment(sessionId);
      if (session.status === PaymentSessionStatus.PAID) {
        return NextResponse.redirect(`${base}/qr/payment/complete?sessionId=${sessionId}`);
      }
      return NextResponse.redirect(`${base}/qr/payment/complete?sessionId=${sessionId}&pending=1`);
    } catch {
      return NextResponse.redirect(`${base}/qr/payment/complete?sessionId=${sessionId}&pending=1`);
    }
  }

  return NextResponse.redirect(`${base}/qr/payment/complete?sessionId=${sessionId}&cancelled=1`);
}
