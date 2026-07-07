import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ tableId: string }> }) {
  try {
    const { tableId } = await params;
    const table = await prisma.table.findUnique({ where: { id: tableId } });
    if (!table) return NextResponse.json({ error: "テーブルが見つかりません" }, { status: 404 });
    return NextResponse.json(table);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "取得エラー" },
      { status: 500 },
    );
  }
}
