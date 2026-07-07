import { NextResponse } from "next/server";
import { refundTransaction } from "@/domain/sales/sales-service";
import { getDefaultStore } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { transactionId } = await request.json();
    if (!transactionId) {
      return NextResponse.json({ error: "transactionId required" }, { status: 400 });
    }
    const store = await getDefaultStore();
    const refund = await refundTransaction(transactionId, store.id);
    return NextResponse.json({ ok: true, refundId: refund.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "取消エラー" },
      { status: 400 },
    );
  }
}
