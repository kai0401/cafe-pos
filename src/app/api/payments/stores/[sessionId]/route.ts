import { NextResponse } from "next/server";
import {
  confirmStoresTerminalPayment,
  finalizeStoresPayment,
  syncStoresOnlinePayment,
} from "@/domain/payment/stores-payment-service";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params;
    let session = await prisma.paymentSession.findUniqueOrThrow({
      where: { id: sessionId },
      include: {
        order: {
          include: {
            table: { select: { id: true, qrToken: true } },
          },
        },
      },
    });

    if (session.status === "AWAITING_ONLINE") {
      await syncStoresOnlinePayment(sessionId);
      session = await prisma.paymentSession.findUniqueOrThrow({
        where: { id: sessionId },
        include: {
          order: {
            include: {
              table: { select: { id: true, qrToken: true } },
            },
          },
        },
      });
    }

    return NextResponse.json({
      session,
      returnUrl:
        session.order?.table?.id && session.order.table.qrToken
          ? `/qr/${session.order.table.id}?t=${session.order.table.qrToken}`
          : null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "取得エラー" },
      { status: 400 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params;
    const body = await request.json();
    const { action, terminalNote } = body;

    if (action === "confirm") {
      const result = await confirmStoresTerminalPayment(sessionId, terminalNote);
      return NextResponse.json(result);
    }

    if (action === "sync") {
      const session = await syncStoresOnlinePayment(sessionId);
      if (session.status === "PAID") {
        return NextResponse.json({ session, paid: true });
      }
      return NextResponse.json({ session, paid: false });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "決済エラー" },
      { status: 400 },
    );
  }
}
