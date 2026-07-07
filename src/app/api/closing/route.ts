import { NextResponse } from "next/server";
import { executeDailyClosing, getDailyClosing } from "@/domain/sales/sales-service";
import { getDefaultStore } from "@/lib/prisma";

export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get("date") ?? undefined;
  const store = await getDefaultStore();
  const summary = await getDailyClosing(store.id, date);
  return NextResponse.json(summary);
}

export async function POST() {
  try {
    const store = await getDefaultStore();
    const result = await executeDailyClosing(store.id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "締め処理エラー" },
      { status: 400 },
    );
  }
}
