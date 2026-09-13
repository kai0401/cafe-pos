import { NextResponse } from "next/server";
import {
  confirmStoresTerminalPayment,
  syncStoresOnlinePayment,
} from "@/domain/payment/stores-payment-service";
import { prisma } from "@/lib/prisma";

function publicSessionPayload(session: {
  id: string;
  status: string;
  amount: number;
  discountAmount: number;
  paymentMethod: string | null;
  paymentUrl: string | null;
  paidAt: Date | null;
  order: {
    id: string;
    table: { id: string; qrToken: string | null } | null;
  } | null;
}) {
  const table = session.order?.table;
  const returnUrl =
    table?.id && table.qrToken ? `/qr/${table.id}?t=${table.qrToken}` : null;

  return {
    session: {
      id: session.id,
      status: session.status,
      amount: session.amount,
      discountAmount: session.discountAmount,
      paymentMethod: session.paymentMethod,
      paymentUrl: session.paymentUrl,
      paidAt: session.paidAt,
      order: session.order
        ? {
            id: session.order.id,
            table: table ? { id: table.id } : null,
          }
        : null,
    },
    returnUrl,
  };
}

export async function GET(
  _request: Request,
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

    return NextResponse.json(publicSessionPayload(session));
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
