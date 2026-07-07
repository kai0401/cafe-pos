import { KitchenTicketStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getKitchenTickets, updateKitchenTicketStatus } from "@/domain/order/order-service";

export async function GET() {
  try {
    const tickets = await getKitchenTickets();
    return NextResponse.json(tickets);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "チケット取得エラー" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { ticketId, status } = await request.json();
    if (!ticketId || !status) {
      return NextResponse.json({ error: "ticketId and status required" }, { status: 400 });
    }
    const ticket = await updateKitchenTicketStatus(ticketId, status as KitchenTicketStatus);
    return NextResponse.json(ticket);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "更新エラー" },
      { status: 400 },
    );
  }
}
