import { NextResponse } from "next/server";
import {
  addAndSendOrderItems,
  addOrderItems,
  cancelPendingOrder,
  cancelTableTransaction,
  completeOrderCheckout,
  getTableOrder,
  markItemServed,
  mergeOrdersInto,
  moveOrderToTable,
  openTableOrder,
  sendOrderToKitchen,
  splitOrderToTable,
  updateOrderMeta,
  updatePendingItemQuantity,
} from "@/domain/order/order-service";
import { ensureWaiterSetup } from "@/lib/waiter-setup";
import { withIdempotency } from "@/lib/idempotency";
import { getDefaultStore, prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const tableId = new URL(request.url).searchParams.get("tableId");
    if (!tableId) return NextResponse.json({ error: "tableId required" }, { status: 400 });
    const order = await getTableOrder(tableId);
    return NextResponse.json(order);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "注文取得エラー" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      action,
      tableId,
      orderId,
      items,
      customerCount,
      itemId,
      quantity,
      idempotencyKey,
    } = body;

    if (action === "addAndSend" && tableId && items?.length) {
      const store = await ensureWaiterSetup();
      const order = await withIdempotency(idempotencyKey, store.id, () =>
        addAndSendOrderItems(tableId, store.id, items),
      );
      return NextResponse.json(order);
    }

    const needsStore =
      action === "checkout" ||
      action === "open" ||
      (tableId && items?.length && !action);
    const store = needsStore ? await ensureWaiterSetup() : await getDefaultStore();

    if (action === "updateGuests" && tableId && customerCount !== undefined) {
      const order = await getTableOrder(tableId);
      if (!order) return NextResponse.json({ error: "注文なし" }, { status: 400 });
      await prisma.order.update({
        where: { id: order.id },
        data: { customerCount: Number(customerCount) },
      });
      return NextResponse.json(await getTableOrder(tableId));
    }

    if (action === "updateMeta" && orderId) {
      const order = await updateOrderMeta(orderId, {
        staffName: body.staffName !== undefined ? body.staffName || null : undefined,
        customerSegment:
          body.customerSegment !== undefined ? body.customerSegment || null : undefined,
      });
      return NextResponse.json(order);
    }

    if (action === "serveItem" && itemId) {
      const order = await markItemServed(itemId);
      return NextResponse.json(order);
    }

    if (action === "updateMemo" && orderId && body.note !== undefined) {
      await prisma.order.update({
        where: { id: orderId },
        data: { note: body.note || null },
      });
      const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
      return NextResponse.json(await getTableOrder(order.tableId));
    }

    if (action === "checkout" && orderId) {
      const method = body.paymentMethod ?? "CASH";
      const tendered = body.tendered ? Number(body.tendered) : undefined;
      const discount = body.discount ? Number(body.discount) : 0;
      const result = await completeOrderCheckout(orderId, store.id, method, tendered, discount);
      return NextResponse.json(result);
    }

    if (action === "cancelTransaction" && orderId) {
      const order = await cancelTableTransaction(orderId);
      return NextResponse.json(order);
    }

    if (action === "moveTable" && orderId && body.targetTableId) {
      const result = await moveOrderToTable(orderId, body.targetTableId);
      return NextResponse.json(result);
    }

    if (action === "splitTable" && orderId && body.targetTableId && Array.isArray(body.itemIds)) {
      const result = await splitOrderToTable(orderId, body.targetTableId, body.itemIds);
      return NextResponse.json(result);
    }

    if (action === "mergeTable" && orderId && body.sourceOrderId) {
      const order = await mergeOrdersInto(orderId, body.sourceOrderId);
      return NextResponse.json(order);
    }

    if (action === "open" && tableId) {
      const order = await openTableOrder(tableId, store.id, customerCount ?? 1);
      return NextResponse.json(order);
    }

    if (action === "send" && orderId) {
      const order = await withIdempotency(idempotencyKey, store.id, () =>
        sendOrderToKitchen(orderId),
      );
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
      const order = await withIdempotency(idempotencyKey, store.id, () =>
        addOrderItems(tableId, store.id, items),
      );
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
