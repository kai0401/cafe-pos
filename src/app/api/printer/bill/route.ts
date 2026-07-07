import { OrderItemStatus } from "@prisma/client";
import { groupOrderItemsForDisplay } from "@/lib/order-modifiers";
import { NextResponse } from "next/server";
import { buildBill, sendToPrinter } from "@/lib/printer/print-service";
import { loadPrinterConfig } from "@/lib/printer/printer-config";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { orderId } = await request.json();
    if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

    const config = loadPrinterConfig();
    if (!config.ip) {
      return NextResponse.json({ error: "プリンター未設定" }, { status: 400 });
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
        orderNumber: order.orderNumber,
        customerCount: order.customerCount,
        items: displayItems.map((i) => ({
          name: i.displayName,
          quantity: i.quantity,
          unitPrice: i.lineTotal / i.quantity,
        })),
        totalAmount,
      },
      config.cols,
    );

    await sendToPrinter(bill, config);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "印刷エラー" },
      { status: 400 },
    );
  }
}
