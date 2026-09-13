import { NextResponse } from "next/server";
import { loadPrinterConfig, savePrinterConfig } from "@/lib/printer/printer-config";
import { isPrinterSupported } from "@/lib/runtime-config";
import { getDefaultStore } from "@/lib/prisma";

export async function GET() {
  const config = loadPrinterConfig();
  let storeName = config.storeName;
  try {
    const store = await getDefaultStore();
    if (!storeName || storeName === "喫茶店" || storeName === "あづま家") storeName = store.name || storeName;
  } catch {
    // store lookup is optional
  }

  return NextResponse.json({
    ...config,
    storeName,
    supported: isPrinterSupported(),
    agentMode: !isPrinterSupported() && Boolean(config.ip),
    cloudNote: isPrinterSupported()
      ? null
      : config.ip
        ? "クラウド運用：印刷は店舗 Mac の印刷エージェント経由で行います（Mac が起きている間に印刷されます）。"
        : "クラウド運用では TM-m30 へ直接印刷できません。キッチン画面と STORES 端末のレシートを使ってください。",
  });
}

export async function POST(request: Request) {
  if (!isPrinterSupported()) {
    return NextResponse.json(
      {
        error:
          "クラウド運用ではプリンター設定を保存できません。キッチン画面と STORES レシートを利用してください。",
      },
      { status: 400 },
    );
  }

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
    return NextResponse.json({ ...config, supported: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "設定の保存に失敗しました" },
      { status: 400 },
    );
  }
}
