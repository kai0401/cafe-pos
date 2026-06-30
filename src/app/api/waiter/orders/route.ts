import { KitchenTicketStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import {
  addOrderItems,
  cancelPendingOrder,
  cancelTableTransaction,
  getTableOrder,
  openTableOrder,
  sendOrderToKitchen,
  updatePendingItemQuantity,
} from "@/domain/order/order-service";
import { ensureWaiterSetup } from "@/lib/waiter-setup";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const tableId = new URL(request.url).searchParams.get("tableId");
  if (!tableId) return NextResponse.json({ error: "tableId required" }, { status: 400 });
  const order = await getTableOrder(tableId);
  return NextResponse.json(order);
}

export async function POST(request: Request) {
  try {
    const store = await ensureWaiterSetup();
    const body = await request.json();
    const { action, tableId, orderId, items, customerCount, itemId, quantity } = body;

    if (action === "updateGuests" && tableId && customerCount !== undefined) {
      const order = await getTableOrder(tableId);
      if (!order) return NextResponse.json({ error: "注文なし" }, { status: 400 });
      await prisma.order.update({
        where: { id: order.id },
        data: { customerCount: Number(customerCount) },
      });
      return NextResponse.json(await getTableOrder(tableId));
    }

    if (action === "updateMemo" && orderId && body.note !== undefined) {
      await prisma.order.update({
        where: { id: orderId },
        data: { note: body.note || null },
      });
      const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
      return NextResponse.json(await getTableOrder(order.tableId));
    }

    if (action === "cancelTransaction" && orderId) {
      const order = await cancelTableTransaction(orderId);
      return NextResponse.json(order);
    }

    if (action === "open" && tableId) {
      const order = await openTableOrder(tableId, store.id, customerCount ?? 1);
      return NextResponse.json(order);
    }

    if (action === "send" && orderId) {
      const order = await sendOrderToKitchen(orderId);
      return NextResponse.json(order);
    }

    if (action === "cancel" && orderId) {
      const order = await cancelPendingOrder(orderId);
      return NextResponse.json(order);
    }

    if (action === "updateQty" && itemId !== undefined) {
      await updatePendingItemQuantity(itemId, quantity);
      const order = await getTableOrder(tableId);
      return NextResponse.json(order);
    }

    if (tableId && items?.length) {
      const order = await addOrderItems(tableId, store.id, items);
      return NextResponse.json(order);
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "注文エラー" },
      { status: 400 },
    );
  }
}
