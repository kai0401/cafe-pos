import { KitchenTicketStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getKitchenTickets, updateKitchenTicketStatus } from "@/domain/order/order-service";

export async function GET() {
  const tickets = await getKitchenTickets();
  return NextResponse.json(tickets);
}

export async function PATCH(request: Request) {
  const { ticketId, status } = await request.json();
  if (!ticketId || !status) {
    return NextResponse.json({ error: "ticketId and status required" }, { status: 400 });
  }
  const ticket = await updateKitchenTicketStatus(ticketId, status as KitchenTicketStatus);
  return NextResponse.json(ticket);
}
