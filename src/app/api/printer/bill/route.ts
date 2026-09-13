import { OrderItemStatus } from "@prisma/client";
import { groupOrderItemsForDisplay } from "@/lib/order-modifiers";
import { NextResponse } from "next/server";
import { buildBill, sendToPrinter } from "@/lib/printer/print-service";
import { loadPrinterConfig } from "@/lib/printer/printer-config";
import { isPrinterSupported } from "@/lib/runtime-config";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { orderId } = await request.json();
    if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

    const config = loadPrinterConfig();
    if (!config.ip) {
      return NextResponse.json(
        {
          error: isPrinterSupported()
            ? "プリンター未設定"
            : "印刷エージェントが無効です。店舗MacのPrint Agentを起動してください",
        },
        { status: 400 },
      );
    }

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        items: { where: { status: { not: OrderItemStatus.CANCELLED } } },
        table: true,
      },
    });

    const totalAmount = order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const displayItems = groupOrderItemsForDisplay(
      order.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        productName: i.productName,
        unitPrice: i.unitPrice,
        quantity: i.quantity,
        status: i.status,
        note: i.note,
        createdAt: i.createdAt.toISOString(),
      })),
    );
    const bill = buildBill(
      {
        storeName: config.storeName,
        tableName: order.table.name,
        eatInType: order.eatInType,
        staffName: order.staffName,
        orderNumber: order.orderNumber,
        customerCount: order.customerCount,
        reprint: true,
        items: displayItems.map((i) => ({
          name: i.displayName,
          quantity: i.quantity,
          unitPrice: Math.round(i.lineTotal / Math.max(1, i.quantity)),
        })),
        totalAmount,
      },
      config.cols,
    );

    await sendToPrinter(bill, config, "bill");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "印刷エラー" },
      { status: 400 },
    );
  }
}
