import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { ensureWaiterSetup } from "@/lib/waiter-setup";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const store = await ensureWaiterSetup();
  const tables = await prisma.table.findMany({
    where: { storeId: store.id, eatInType: "DINE_IN" },
    orderBy: [{ sortOrder: "asc" }, { number: "asc" }],
    select: {
      id: true,
      name: true,
      qrToken: true,
      qrEnabled: true,
      status: true,
    },
  });

  return NextResponse.json(tables);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tableId, action } = body;
    if (!tableId) {
      return NextResponse.json({ error: "tableId required" }, { status: 400 });
    }

    if (action === "toggle") {
      const table = await prisma.table.findUniqueOrThrow({ where: { id: tableId } });
      const updated = await prisma.table.update({
        where: { id: tableId },
        data: { qrEnabled: !table.qrEnabled },
      });
      return NextResponse.json(updated);
    }

    if (action === "regenerate") {
      const updated = await prisma.table.update({
        where: { id: tableId },
        data: { qrToken: randomUUID().replace(/-/g, "").slice(0, 16) },
      });
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "更新エラー" },
      { status: 400 },
    );
  }
}
