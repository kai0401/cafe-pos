import { NextResponse } from "next/server";
import { loadPrinterConfig, savePrinterConfig } from "@/lib/printer/printer-config";

export async function GET() {
  return NextResponse.json(loadPrinterConfig());
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const config = savePrinterConfig({
      ip: typeof body.ip === "string" ? body.ip.trim() : undefined,
      port: body.port ? Number(body.port) : undefined,
      printKitchenTicket:
        typeof body.printKitchenTicket === "boolean" ? body.printKitchenTicket : undefined,
      printReceipt: typeof body.printReceipt === "boolean" ? body.printReceipt : undefined,
      kickDrawer: typeof body.kickDrawer === "boolean" ? body.kickDrawer : undefined,
      cols: body.cols ? Number(body.cols) : undefined,
      storeName: typeof body.storeName === "string" ? body.storeName : undefined,
    });
    return NextResponse.json(config);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "設定の保存に失敗しました" },
      { status: 400 },
    );
  }
}
